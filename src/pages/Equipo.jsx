import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import {
  UserPlus, Shield, Trash2, Mail, Check, KeyRound, Copy, RefreshCw,
} from 'lucide-react';
import { LIMITES, EMAIL_RE, limpiarTexto, verificarPolitica } from '../utils/seguridad.js';

const PERMISOS = [
  { key: 'ver_finanzas',         label: 'Ver finanzas',         desc: 'Ingresos, gastos y utilidad' },
  { key: 'registrar_pagos',      label: 'Registrar abonos',     desc: 'Cobrar anticipos y liquidaciones' },
  { key: 'registrar_gastos',     label: 'Registrar gastos',     desc: 'Capturar egresos' },
  { key: 'eliminar_registros',   label: 'Eliminar registros',   desc: 'Borrar ventas, clientes y gastos' },
  { key: 'editar_configuracion', label: 'Editar configuración', desc: 'Logo, banco y términos' },
  { key: 'gestionar_equipo',     label: 'Gestionar equipo',     desc: 'Invitar y cambiar permisos' },
  { key: 'gestionar_nomina',     label: 'Gestionar nómina',     desc: 'Empleados, asistencia y pagos' },
  { key: 'gestionar_inventario', label: 'Gestionar inventario', desc: 'Materiales, proveedores y movimientos' },
  { key: 'gestionar_comercial',  label: 'Gestionar oportunidades', desc: 'Prospectos, embudo y seguimientos comerciales' },
  { key: 'gestionar_operaciones', label: 'Gestionar operación', desc: 'Tareas, metas, notas y gastos recurrentes' },
];

// Genera una contraseña temporal compatible con la validación del servidor.
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

