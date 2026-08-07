import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { UserPlus, Shield, Trash2, Mail, Check, KeyRound, Copy, RefreshCw } from 'lucide-react';

const PERMISOS = [
  { key: 'ver_finanzas',         label: 'Ver Finanzas',         desc: 'Ingresos, gastos y utilidad' },
  { key: 'registrar_gastos',     label: 'Registrar gastos',     desc: 'Capturar egresos' },
  { key: 'eliminar_registros',   label: 'Eliminar registros',   desc: 'Borrar ventas, clientes y gastos' },
  { key: 'editar_configuracion', label: 'Editar configuración', desc: 'Logo, banco y términos' },
  { key: 'gestionar_equipo',     label: 'Gestionar equipo',     desc: 'Invitar y cambiar permisos' },
];

const generarPassword = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
};

export default function Equipo() {
  const { negocioId, miembro: yo, esDueno } = useNegocio();
  const [miembros, setMiembros] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generarPassword());
  const [enviando, setEnviando] = useState(false);
  const [credenciales, setCredenciales] = useState(null);

  const cargar = async () => {
    if (!negocioId) return;
    const { data } = await supabase.from('miembros').select('*')
      .eq('negocio_id', negocioId).order('created_at');
    setMiembros(data || []);
  };
  useEffect(() => { cargar(); }, [negocioId]);

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
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(mail)) return alert('Correo no válido');
    if (password.length < 8) return alert('La contraseña debe tener al menos 8 caracteres');

    setEnviando(true);
    try {
      const r = await llamar('crear_miembro', {
        email: mail, password, permisos: { registrar_gastos: true },
      });
      setCredenciales({ email: mail, password, existia: r.existia });
      setEmail(''); setPassword(generarPassword());
      cargar();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setEnviando(false); }
  };

  const resetear = async (m) => {
    const nueva = generarPassword();
    if (!window.confirm(`¿Asignar una contraseña temporal a ${m.email}?\n\nDeberá cambiarla al entrar.`)) return;
    try {
      await llamar('resetear_password', { miembro_id: m.id, password: nueva });
      setCredenciales({ email: m.email, password: nueva, reset: true });
    } catch (err) { alert('Error: ' + err.message); }
  };

  const quitar = async (m) => {
    if (!window.confirm(`¿Eliminar a ${m.email}?\n\nSe borrará su acceso y su cuenta permanentemente.`)) return;
    try {
      const r = await llamar('eliminar_miembro', { miembro_id: m.id });
      if (r.aviso) alert(r.aviso);
      cargar();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const togglePermiso = async (m, key) => {
    const nuevos = { ...(m.permisos || {}), [key]: !m.permisos?.[key] };
    const { error } = await supabase.from('miembros').update({ permisos: nuevos }).eq('id', m.id);
    if (error) return alert(error.message);
    cargar();
  };

  const copiar = (txt) => {
    navigator.clipboard.writeText(txt);
    alert('Copiado al portapapeles');
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Shield className="text-blue-600" /> Equipo y Permisos
        </h2>
        <p className="text-slate-500 font-medium">La cuenta se crea automáticamente</p>
      </div>

      {/* Credenciales generadas */}
      {credenciales && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 space-y-3">
          <p className="font-black text-emerald-800 uppercase text-xs tracking-widest">
            {credenciales.reset ? '🔑 Contraseña restablecida' : credenciales.existia ? '✅ Cuenta vinculada' : '✅ Cuenta creada'}
          </p>
          <p className="text-sm text-emerald-700 font-medium">
            Comparte estos datos. Al entrar, se le pedirá crear su propia contraseña.
          </p>
          <div className="bg-white rounded-2xl p-4 space-y-2 font-mono text-sm">
            <div className="flex justify-between items-center gap-2">
              <span className="truncate"><b>Correo:</b> {credenciales.email}</span>
              <button onClick={() => copiar(credenciales.email)} className="text-slate-400 hover:text-slate-700"><Copy size={14} /></button>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span><b>Contraseña:</b> {credenciales.password}</span>
              <button onClick={() => copiar(credenciales.password)} className="text-slate-400 hover:text-slate-700"><Copy size={14} /></button>
            </div>
          </div>
          <button onClick={() => setCredenciales(null)}
            className="text-xs font-black text-emerald-700 hover:underline uppercase">
            Ya la compartí, ocultar
          </button>
        </div>
      )}

      {/* Alta */}
      <form onSubmit={invitar} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><UserPlus size={18} /> Agregar persona</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="correo@ejemplo.com"
              className="w-full p-3 pl-9 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full p-3 pl-9 pr-11 bg-slate-50 border border-slate-100 rounded-xl font-bold font-mono outline-none" />
            <button type="button" onClick={() => setPassword(generarPassword())} title="Generar otra"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <button disabled={enviando}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50">
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
                    {soyYo && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md uppercase">Tú</span>}
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${esD ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {esD ? 'Dueño' : 'Empleado'}
                    </span>
                  </div>
                </div>
                {!esD && !soyYo && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => resetear(m)} title="Restablecer contraseña"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl"><KeyRound size={18} /></button>
                    <button onClick={() => quitar(m)} title="Eliminar"
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                  </div>
                )}
              </div>

              {esD ? (
                <p className="text-sm text-slate-400 font-medium bg-slate-50 p-4 rounded-2xl flex items-center gap-2">
                  <Check size={16} className="text-emerald-500" /> El dueño tiene todos los permisos siempre.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PERMISOS.map(p => {
                    const activo = m.permisos?.[p.key] === true;
                    return (
                      <button key={p.key} disabled={soyYo}
                        onClick={() => !soyYo && togglePermiso(m, p.key)}
                        className={`text-left p-4 rounded-2xl border transition ${soyYo ? 'opacity-50 cursor-not-allowed' : ''} ${
                          activo ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold text-sm ${activo ? 'text-blue-700' : 'text-slate-600'}`}>{p.label}</span>
                          <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition ${activo ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
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