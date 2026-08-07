import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { Building2, Plus, Trash2, Pencil, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function Administracion() {
  const { esSuperAdmin } = useNegocio();
  const [negocios, setNegocios] = useState([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    const { data, error } = await supabase.rpc('admin_listar_negocios');
    if (!error) setNegocios(data || []);
  };
  useEffect(() => { if (esSuperAdmin) cargar(); }, [esSuperAdmin]);

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
    const { data, error } = await supabase.rpc('admin_crear_negocio', {
      p_nombre: nombre, p_email_dueno: email,
    });
    setCargando(false);
    if (error) return setMsg({ tipo: 'error', texto: error.message });

    setMsg(data.estado === 'ACTIVO'
      ? { tipo: 'ok', texto: `Negocio creado. ${email} ya es dueño y puede entrar.` }
      : { tipo: 'pend', texto: `Negocio creado. Ahora crea la cuenta de ${email} en Supabase → Authentication → Add user (con Auto Confirm). Al crearse quedará como dueño automáticamente.` });
    setNombre(''); setEmail(''); cargar();
  };

  const renombrar = async (n) => {
    const nuevo = window.prompt('Nuevo nombre:', n.nombre);
    if (!nuevo?.trim()) return;
    const { error } = await supabase.rpc('admin_renombrar_negocio', { p_id: n.negocio_id, p_nombre: nuevo });
    if (error) alert(error.message); else cargar();
  };

  const eliminar = async (n) => {
    if (!window.confirm(`¿Eliminar "${n.nombre}"? Se borrarán sus clientes y miembros.`)) return;
    const { error } = await supabase.rpc('admin_eliminar_negocio', { p_id: n.negocio_id });
    if (error) alert(error.message); else cargar();
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Building2 className="text-blue-600" /> Administración
        </h2>
        <p className="text-slate-500 font-medium">Gestión global de negocios</p>
      </div>

      <form onSubmit={crear} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Plus size={18} /> Nuevo negocio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
            placeholder="Nombre del negocio"
            className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email"
            placeholder="correo del dueño"
            className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
        </div>
        <button disabled={cargando}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50">
          {cargando ? 'Creando...' : 'Crear negocio'}
        </button>

        {msg && (
          <div className={`text-xs font-bold p-4 rounded-xl border ${
            msg.tipo === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700'
            : msg.tipo === 'ok'  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {msg.texto}
          </div>
        )}
      </form>

      <div className="space-y-3">
        {negocios.map(n => (
          <div key={n.negocio_id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h4 className="font-black text-slate-800 text-lg truncate">{n.nombre}</h4>
              {n.dueno ? (
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                  <CheckCircle2 size={13} /> {n.dueno}
                </p>
              ) : (
                <p className="text-xs font-bold text-amber-600 flex items-center gap-1.5 mt-1">
                  <Clock size={13} /> Pendiente: {n.pendiente_email}
                </p>
              )}
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                {n.miembros} miembro(s) · {n.clientes} cliente(s) · {n.ventas} venta(s)
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => renombrar(n)} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl"><Pencil size={16} /></button>
              <button onClick={() => eliminar(n)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}