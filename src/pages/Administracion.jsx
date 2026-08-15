import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import {
  Building2, Plus, Trash2, Pencil, CheckCircle2, ShieldAlert,
  Mail, KeyRound, RefreshCw, Copy, Crown, ShieldCheck, Check, X,
} from 'lucide-react';
import { LIMITES, EMAIL_RE, limpiarTexto, textoParaGuardar, verificarPolitica } from '../utils/seguridad.js';

// Contraseña temporal con letras mayúsculas, minúsculas y números.
const generarPassword = () => {
  const mays = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const mins = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const todo = mays + mins + nums;
  const azar = (s) => s[Math.floor(Math.random() * s.length)];
  const base = [azar(mays), azar(mins), azar(nums), azar(nums)];
  while (base.length < 14) base.push(azar(todo));
  return base.sort(() => Math.random() - 0.5).join('');
};

const inputCls = 'w-full p-3 pl-9 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

function Credenciales({ datos, onCerrar, onCopiar }) {
  if (!datos) return null;

  // Las cuentas existentes conservan su contraseña al vincularlas a un negocio.
  const sinPassword = datos.existia && !datos.reset && !datos.password;

  return (
    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 space-y-3">
      <p className="font-black text-emerald-800 uppercase text-xs tracking-widest">
        {datos.reset ? '🔑 Contraseña restablecida'
          : datos.existia ? '✅ Cuenta existente vinculada' : '✅ Cuenta creada'}
      </p>

      {sinPassword ? (
        <p className="text-sm text-emerald-700 font-medium">
          Ese correo ya tenía cuenta en el sistema. Conserva su contraseña actual;
          solo se le asignó este negocio. Si la olvidó, usa el botón de restablecer.
        </p>
      ) : (
        <>
          <p className="text-sm text-emerald-700 font-medium">
            Comparte estos datos{datos.negocio ? ` con ${datos.negocio}` : ''}. Al entrar
            se le pedirá crear su propia contraseña.
          </p>
          <div className="bg-white rounded-2xl p-4 space-y-2 font-mono text-sm">
            <div className="flex justify-between items-center gap-2">
              <span className="truncate"><b>Correo:</b> {datos.email}</span>
              <button onClick={() => onCopiar(datos.email)} aria-label="Copiar correo"
                className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={14} /></button>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="break-all"><b>Contraseña:</b> {datos.password}</span>
              <button onClick={() => onCopiar(datos.password)} aria-label="Copiar contraseña"
                className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={14} /></button>
            </div>
          </div>
        </>
      )}

      <button onClick={onCerrar} className="text-xs font-black text-emerald-700 hover:underline uppercase">
        Ya la compartí, ocultar
      </button>
    </div>
  );
}

