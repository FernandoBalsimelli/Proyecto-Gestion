import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import {
  Building2, Plus, Trash2, Pencil, CheckCircle2, ShieldAlert,
  Mail, KeyRound, RefreshCw, Copy
} from 'lucide-react';

const generarPassword = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
};

export default function Administracion() {
  const { esSuperAdmin } = useNegocio();
  const [negocios, setNegocios] = useState([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generarPassword());
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [credenciales, setCredenciales] = useState(null);

  const cargar = async () => {
    const { data, error } = await supabase.rpc('admin_listar_negocios');
    if (!error) setNegocios(data || []);
  };
  useEffect(() => { if (esSuperAdmin) cargar(); }, [esSuperAdmin]);

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

  if (!esSuperAdmin) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center max-w-md">
          <ShieldAlert className="mx-auto text-rose-400 mb-4" size={40} />
          <h3 className="font-black text-slate-800 uppercase">Acceso denegado</h3>
          <p className="text-slate-500 text-sm mt-2">Esta sección es solo para el administrador.</p>
        </div>
      </div>
    );
  }

  const crear = async (e) => {
    e.preventDefault();
    setCargando(true); setMsg(null);
    try {
      const r = await llamar('crear_negocio', {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setCredenciales({ negocio: nombre.trim(), email: email.trim().toLowerCase(), password, existia: r.existia });
      setNombre(''); setEmail(''); setPassword(generarPassword());
      cargar();
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.message });
    } finally { setCargando(false); }
  };

  const renombrar = async (n) => {
    const nuevo = window.prompt('Nuevo nombre:', n.nombre);
    if (!nuevo?.trim()) return;
    const { error } = await supabase.rpc('admin_renombrar_negocio', { p_id: n.negocio_id, p_nombre: nuevo });
    if (error) alert(error.message); else cargar();
  };

  const resetearDueno = async (n) => {
    if (!n.dueno_miembro_id) return alert('Ese negocio no tiene dueño asignado.');
    const nueva = generarPassword();
    if (!window.confirm(`¿Asignar contraseña temporal a ${n.dueno}?\n\nDeberá cambiarla al entrar.`)) return;
    try {
      await llamar('resetear_password', { miembro_id: n.dueno_miembro_id, password: nueva });
      setCredenciales({ negocio: n.nombre, email: n.dueno, password: nueva, reset: true });
    } catch (err) { alert('Error: ' + err.message); }
  };

  const eliminar = async (n) => {
    if (!window.confirm(`¿Eliminar "${n.nombre}"?\n\nSe borrarán sus clientes, ventas, gastos y las cuentas de sus miembros.`)) return;
    try {
      await llamar('eliminar_negocio', { negocio_id: n.negocio_id });
      cargar();
    } catch (err) {
      if (err.requiere_confirmacion) {
        if (!window.confirm(`${err.message}\n\n¿Borrar TODO de forma permanente?`)) return;
        try {
          await llamar('eliminar_negocio', { negocio_id: n.negocio_id, forzar: true });
          cargar();
        } catch (e2) { alert('Error: ' + e2.message); }
      } else alert('Error: ' + err.message);
    }
  };

  const copiar = (t) => { navigator.clipboard.writeText(t); alert('Copiado'); };

  const input = 'w-full p-3 pl-9 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Building2 className="text-blue-600" /> Administración
        </h2>
        <p className="text-slate-500 font-medium">Gestión global de negocios</p>
      </div>

      {/* Credenciales generadas */}
      {credenciales && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 space-y-3">
          <p className="font-black text-emerald-800 uppercase text-xs tracking-widest">
            {credenciales.reset ? '🔑 Contraseña restablecida'
              : credenciales.existia ? '✅ Cuenta existente vinculada' : '✅ Negocio y cuenta creados'}
          </p>
          <p className="text-sm text-emerald-700 font-medium">
            Comparte estos datos con <b>{credenciales.negocio}</b>. Al entrar se le pedirá crear su propia contraseña.
          </p>
          <div className="bg-white rounded-2xl p-4 space-y-2 font-mono text-sm">
            <div className="flex justify-between items-center gap-2">
              <span className="truncate"><b>Correo:</b> {credenciales.email}</span>
              <button onClick={() => copiar(credenciales.email)} className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={14} /></button>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span><b>Contraseña:</b> {credenciales.password}</span>
              <button onClick={() => copiar(credenciales.password)} className="text-slate-400 hover:text-slate-700 shrink-0"><Copy size={14} /></button>
            </div>
          </div>
          <button onClick={() => setCredenciales(null)}
            className="text-xs font-black text-emerald-700 hover:underline uppercase">
            Ya la compartí, ocultar
          </button>
        </div>
      )}

      {/* Alta */}
      <form onSubmit={crear} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Plus size={18} /> Nuevo negocio</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
              placeholder="Nombre del negocio" className={input} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="correo del dueño" className={input} />
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} required
              className={`${input} pr-11 font-mono`} />
            <button type="button" onClick={() => setPassword(generarPassword())} title="Generar otra"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <button disabled={cargando}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50">
          {cargando ? 'Creando...' : 'Crear negocio y cuenta'}
        </button>

        {msg && (
          <div className="text-xs font-bold p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-700">
            {msg.texto}
          </div>
        )}
      </form>

      {/* Listado */}
      <div className="space-y-3">
        {negocios.map(n => (
          <div key={n.negocio_id}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <div className="flex gap-2 shrink-0">
              <button onClick={() => resetearDueno(n)} title="Restablecer contraseña del dueño"
                className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl"><KeyRound size={16} /></button>
              <button onClick={() => renombrar(n)} title="Renombrar"
                className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl"><Pencil size={16} /></button>
              <button onClick={() => eliminar(n)} title="Eliminar"
                className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}