export default function Equipo() {
  const { toast, confirmar } = useUI();
  const { negocioId, miembro: yo } = useNegocio();

  const [miembros, setMiembros] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generarPassword);
  const [enviando, setEnviando] = useState(false);
  const [credenciales, setCredenciales] = useState(null);

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    const { data, error } = await supabase.from('miembros').select('*')
      .eq('negocio_id', negocioId).order('created_at').limit(200);
    if (error) toast.error('No se pudo cargar el equipo: ' + error.message);
    setMiembros(data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  useEffect(() => { cargar(); }, [cargar]);

  const llamar = async (accion, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('admin-usuarios', {
      body: { accion, ...payload },
    });
    if (error) {
      const detalle = await error.context?.json?.().catch(() => null);
      throw new Error(detalle?.error || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const invitar = async (e) => {
    e.preventDefault();
    if (enviando) return;

    const mail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) return toast.error('Escribe un correo válido.');
    if (password.length < 10) return toast.error('La contraseña debe tener al menos 10 caracteres.');

    const bloqueo = verificarPolitica('crearCuenta');
    if (bloqueo) return toast.warn(bloqueo);

    setEnviando(true);
    try {
      const r = await llamar('crear_miembro', {
        email: mail,
        password,
        permisos: { registrar_gastos: true, registrar_pagos: true },
      });
      setCredenciales({ email: mail, password, existia: r.existia });
      setEmail('');
      setPassword(generarPassword());
      toast.ok(r.existia ? 'Cuenta existente vinculada al negocio.' : 'Cuenta creada.');
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const resetear = async (m) => {
    const ok = await confirmar({
      titulo: 'Restablecer contraseña',
      mensaje: `Se generará una contraseña temporal para ${m.email}.\nDeberá cambiarla al entrar.`,
      okTexto: 'Restablecer',
    });
    if (!ok) return;

    const nueva = generarPassword();
    try {
      await llamar('resetear_password', { miembro_id: m.id, password: nueva });
      setCredenciales({ email: m.email, password: nueva, reset: true });
      toast.ok('Contraseña restablecida.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const quitar = async (m) => {
    const ok = await confirmar({
      titulo: 'Eliminar miembro',
      mensaje: `${m.email}\n\nSe borrará su acceso y su cuenta permanentemente.`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    try {
      const r = await llamar('eliminar_miembro', { miembro_id: m.id });
      if (r.aviso) toast.warn(r.aviso);
      else toast.ok('Miembro eliminado.');
      cargar();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const togglePermiso = async (m, key) => {
    const nuevos = { ...(m.permisos || {}), [key]: !m.permisos?.[key] };

      // Actualiza la fila de inmediato mientras se guarda el permiso.
    setMiembros(prev => prev.map(x => (x.id === m.id ? { ...x, permisos: nuevos } : x)));

    const { error } = await supabase.from('miembros').update({ permisos: nuevos }).eq('id', m.id);
    if (error) {
      // Si falla el guardado, se restaura el valor mostrado en la tabla.
      toast.error('No se pudo cambiar el permiso: ' + error.message);
      cargar();
    }
  };

  const copiar = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast.ok('Copiado.');
    } catch {
      toast.warn('Tu navegador bloqueó el portapapeles. Copia el texto manualmente.');
    }
  };

  const inputCls = 'w-full p-3 pl-9 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Shield className="text-primario" /> Equipo y permisos
        </h2>
        <p className="text-slate-500 font-medium">La cuenta se crea automáticamente</p>
      </div>

      {/* Credenciales generadas */}
      {credenciales && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 space-y-3">
          <p className="font-black text-emerald-800 uppercase text-xs tracking-widest">
            {credenciales.reset ? '🔑 Contraseña restablecida'
              : credenciales.existia ? '✅ Cuenta existente vinculada' : '✅ Cuenta creada'}
          </p>

          {credenciales.existia && !credenciales.reset ? (
            <p className="text-sm text-emerald-700 font-medium">
              Esa persona ya tenía cuenta. Conserva su contraseña actual; solo se le
              dio acceso a este negocio.
            </p>
          ) : (
            <>
              <p className="text-sm text-emerald-700 font-medium">
                Comparte estos datos. Al entrar se le pedirá crear su propia contraseña.
              </p>
              <div className="bg-white rounded-2xl p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate"><b>Correo:</b> {credenciales.email}</span>
                  <button onClick={() => copiar(credenciales.email)} aria-label="Copiar correo"
                    className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={14} /></button>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="break-all"><b>Contraseña:</b> {credenciales.password}</span>
                  <button onClick={() => copiar(credenciales.password)} aria-label="Copiar contraseña"
                    className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={14} /></button>
                </div>
              </div>
            </>
          )}

          <button onClick={() => setCredenciales(null)}
            className="text-xs font-black text-emerald-700 hover:underline uppercase">
            Ya la compartí, ocultar
          </button>
        </div>
      )}

      {/* Alta */}
      <form onSubmit={invitar} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <UserPlus size={18} /> Agregar persona
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="email" value={email} required maxLength={LIMITES.correo}
              onChange={(e) => setEmail(limpiarTexto(e.target.value, LIMITES.correo))}
              placeholder="correo@ejemplo.com" className={inputCls} />
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
          Mínimo 10 caracteres combinando letras y números. Es temporal: al entrar
          se le pedirá definir la suya.
        </p>

        <button disabled={enviando}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition">
          {enviando ? 'Creando cuenta...' : 'Crear cuenta y agregar'}
        </button>
      </form>

      {/* Miembros */}
      <div className="space-y-4">
        {miembros.map(m => {
          const esD = m.rol === 'dueno';
          const soyYo = m.user_id === yo?.user_id;
          return (
            <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-800 truncate">{m.email}</h4>
                    {soyYo && (
                      <span className="text-[9px] font-black bg-primario-suave text-primario-dark px-2 py-0.5 rounded-md uppercase">
                        Tú
                      </span>
                    )}
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                      esD ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {esD ? 'Dueño' : 'Empleado'}
                    </span>
                  </div>
                </div>

                {!esD && !soyYo && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => resetear(m)} title="Restablecer contraseña"
                      aria-label="Restablecer contraseña"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-primario hover:bg-primario-suave rounded-xl transition">
                      <KeyRound size={18} />
                    </button>
                    <button onClick={() => quitar(m)} title="Eliminar" aria-label="Eliminar miembro"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              {esD ? (
                <p className="text-sm text-slate-400 font-medium bg-slate-50 p-4 rounded-2xl flex items-center gap-2">
                  <Check size={16} className="text-emerald-500 shrink-0" />
                  El dueño tiene todos los permisos siempre.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PERMISOS.map(p => {
                    const activo = m.permisos?.[p.key] === true;
                    return (
                      <button key={p.key} disabled={soyYo}
                        onClick={() => !soyYo && togglePermiso(m, p.key)}
                        aria-pressed={activo}
                        className={`text-left p-4 rounded-2xl border transition ${
                          soyYo ? 'opacity-50 cursor-not-allowed' : ''} ${
                          activo ? 'bg-primario-suave border-primario' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold text-sm ${activo ? 'text-primario-dark' : 'text-slate-600'}`}>
                            {p.label}
                          </span>
                          <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition shrink-0 ${
                            activo ? 'bg-primario justify-end' : 'bg-slate-300 justify-start'}`}>
                            <div className="w-4 h-4 bg-white rounded-full shadow" />
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
