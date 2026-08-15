import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* ══════════════════════════════════════════════════════════════
   CORS — solo tus dominios.
   El original usaba '*': cualquier sitio del mundo podía llamar
   a esta función con la sesión de tu usuario si lograba robarle
   el token, y además invitaba a que la escanearan bots.
   Define ORIGENES_PERMITIDOS como secret en Supabase:
     supabase secrets set ORIGENES_PERMITIDOS="https://tuapp.vercel.app,http://localhost:5173"
   ══════════════════════════════════════════════════════════════ */
const ORIGENES = (Deno.env.get('ORIGENES_PERMITIDOS') ?? 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)

const corsPara = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGENES.includes(origin) ? origin : ORIGENES[0] ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
const MAX_BODY = 16 * 1024        // 16 KB: nadie necesita más para estas acciones
const MIN_PASS = 10               // subido de 8 a 10
const MAX_PASS = 128

/** Contraseña razonable: longitud + al menos dos tipos de carácter. */
function passwordValida(p: string): string | null {
  if (p.length < MIN_PASS) return `La contraseña debe tener al menos ${MIN_PASS} caracteres`
  if (p.length > MAX_PASS) return 'La contraseña es demasiado larga'
  const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length
  if (tipos < 2) return 'La contraseña debe combinar letras y números'
  return null
}

