import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Save, Upload, Building, CreditCard, FileText, Settings, Image as ImageIcon } from 'lucide-react';

export default function Configuracion({ session }) {
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState({
    nombre: '', direccion: '', telefono: '', logo: null,
    banco: '', cuenta_nombre: '', cuenta_numero: '', condiciones: '',
    titulo_documento: 'FACTURA', especialidad: '', sitio_web: '',
    mostrar_firma: false, firma_base64: null
  });

  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase.from('configuracion').select('*').eq('user_id', session.user.id).single();
      if (data) setCfg(data);
    };
    loadConfig();
  }, []);

  const handleFileUpload = (e, field) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setCfg(prev => ({ ...prev, [field]: reader.result }));
    reader.readAsDataURL(file);
  };

  const saveConfig = async () => {
    setLoading(true);
    const { error } = await supabase.from('configuracion').upsert({ 
      user_id: session.user.id, 
      ...cfg 
    });
    if (error) alert("Error al guardar: " + error.message);
    else alert("Configuración guardada exitosamente");
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-black text-slate-800 uppercase flex items-center gap-3">
        <Settings className="text-blue-600" /> Configuración de Empresa
      </h2>

      {/* SECCIÓN DATOS EMPRESA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building size={18}/> Datos Generales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Nombre de la Empresa" value={cfg.nombre} onChange={(e) => setCfg({...cfg, nombre: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Título del Doc (ej. FACTURA)" value={cfg.titulo_documento} onChange={(e) => setCfg({...cfg, titulo_documento: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Especialidad / Giro" value={cfg.especialidad} onChange={(e) => setCfg({...cfg, especialidad: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Teléfono" value={cfg.telefono} onChange={(e) => setCfg({...cfg, telefono: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Sitio Web / Redes" value={cfg.sitio_web} onChange={(e) => setCfg({...cfg, sitio_web: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
          <input placeholder="Dirección Completa" value={cfg.direccion} onChange={(e) => setCfg({...cfg, direccion: e.target.value})} className="col-span-1 md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200" />
        </div>
        
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">Logo de Empresa</label>
          <input type="file" onChange={(e) => handleFileUpload(e, 'logo')} className="text-sm" />
          {cfg.logo && <img src={cfg.logo} alt="Logo" className="w-20 h-20 object-contain mt-2 border rounded-lg" />}
        </div>
      </div>

      {/* SECCIÓN BANCARIA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <h3 className="col-span-1 md:col-span-3 font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
          <CreditCard size={18}/> Datos Bancarios
        </h3>
        <input placeholder="Banco" value={cfg.banco} onChange={(e) => setCfg({...cfg, banco: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
        <input placeholder="Nombre Cuenta" value={cfg.cuenta_nombre} onChange={(e) => setCfg({...cfg, cuenta_nombre: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
        <input placeholder="Número Cuenta / CLABE" value={cfg.cuenta_numero} onChange={(e) => setCfg({...cfg, cuenta_numero: e.target.value})} className="p-3 bg-slate-50 rounded-xl border border-slate-200" />
      </div>

      {/* SECCIÓN CONDICIONES Y FIRMA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileText size={18}/> Términos y Firma
        </h3>
        <textarea 
            rows={4}
            placeholder="Términos y condiciones de tus servicios..."
            value={cfg.condiciones} 
            onChange={(e) => setCfg({...cfg, condiciones: e.target.value})} 
            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
        />
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 font-bold cursor-pointer">
            <input type="checkbox" checked={cfg.mostrar_firma} onChange={(e) => setCfg({...cfg, mostrar_firma: e.target.checked})} />
            Mostrar sección de firma en PDF
          </label>
        </div>

        {cfg.mostrar_firma && (
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Subir Firma (PNG transparente)</label>
            <input type="file" onChange={(e) => handleFileUpload(e, 'firma_base64')} />
            {cfg.firma_base64 && <img src={cfg.firma_base64} alt="Firma" className="h-16 object-contain mt-2" />}
          </div>
        )}
      </div>

      <button 
        onClick={saveConfig}  
        disabled={loading} 
        className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
      >
        <Save size={20}/> {loading ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  );
}