export default function Administracion() {
  const { esSuperAdmin } = useNegocio();
  const { toast, confirmar } = useUI();

  const [tab, setTab] = useState('negocios');
  const [negocios, setNegocios] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [credenciales, setCredenciales] = useState(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generarPassword);
  const [cargando, setCargando] = useState(false);

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState(generarPassword);
  const [creandoAdmin, setCreandoAdmin] = useState(false);

  // Renombrar sin window.prompt (Safari/iOS lo bloquea y no valida nada).
  const [renombrando, setRenombrando] = useState(null);   // { id, valor }

  const cargar = useCallback(async () => {
    const [n, a] = await Promise.all([
      supabase.rpc('admin_listar_negocios'),
      supabase.rpc('admin_listar_super_admins'),
    ]);
    if (!n.error) setNegocios(n.data || []);
    if (!a.error) setAdmins(a.data || []);
  }, []);

  useEffect(() => { if (esSuperAdmin) cargar(); }, [esSuperAdmin, cargar]);

  const llamar = async (accion, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('admin-usuarios', {
      body: { accion, ...payload },
    });
    if (error) {
      const detalle = await error.context?.json?.().catch(() => null);
      throw Object.assign(new Error(detalle?.error || error.message), detalle || {});
    }
    if (data?.error) throw Object.assign(new Error(data.error), data);
    return data;
  };

  const copiar = async (t) => {
    try { await navigator.clipboard.writeText(t); toast.ok('Copiado al portapapeles.'); }
    catch { toast.warn('Tu navegador bloqueó el portapapeles.'); }
  };

  if (!esSuperAdmin) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center max-w-md">
          <ShieldAlert className="mx-auto text-rose-400 mb-4" size={40} />
          <h3 className="font-black text-slate-800 uppercase">Acceso denegado</h3>
          <p className="text-slate-500 text-sm mt-2">
            Esta sección es solo para administradores del sistema.
          </p>
        </div>
      </div>
    );
  }

  /* ══════ Negocios ══════ */
  const crearNegocio = async (e) => {
    e.preventDefault();
    if (cargando) return;

    const nom = textoParaGuardar(nombre, LIMITES.nombreNegocio);
    const mail = email.trim().toLowerCase();

    if (nom.length < 2) return toast.error('Escribe el nombre del negocio.');
    if (!EMAIL_RE.test(mail)) return toast.error('Escribe un correo válido.');
    if (password.length < 10) return toast.error('La contraseña debe tener al menos 10 caracteres.');

    const bloqueo = verificarPolitica('crearCuenta');
    if (bloqueo) return toast.warn(bloqueo);

    setCargando(true);
    try {
      const r = await llamar('crear_negocio', { nombre: nom, email: mail, password });
      setCredenciales({
        negocio: nom,
        email: mail,
        // Solo mostramos la contraseña si de verdad se aplicó a la cuenta.
        password: r.password_aplicada ? password : null,
        existia: r.existia,
      });
      setNombre(''); setEmail(''); setPassword(generarPassword());
      toast.ok('Negocio creado correctamente.');
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  const guardarNombre = async () => {
    const nuevo = textoParaGuardar(renombrando.valor, LIMITES.nombreNegocio);
    if (nuevo.length < 2) return toast.error('El nombre debe tener al menos 2 caracteres.');

    const { error } = await supabase.rpc('admin_renombrar_negocio', {
      p_id: renombrando.id, p_nombre: nuevo,
    });
    if (error) return toast.error('No se pudo renombrar: ' + error.message);
    toast.ok('Nombre actualizado.');
    setRenombrando(null);
    cargar();
  };

  const resetearDueno = async (n) => {
    if (!n.dueno_miembro_id) return toast.warn('Ese negocio no tiene dueño asignado.');
    const ok = await confirmar({
      titulo: 'Restablecer contraseña',
      mensaje: `Se generará una contraseña temporal para ${n.dueno}.\nDeberá cambiarla al entrar.`,
      okTexto: 'Restablecer',
    });
    if (!ok) return;

    const nueva = generarPassword();
    try {
      await llamar('resetear_password', { miembro_id: n.dueno_miembro_id, password: nueva });
      setCredenciales({ negocio: n.nombre, email: n.dueno, password: nueva, reset: true });
      toast.ok('Contraseña restablecida.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const eliminarNegocio = async (n) => {
    const ok = await confirmar({
      titulo: 'Eliminar negocio',
      mensaje: `"${n.nombre}"\n\nSe borrarán sus clientes, ventas, gastos y las cuentas de sus miembros.`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;

    try {
      await llamar('eliminar_negocio', { negocio_id: n.negocio_id });
      toast.ok('Negocio eliminado.');
      cargar();
    } catch (err) {
      if (err.requiere_confirmacion) {
        const ok2 = await confirmar({
          titulo: 'Este negocio tiene datos',
          mensaje: `${err.message}\n\n¿Borrar TODO de forma permanente?`,
          okTexto: 'Borrar todo', peligro: true,
        });
        if (!ok2) return;
        try {
          await llamar('eliminar_negocio', { negocio_id: n.negocio_id, forzar: true });
          toast.ok('Negocio eliminado.');
          cargar();
        } catch (e2) { toast.error(e2.message); }
      } else {
        toast.error(err.message);
      }
    }
  };

  /* ══════ Administradores ══════ */
  const agregarAdmin = async (e) => {
    e.preventDefault();
    if (creandoAdmin) return;

    const mail = adminEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) return toast.error('Escribe un correo válido.');
    if (adminPass.length < 10) return toast.error('La contraseña debe tener al menos 10 caracteres.');

    setCreandoAdmin(true);
    try {
      const r = await llamar('crear_cuenta', { email: mail, password: adminPass });
      const { error } = await supabase.rpc('admin_agregar_super_admin', { p_email: mail });
      if (error) throw new Error(error.message);

      if (!r.existia) setCredenciales({ email: mail, password: adminPass, existia: false });
      setAdminEmail(''); setAdminPass(generarPassword());
      toast.ok(`${mail} ahora es administrador del sistema.`);
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreandoAdmin(false);
    }
  };

  const quitarAdmin = async (a) => {
    const ok = await confirmar({
      titulo: 'Quitar administrador',
      mensaje: `${a.email} perderá el acceso al panel de Administración.\n\nSu cuenta y su negocio no se tocan.`,
      okTexto: 'Quitar privilegios', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('admin_quitar_super_admin', { p_user_id: a.user_id });
    if (error) return toast.error('No se pudo quitar: ' + error.message);
    toast.ok('Privilegios retirados.');
    cargar();
  };

  const TABS = [
    { id: 'negocios', label: `Negocios (${negocios.length})`, icon: Building2 },
    { id: 'admins',   label: `Administradores (${admins.length})`, icon: Crown },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Building2 className="text-primario" /> Administración
        </h2>
        <p className="text-slate-500 font-medium text-sm">Control global del sistema</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wide transition ${
                on ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <Credenciales datos={credenciales} onCerrar={() => setCredenciales(null)} onCopiar={copiar} />

      {/* ══ NEGOCIOS ══ */}
      {tab === 'negocios' && (
        <div className="space-y-6">
          <form onSubmit={crearNegocio} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Plus size={18} /> Nuevo negocio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={nombre} required maxLength={LIMITES.nombreNegocio}
                  onChange={(e) => setNombre(limpiarTexto(e.target.value, LIMITES.nombreNegocio))}
                  placeholder="Nombre del negocio" className={inputCls} />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="email" value={email} required maxLength={LIMITES.correo}
                  onChange={(e) => setEmail(limpiarTexto(e.target.value, LIMITES.correo))}
                  placeholder="correo del dueño" className={inputCls} />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={password} required maxLength={LIMITES.password}
                  onChange={(e) => setPassword(e.target.value.slice(0, LIMITES.password))}
                  className={`${inputCls} pr-11 font-mono`} />
                <button type="button" onClick={() => setPassword(generarPassword())}
                  title="Generar otra" aria-label="Generar otra contraseña"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primario">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <p className="text-[10px] font-bold text-slate-400">
              Si el correo ya tiene cuenta, se vincula al negocio y conserva su
              contraseña actual: no se la sobrescribimos.
            </p>

            <button disabled={cargando}
              className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition">
              {cargando ? 'Creando...' : 'Crear negocio y cuenta'}
            </button>
          </form>

          <div className="space-y-3">
            {negocios.map(n => (
              <div key={n.negocio_id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-800 text-lg truncate">{n.nombre}</h4>
                    {n.dueno ? (
                      <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                        <CheckCircle2 size={13} /> {n.dueno}
                      </p>
                    ) : (
                      <p className="text-xs font-bold text-rose-500 mt-1">Sin dueño asignado</p>
                    )}
                    <p className="text-[11px] font-bold text-slate-400 mt-1">
                      {n.miembros} miembro(s) · {n.clientes} cliente(s) · {n.ventas} venta(s)
                    </p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => resetearDueno(n)} title="Restablecer contraseña del dueño"
                      aria-label="Restablecer contraseña del dueño"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition">
                      <KeyRound size={16} />
                    </button>
                    <button onClick={() => setRenombrando({ id: n.negocio_id, valor: n.nombre })}
                      title="Renombrar" aria-label="Renombrar negocio"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-primario hover:bg-primario-suave rounded-xl transition">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => eliminarNegocio(n)} title="Eliminar" aria-label="Eliminar negocio"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {renombrando?.id === n.negocio_id && (
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <input value={renombrando.valor} maxLength={LIMITES.nombreNegocio} autoFocus
                      onChange={(e) => setRenombrando({ ...renombrando, valor: limpiarTexto(e.target.value, LIMITES.nombreNegocio) })}
                      onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                      className="flex-1 min-w-[180px] p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                    <button onClick={guardarNombre}
                      className="px-4 min-h-[44px] bg-primario text-white rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5">
                      <Check size={14} /> Guardar
                    </button>
                    <button onClick={() => setRenombrando(null)} aria-label="Cancelar"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:bg-slate-200 rounded-xl">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ ADMINISTRADORES ══ */}
      {tab === 'admins' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-800 text-sm">Máximo privilegio</p>
              <p className="text-[11px] font-bold text-amber-700 leading-snug mt-0.5">
                Un administrador puede crear y eliminar negocios completos, restablecer
                contraseñas de cualquier dueño y nombrar a otros administradores. Dalo
                solo a gente de total confianza.
              </p>
            </div>
          </div>

          <form onSubmit={agregarAdmin} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Crown size={18} /> Nombrar administrador
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="email" value={adminEmail} required maxLength={LIMITES.correo}
                  onChange={(e) => setAdminEmail(limpiarTexto(e.target.value, LIMITES.correo))}
                  placeholder="correo@ejemplo.com" className={inputCls} />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={adminPass} required maxLength={LIMITES.password}
                  onChange={(e) => setAdminPass(e.target.value.slice(0, LIMITES.password))}
                  className={`${inputCls} pr-11 font-mono`} />
                <button type="button" onClick={() => setAdminPass(generarPassword())}
                  title="Generar otra" aria-label="Generar otra contraseña"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primario">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <p className="text-[10px] font-bold text-slate-400">
              Si el correo ya tiene cuenta, solo se le dan los privilegios. Si no, se
              crea con esa contraseña temporal.
            </p>

            <button disabled={creandoAdmin}
              className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition">
              {creandoAdmin ? 'Procesando...' : 'Nombrar administrador'}
            </button>
          </form>

          <div className="space-y-3">
            {admins.map(a => (
              <div key={a.user_id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-amber-50 text-amber-500 p-3 rounded-2xl shrink-0"><Crown size={20} /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-800 truncate">{a.email}</h4>
                      {a.soy_yo && (
                        <span className="text-[9px] font-black bg-primario-suave text-primario-dark px-2 py-0.5 rounded-md uppercase">
                          Tú
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">
                      Administrador desde {new Date(a.creado).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
                {!a.soy_yo && (
                  <button onClick={() => quitarAdmin(a)} title="Quitar privilegios"
                    aria-label="Quitar privilegios"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition shrink-0">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