const texto = (v: unknown, max: number) =>
  String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max)

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsPara(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    /* ── Cuerpo acotado ── */
    const raw = await req.text()
    if (raw.length > MAX_BODY) return json({ error: 'Petición demasiado grande' }, 413)

    let cuerpo: Record<string, unknown>
    try { cuerpo = JSON.parse(raw || '{}') } catch { return json({ error: 'JSON no válido' }, 400) }

    const URL_SB  = Deno.env.get('SUPABASE_URL')!
    const ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Quién llama, validado con SU token
    const userClient = createClient(URL_SB, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return json({ error: 'Sesión inválida' }, 401)

    const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } })

    /* ── Rate limit del SERVIDOR, por usuario ──
       30 operaciones administrativas por hora. Aunque alguien scriptee
       la función con un token válido, no puede crear 10 000 cuentas. */
    const { data: permitido } = await admin.rpc('rate_limit_check', {
      p_clave: `admin-usuarios:${user.id}`,
      p_max: 30,
      p_ventana_seg: 3600,
    })
    if (permitido === false) {
      return json({ error: 'Demasiadas operaciones. Espera unos minutos.' }, 429)
    }

    /* ── Rol del que llama ── */
    const [{ data: yo }, { data: sa }] = await Promise.all([
      admin.from('miembros').select('negocio_id, rol, permisos').eq('user_id', user.id).maybeSingle(),
      admin.from('super_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    ])

    const esSuperAdmin = !!sa
    const puedeGestionar =
      esSuperAdmin || yo?.rol === 'dueno' || yo?.permisos?.gestionar_equipo === true

    const accion = String(cuerpo.accion ?? '')
    const p = cuerpo as Record<string, any>

    /** Busca un usuario por correo con un índice, no listando 1000 cuentas. */
    const buscarUserId = async (email: string): Promise<string | null> => {
      const { data } = await admin.rpc('buscar_user_id_por_email', { p_email: email })
      return (data as string) ?? null
    }

    /* ══════ CREAR MIEMBRO ══════ */
    if (accion === 'crear_miembro') {
      if (!puedeGestionar) return json({ error: 'Sin permiso para gestionar el equipo' }, 403)

      const email = texto(p.email, 160).toLowerCase()
      const password = String(p.password ?? '')
      const negocioId = esSuperAdmin && p.negocio_id ? p.negocio_id : yo?.negocio_id

      if (!EMAIL_RE.test(email)) return json({ error: 'Correo no válido' }, 400)
      const errPass = passwordValida(password)
      if (errPass) return json({ error: errPass }, 400)
      if (!negocioId) return json({ error: 'No perteneces a ningún negocio' }, 400)

      // Solo el super admin puede crear dueños.
      const rol = (p.rol === 'dueno' && esSuperAdmin) ? 'dueno' : 'empleado'

      // Tope de plantilla: evita que se inflen miles de cuentas por negocio.
      const { count: miembrosActuales } = await admin
        .from('miembros').select('id', { count: 'exact', head: true }).eq('negocio_id', negocioId)
      if ((miembrosActuales ?? 0) >= 100) {
        return json({ error: 'Este negocio alcanzó el límite de 100 miembros' }, 400)
      }

      // Lista blanca de permisos: nunca aceptamos el objeto crudo del cliente.
      const PERMISOS_VALIDOS = [
        'ver_finanzas', 'registrar_pagos', 'registrar_gastos',
        'eliminar_registros', 'editar_configuracion', 'gestionar_equipo', 'gestionar_nomina', 'gestionar_inventario', 'gestionar_comercial', 'gestionar_operaciones',
      ]
      const permisos: Record<string, boolean> = {}
      for (const k of PERMISOS_VALIDOS) {
        if (p.permisos?.[k] === true) permisos[k] = true
      }
      // Un no-super-admin no puede repartir un permiso que él mismo no tiene.
      if (!esSuperAdmin && yo?.rol !== 'dueno') {
        for (const k of Object.keys(permisos)) {
          if (yo?.permisos?.[k] !== true) delete permisos[k]
        }
      }

      const existenteId = await buscarUserId(email)
      let userId: string

      if (existenteId) {
        const { data: ya } = await admin
          .from('miembros').select('negocio_id').eq('user_id', existenteId).maybeSingle()
        if (ya?.negocio_id === negocioId) return json({ error: 'Esa persona ya es miembro de este negocio' }, 400)
        if (ya) return json({ error: 'Ese correo ya pertenece a otro negocio' }, 400)
        userId = existenteId
      } else {
        const { data: nuevo, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { debe_cambiar_password: true },
        })
        if (error) return json({ error: error.message }, 400)
        userId = nuevo.user.id
      }

      const { error: mErr } = await admin.from('miembros').insert({
        negocio_id: negocioId, user_id: userId, email, rol,
        permisos: Object.keys(permisos).length ? permisos : { registrar_gastos: true },
      })
      if (mErr) {
        if (!existenteId) await admin.auth.admin.deleteUser(userId)   // rollback
        return json({ error: mErr.message }, 400)
      }

      if (rol === 'dueno') {
        await admin.from('negocios').update({ owner_id: userId })
          .eq('id', negocioId).is('owner_id', null)
      }

      return json({ ok: true, user_id: userId, existia: !!existenteId })
    }

    /* ══════ ELIMINAR MIEMBRO ══════ */
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

      const { count } = await admin
        .from('miembros').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id)

      if (!count) {
        const { error } = await admin.auth.admin.deleteUser(m.user_id)
        if (error) {
          return json({ ok: true, aviso: 'Miembro removido, pero la cuenta no se pudo borrar: ' + error.message })
        }
      }
      return json({ ok: true })
    }

    /* ══════ RESTABLECER CONTRASEÑA ══════ */
    if (accion === 'resetear_password') {
      if (!puedeGestionar) return json({ error: 'Sin permiso' }, 403)

      const { data: m } = await admin
        .from('miembros').select('*').eq('id', p.miembro_id).maybeSingle()
      if (!m) return json({ error: 'Miembro no encontrado' }, 404)
      if (!esSuperAdmin && m.negocio_id !== yo?.negocio_id)
        return json({ error: 'Ese miembro no es de tu negocio' }, 403)
      if (m.rol === 'dueno' && !esSuperAdmin)
        return json({ error: 'No puedes cambiar la contraseña del dueño' }, 403)

      const password = String(p.password ?? '')
      const errPass = passwordValida(password)
      if (errPass) return json({ error: errPass }, 400)

      const { error } = await admin.auth.admin.updateUserById(m.user_id, {
        password, user_metadata: { debe_cambiar_password: true },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    /* ══════ CREAR NEGOCIO + DUEÑO (solo super admin) ══════ */
    if (accion === 'crear_negocio') {
      if (!esSuperAdmin) return json({ error: 'No autorizado' }, 403)

      const nombre = texto(p.nombre, 100)
      const email = texto(p.email, 160).toLowerCase()
      const password = String(p.password ?? '')

      if (nombre.length < 2) return json({ error: 'El nombre del negocio es obligatorio' }, 400)
      if (!EMAIL_RE.test(email)) return json({ error: 'Correo no válido' }, 400)
      const errPass = passwordValida(password)
      if (errPass) return json({ error: errPass }, 400)

      const existenteId = await buscarUserId(email)

      if (existenteId) {
        const { data: ya } = await admin
          .from('miembros').select('negocio_id').eq('user_id', existenteId).maybeSingle()
        if (ya) return json({ error: 'Ese correo ya pertenece a otro negocio' }, 400)
      }

      let userId: string
      if (existenteId) {
        userId = existenteId
        // Al vincular una cuenta existente se conserva su contraseña actual.
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
        if (!existenteId) await admin.auth.admin.deleteUser(userId)
        return json({ error: nErr.message }, 400)
      }

      const { error: mErr } = await admin.from('miembros').insert({
        negocio_id: neg.id, user_id: userId, email, rol: 'dueno', permisos: {},
      })
      if (mErr) {
        await admin.from('negocios').delete().eq('id', neg.id)
        if (!existenteId) await admin.auth.admin.deleteUser(userId)
        return json({ error: mErr.message }, 400)
      }

      return json({
        ok: true,
        negocio_id: neg.id,
        existia: !!existenteId,
        // El cliente debe mostrar la contraseña SOLO si la cuenta es nueva.
        password_aplicada: !existenteId,
      })
    }

    /* ══════ ELIMINAR NEGOCIO (solo super admin) ══════ */
    if (accion === 'eliminar_negocio') {
      if (!esSuperAdmin) return json({ error: 'No autorizado' }, 403)

      const negocioId = p.negocio_id
      if (!negocioId) return json({ error: 'Falta el negocio' }, 400)

      const { count: nVentas } = await admin
        .from('ventas').select('id', { count: 'exact', head: true }).eq('negocio_id', negocioId)

      if (nVentas && !p.forzar) {
        return json({
          error: `Ese negocio tiene ${nVentas} venta(s) registradas. Confirma para borrar todo.`,
          requiere_confirmacion: true,
        }, 400)
      }

      const { data: mm } = await admin
        .from('miembros').select('user_id').eq('negocio_id', negocioId)

      await admin.from('negocios').delete().eq('id', negocioId)

      for (const m of mm ?? []) {
        if (m.user_id === user.id) continue
        const { count } = await admin
          .from('miembros').select('id', { count: 'exact', head: true }).eq('user_id', m.user_id)
        if (!count) await admin.auth.admin.deleteUser(m.user_id)
      }

      return json({ ok: true })
    }

    /* ══════ CREAR CUENTA SUELTA (para nombrar admin) ══════ */
    if (accion === 'crear_cuenta') {
      if (!esSuperAdmin) return json({ error: 'No autorizado' }, 403)

      const email = texto(p.email, 160).toLowerCase()
      const password = String(p.password ?? '')
      if (!EMAIL_RE.test(email)) return json({ error: 'Correo no válido' }, 400)
      const errPass = passwordValida(password)
      if (errPass) return json({ error: errPass }, 400)

      const existenteId = await buscarUserId(email)
      if (existenteId) return json({ ok: true, user_id: existenteId, existia: true })

      const { data: nuevo, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { debe_cambiar_password: true },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, user_id: nuevo.user.id, existia: false })
    }

    return json({ error: 'Acción no reconocida' }, 400)

  } catch (e) {
    // No filtramos el stack al cliente: solo al log del servidor.
    console.error('[admin-usuarios]', e)
    return json({ error: 'Ocurrió un error procesando la solicitud' }, 500)
  }
})
