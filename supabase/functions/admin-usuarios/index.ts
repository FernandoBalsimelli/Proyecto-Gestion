import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const URL     = Deno.env.get('SUPABASE_URL')!
    const ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Quién llama (con SU token, no el de admin)
    const userClient = createClient(URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return json({ error: 'Sesión inválida' }, 401)

    const admin = createClient(URL, SERVICE)

    // Rol del que llama
    const { data: yo } = await admin
      .from('miembros').select('negocio_id, rol, permisos')
      .eq('user_id', user.id).maybeSingle()

    const { data: sa } = await admin
      .from('super_admins').select('user_id')
      .eq('user_id', user.id).maybeSingle()

    const esSuperAdmin = !!sa
    const puedeGestionar =
      esSuperAdmin || yo?.rol === 'dueno' || yo?.permisos?.gestionar_equipo === true

    const { accion, ...p } = await req.json()

    /* ══════ CREAR MIEMBRO (alta completa) ══════ */
    if (accion === 'crear_miembro') {
      if (!puedeGestionar) return json({ error: 'Sin permiso para gestionar el equipo' }, 403)

      const email = String(p.email || '').trim().toLowerCase()
      const password = String(p.password || '')
      const negocioId = esSuperAdmin && p.negocio_id ? p.negocio_id : yo?.negocio_id

      if (!EMAIL_RE.test(email))   return json({ error: 'Correo no válido' }, 400)
      if (password.length < 8)     return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
      if (!negocioId)              return json({ error: 'No perteneces a ningún negocio' }, 400)
      // Solo el super admin puede crear dueños
      const rol = (p.rol === 'dueno' && esSuperAdmin) ? 'dueno' : 'empleado'

      // ¿Ya existe esa cuenta?
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existente = lista?.users?.find(u => u.email?.toLowerCase() === email)

      let userId: string

      if (existente) {
        const { data: ya } = await admin
          .from('miembros').select('negocio_id').eq('user_id', existente.id).maybeSingle()
        if (ya?.negocio_id === negocioId) return json({ error: 'Esa persona ya es miembro de este negocio' }, 400)
        if (ya)                            return json({ error: 'Ese correo ya pertenece a otro negocio' }, 400)
        userId = existente.id
      } else {
        const { data: nuevo, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { debe_cambiar_password: true },
        })
        if (error) return json({ error: error.message }, 400)
        userId = nuevo.user.id
      }

      const { error: mErr } = await admin.from('miembros').insert({
        negocio_id: negocioId,
        user_id: userId,
        email,
        rol,
        permisos: p.permisos ?? { registrar_gastos: true },
      })
      if (mErr) {
        if (!existente) await admin.auth.admin.deleteUser(userId) // rollback
        return json({ error: mErr.message }, 400)
      }

      if (rol === 'dueno') {
        await admin.from('negocios').update({ owner_id: userId })
          .eq('id', negocioId).is('owner_id', null)
      }

      return json({ ok: true, user_id: userId, existia: !!existente })
    }

    /* ══════ ELIMINAR MIEMBRO (baja completa) ══════ */
    if (accion === 'eliminar_miembro') {
      if (!puedeGestionar) return json({ error: 'Sin permiso' }, 403)

      const { data: m } = await admin
        .from('miembros').select('*').eq('id', p.miembro_id).maybeSingle()
      if (!m) return json({ error: 'Miembro no encontrado' }, 404)
      if (!esSuperAdmin && m.negocio_id !== yo?.negocio_id)
        return json({ error: 'Ese miembro no es de tu negocio' }, 403)
      if (m.rol === 'dueno' && !esSuperAdmin)
        return json({ error: 'No puedes eliminar al dueño del negocio' }, 403)
      if (m.user_id === user.id)
        return json({ error: 'No puedes eliminarte a ti mismo' }, 400)

      await admin.from('miembros').delete().eq('id', m.id)

      // Solo borra la cuenta si no pertenece a otro negocio
      const { count } = await admin
        .from('miembros').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id)

      if (!count) {
        const { error } = await admin.auth.admin.deleteUser(m.user_id)
        if (error) return json({ ok: true, aviso: 'Miembro removido, pero la cuenta no se pudo borrar: ' + error.message })
      }
      return json({ ok: true })
    }

    /* ══════ CAMBIAR CONTRASEÑA DE UN EMPLEADO ══════ */
    if (accion === 'resetear_password') {
      if (!puedeGestionar) return json({ error: 'Sin permiso' }, 403)

      const { data: m } = await admin
        .from('miembros').select('*').eq('id', p.miembro_id).maybeSingle()
      if (!m) return json({ error: 'Miembro no encontrado' }, 404)
      if (!esSuperAdmin && m.negocio_id !== yo?.negocio_id)
        return json({ error: 'Ese miembro no es de tu negocio' }, 403)
      if (m.rol === 'dueno' && !esSuperAdmin)
        return json({ error: 'No puedes cambiar la contraseña del dueño' }, 403)

      const password = String(p.password || '')
      if (password.length < 8) return json({ error: 'Mínimo 8 caracteres' }, 400)

      const { error } = await admin.auth.admin.updateUserById(m.user_id, {
        password,
        user_metadata: { debe_cambiar_password: true },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

        /* ══════ CREAR NEGOCIO + DUEÑO (solo super admin) ══════ */
    if (accion === 'crear_negocio') {
      if (!esSuperAdmin) return json({ error: 'No autorizado' }, 403)

      const nombre   = String(p.nombre || '').trim()
      const email    = String(p.email || '').trim().toLowerCase()
      const password = String(p.password || '')

      if (nombre.length < 2)     return json({ error: 'El nombre del negocio es obligatorio' }, 400)
      if (!EMAIL_RE.test(email)) return json({ error: 'Correo no válido' }, 400)
      if (password.length < 8)   return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)

      // ¿Ya existe esa cuenta?
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existente = lista?.users?.find(u => u.email?.toLowerCase() === email)

      if (existente) {
        const { data: ya } = await admin
          .from('miembros').select('negocio_id').eq('user_id', existente.id).maybeSingle()
        if (ya) return json({ error: 'Ese correo ya pertenece a otro negocio' }, 400)
      }

      let userId: string
      if (existente) {
        userId = existente.id
        // Le ponemos la contraseña temporal también
        await admin.auth.admin.updateUserById(userId, {
          password,
          user_metadata: { debe_cambiar_password: true },
        })
      } else {
        const { data: nuevo, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { debe_cambiar_password: true },
        })
        if (error) return json({ error: error.message }, 400)
        userId = nuevo.user.id
      }

      const { data: neg, error: nErr } = await admin
        .from('negocios').insert({ nombre, owner_id: userId }).select('id').single()
      if (nErr) {
        if (!existente) await admin.auth.admin.deleteUser(userId)
        return json({ error: nErr.message }, 400)
      }

      const { error: mErr } = await admin.from('miembros').insert({
        negocio_id: neg.id, user_id: userId, email, rol: 'dueno', permisos: {},
      })
      if (mErr) {
        await admin.from('negocios').delete().eq('id', neg.id)
        if (!existente) await admin.auth.admin.deleteUser(userId)
        return json({ error: mErr.message }, 400)
      }

      return json({ ok: true, negocio_id: neg.id, existia: !!existente })
    }

    /* ══════ ELIMINAR NEGOCIO COMPLETO (solo super admin) ══════ */
    if (accion === 'eliminar_negocio') {
      if (!esSuperAdmin) return json({ error: 'No autorizado' }, 403)

      const negocioId = p.negocio_id
      const { count: nVentas } = await admin
        .from('ventas').select('id', { count: 'exact', head: true }).eq('negocio_id', negocioId)
      if (nVentas && !p.forzar)
        return json({ error: `Ese negocio tiene ${nVentas} venta(s) registradas. Confirma para borrar todo.`, requiere_confirmacion: true }, 400)

      const { data: mm } = await admin
        .from('miembros').select('user_id').eq('negocio_id', negocioId)

      await admin.from('negocios').delete().eq('id', negocioId)   // cascade borra el resto

      // Borra las cuentas que ya no pertenezcan a ningún negocio
      for (const m of mm ?? []) {
        if (m.user_id === user.id) continue                        // nunca tu propia cuenta
        const { count } = await admin
          .from('miembros').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id)
        if (!count) await admin.auth.admin.deleteUser(m.user_id)
      }

      return json({ ok: true })
    }

    return json({ error: 'Acción no reconocida' }, 400)
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500)
  }
})