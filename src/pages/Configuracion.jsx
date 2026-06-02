import React, { useState, useEffect } from 'react';
import { Save, User, FileText, CheckCircle2, Layout } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

export default function Configuracion({ session }) {
  const [config, setConfig] = useState({
    nombre: '',
    especialidad: '',
    direccion: '',
    telefono: '',
    titulo_documento: 'PRESUPUESTO',
    logo: null,
    pie_sidebar: '2026'
  });

  const [notificacion, setNotificacion] = useState(false);
  const [cargando, setCargando] = useState(false);
  const LOGO_PREDETERMINADO = "https://cdn-icons-png.flaticon.com/512/2906/2906206.png";

  useEffect(() => {
    // Cargar la configuración del usuario logueado desde la nube
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from('configuracion')
        .select('*')
        .eq('user_id', session.user.id)
        .single(); // Trae un solo registro, ya que user_id es único

      if (data && !error) {
        setConfig(data);
      }
    };
    fetchConfig();
  }, [session.user.id]);

  const seleccionarTodo = (e) => e.target.select();

  const manejarLogo = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setConfig({ ...config, logo: reader.result });
      reader.readAsDataURL(file); // Guarda la imagen en formato base64
    }
  };

  const guardarConfiguracion = async () => {
    setCargando(true);
    try {
      // upsert: Si ya existe lo actualiza, si no existe lo crea
      const { error } = await supabase
        .from('configuracion')
        .upsert({
          user_id: session.user.id,
          nombre: config.nombre,
          especialidad: config.especialidad,
          direccion: config.direccion,
          telefono: config.telefono,
          titulo_documento: config.titulo_documento,
          pie_sidebar: config.pie_sidebar,
          logo: config.logo
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setNotificacion(true);
      setTimeout(() => setNotificacion(false), 3000);
    } catch (error) {
      alert("Error al guardar: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-6 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 uppercase tracking-tighter italic text-blue-600">Configuración</h2>
          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Gestión de identidad y sistema en la nube</p>
        </div>
        <button 
          onClick={guardarConfiguracion} 
          disabled={cargando}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50 w-full md:w-auto justify-center"
        >
          <Save size={20}/> {cargando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {notificacion && (
        <div className="fixed top-8 right-8 bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-right">
          <CheckCircle2 size={24}/> ACTUALIZADO
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-6">Logo Corporativo</h3>
            <div className="flex flex-col items-center p-6 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50">
              <img src={config.logo || LOGO_PREDETERMINADO} alt="Logo" className="h-28 w-28 object-contain mb-6 drop-shadow-md rounded-2xl bg-white p-3" />
              <div className="flex gap-2">
                <label className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase cursor-pointer hover:border-blue-500 transition-all">
                  Cargar <input type="file" className="hidden" onChange={manejarLogo} accept="image/*" />
                </label>
                {config.logo && (
                  <button onClick={() => setConfig({...config, logo: null})} className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-rose-100 transition-all">
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-4 flex items-center gap-2"><Layout size={16}/> Interfaz Sidebar</h3>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Texto del Pie</label>
            <input 
              className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              placeholder="Ej. 2026"
              value={config.pie_sidebar}
              onChange={(e) => setConfig({...config, pie_sidebar: e.target.value})}
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-8 flex items-center gap-2"><User size={16}/> Perfil del Emisor (PDF)</h3>
            <div className="space-y-4">
              <input className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-800 outline-none" placeholder="Nombre de la Empresa" value={config.nombre} onChange={(e) => setConfig({...config, nombre: e.target.value})} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-800 outline-none" placeholder="Teléfono" value={config.telefono} onChange={(e) => setConfig({...config, telefono: e.target.value})} />
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-800 outline-none h-20 resize-none col-span-1 md:col-span-2" placeholder="Dirección" value={config.direccion} onChange={(e) => setConfig({...config, direccion: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-3xl shadow-xl">
            <h3 className="font-black text-white uppercase text-[10px] tracking-[0.2em] mb-8 flex items-center gap-2"><FileText size={16}/> Parámetros PDF</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-black text-white outline-none" placeholder="Título Documento" value={config.titulo_documento} onChange={(e) => setConfig({...config, titulo_documento: e.target.value.toUpperCase()})} onFocus={seleccionarTodo} />
              <input className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-black text-white outline-none" placeholder="Especialidad" value={config.especialidad} onChange={(e) => setConfig({...config, especialidad: e.target.value.toUpperCase()})} onFocus={seleccionarTodo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}