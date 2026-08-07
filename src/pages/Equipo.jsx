import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { UserPlus, Shield, Trash2, Mail, Check, Clock } from 'lucide-react';

const PERMISOS = [
  { key: 'ver_finanzas',         label: 'Ver Finanzas',        desc: 'Acceso a ingresos, gastos y utilidad' },
  { key: 'registrar_gastos',     label: 'Registrar gastos',    desc: 'Capturar egresos del negocio' },
  { key: 'eliminar_registros',   label: 'Eliminar registros',  desc: 'Borrar ventas, clientes y gastos' },
  { key: 'editar_configuracion', label: 'Editar configuración',desc: 'Logo, datos bancarios y términos' },
  { key: 'gestionar_equipo',     label: 'Gestionar equipo',    desc: 'Invitar y cambiar permisos' },
];

export default function Equipo() {
  const { negocioId, miembro: yo } = useNegocio();
  const [miembros, setMiembros] = useState([]);
  const [invitaciones, setInvitaciones] = useState([]);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    const { data: m } = await supabase.from('miembros').select('*').order('created_at');
    const { data: i } = await supabase.from('invitaciones').select('*').eq('usada', false);
    setMiembros(m || []);
    setInvitaciones(i || []);
  };
  useEffect(() => { cargar(); }, []);

    const invitar = async (e) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(mail)) return alert('Correo no válido');

    setEnviando(true);
    const { data, error } = await supabase.rpc('invitar_o_unir', {
      p_email: mail,
      p_rol: 'empleado',
      p_permisos: { ver_finanzas: false, registrar_gastos: true },
    });
    setEnviando(false);

    if (error) return alert('Error: ' + error.message);

    setEmail('');
    cargar();

    if (data === 'UNIDO') {
      alert(`✅ ${mail} ya tenía cuenta y quedó vinculado al negocio.\nAjusta sus permisos abajo.`);
    } else if (data === 'YA_ES_MIEMBRO') {
      alert('Esa persona ya es miembro de tu negocio.');
    } else {
      alert(`Invitación creada para ${mail}.\n\nAhora crea su cuenta en Supabase → Authentication → Add user con ESE mismo correo. Se vinculará automáticamente.`);
    }
  };

  const togglePermiso = async (m, key) => {
    const nuevos = { ...(m.permisos || {}), [key]: !m.permisos?.[key] };
    await supabase.from('miembros').update({ permisos: nuevos }).eq('id', m.id);
    cargar();
  };

  const quitar = async (m) => {
    if (!window.confirm(`¿Quitar a ${m.email} del negocio? Perderá el acceso.`)) return;
    await supabase.from('miembros').delete().eq('id', m.id);
    cargar();
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Shield className="text-blue-600" /> Equipo y Permisos
        </h2>
        <p className="text-slate-500 font-medium">Controla qué puede hacer cada persona en tu negocio</p>
      </div>

      {/* Invitar */}
      <form onSubmit={invitar} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><UserPlus size={18}/> Invitar persona</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full p-3 pl-9 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10" />
          </div>
          <button disabled={enviando}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50">
            {enviando ? 'Creando...' : 'Invitar'}
          </button>
        </div>
      </form>

      {invitaciones.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
          <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-3">Invitaciones pendientes</p>
          {invitaciones.map(i => (
            <div key={i.id} className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <Clock size={14}/> {i.email}
            </div>
          ))}
          <p className="text-[11px] text-amber-700 mt-3 font-medium">
            Crea su cuenta en Supabase → Authentication → Add user con ese correo. Se vinculará solo.
          </p>
        </div>
      )}

      {/* Miembros */}
      <div className="space-y-4">
        {miembros.map(m => {
          const esDueno = m.rol === 'dueno';
          const soyYo = m.user_id === yo?.user_id;
          return (
            <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-slate-800 truncate">{m.email}</h4>
                    {soyYo && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md uppercase">Tú</span>}
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${esDueno ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {esDueno ? 'Dueño' : 'Empleado'}
                    </span>
                  </div>
                </div>
                {!esDueno && (
                  <button onClick={() => quitar(m)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl">
                    <Trash2 size={18}/>
                  </button>
                )}
              </div>

              {esDueno ? (
                <p className="text-sm text-slate-400 font-medium bg-slate-50 p-4 rounded-2xl flex items-center gap-2">
                  <Check size={16} className="text-emerald-500"/> El dueño tiene todos los permisos siempre.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {PERMISOS.map(p => {
                    const activo = m.permisos?.[p.key] === true;
                    return (
                      <button key={p.key} onClick={() => togglePermiso(m, p.key)}
                        className={`text-left p-4 rounded-2xl border transition ${activo ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold text-sm ${activo ? 'text-blue-700' : 'text-slate-600'}`}>{p.label}</span>
                          <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition ${activo ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                            <div className="w-4 h-4 bg-white rounded-full shadow"/>
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