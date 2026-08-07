import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import {
  Save, Building, CreditCard, FileText, Settings, Palette,
  LayoutDashboard, Trash2, Upload,
} from 'lucide-react';
import TemaConfig from '../components/TemaConfig.jsx';
import DashboardConfig from '../components/DashboardConfig.jsx';
import PdfConfig from '../components/PdfConfig.jsx';


const CFG_VACIA = {
  nombre: '', direccion: '', telefono: '', logo: null,
  banco: '', cuenta_nombre: '', cuenta_numero: '', condiciones: '',
  titulo_documento: 'PRESUPUESTO', especialidad: '', sitio_web: '',
  mostrar_firma: false, firma_base64: null,
};

const PDF_DEFAULT = {
  plantilla: 'clasico', color: '#16415e', tabla: 'striped',
  mostrar_logo: true, mostrar_banco: true, mostrar_terminos: true, mostrar_pagina: true,
};

const TABS = [
  { id: 'empresa', label: 'Empresa', icon: Building },
  { id: 'documento', label: 'Documento', icon: FileText },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
  { id: 'panel', label: 'Panel', icon: LayoutDashboard },
];

/* Fuera del componente para no perder foco */
function Campo({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls = 'w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

export default function Configuracion({ session }) {
  const { negocioId, tema, dashboardCfg, recargarConfig } = useNegocio();
  const { toast, confirmar } = useUI();

  const [tab, setTab] = useState('empresa');
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState(CFG_VACIA);
  const [pdfCfg, setPdfCfg] = useState(PDF_DEFAULT);

  useEffect(() => {
    if (!negocioId) return;
    (async () => {
      const { data } = await supabase.from('configuracion')
        .select('*').eq('negocio_id', negocioId).maybeSingle();
      if (!data) return;
      const { id, created_at, user_id, negocio_id, tema: _t, dashboard: _d, pdf, ...limpio } = data;
      setCfg(prev => ({ ...prev, ...limpio }));
      if (pdf) setPdfCfg(prev => ({ ...prev, ...pdf }));
    })();
  }, [negocioId]);

  const subirArchivo = (e, campo) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Solo se permiten imágenes.');
    if (file.size > 800_000) return toast.error('La imagen debe pesar menos de 800 KB. Comprímela primero.');
    const reader = new FileReader();
    reader.onloadend = () => {
      setCfg(prev => ({ ...prev, [campo]: reader.result }));
      toast.ok('Imagen cargada. No olvides guardar.');
    };
    reader.readAsDataURL(file);
  };

  const quitarImagen = async (campo, nombre) => {
    const ok = await confirmar({ titulo: `Quitar ${nombre}`, mensaje: 'Se eliminará al guardar.', peligro: true });
    if (ok) setCfg(prev => ({ ...prev, [campo]: null }));
  };

  const guardar = async () => {
    if (!negocioId) return toast.error('Cargando negocio, espera un momento.');
    setLoading(true);
    const { id, created_at, ...limpio } = cfg;
    const { error } = await supabase.from('configuracion').upsert(
      {
        ...limpio,
        tema,
        dashboard: dashboardCfg,
        pdf: pdfCfg,
        negocio_id: negocioId,
        user_id: session.user.id,
      },
      { onConflict: 'negocio_id' }   // 🔴 ESTO FALTABA
    );
    setLoading(false);
    if (error) return toast.error('Error al guardar: ' + error.message);
    await recargarConfig();
    toast.ok('Configuración guardada correctamente.');
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Settings className="text-primario" /> Configuración
        </h2>
        <p className="text-slate-500 font-medium text-sm">Personaliza tu sistema y tus documentos</p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wide transition ${on ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ══ EMPRESA ══ */}
      {tab === 'empresa' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building size={18} /> Datos generales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Nombre de la empresa">
                <input className={inputCls} value={cfg.nombre || ''}
                  onChange={(e) => setCfg({ ...cfg, nombre: e.target.value })} placeholder="Balsimelli Electric" />
              </Campo>
              <Campo label="Especialidad / Giro">
                <input className={inputCls} value={cfg.especialidad || ''}
                  onChange={(e) => setCfg({ ...cfg, especialidad: e.target.value })} placeholder="Servicios eléctricos" />
              </Campo>
              <Campo label="Teléfono">
                <input className={inputCls} value={cfg.telefono || ''}
                  onChange={(e) => setCfg({ ...cfg, telefono: e.target.value })} placeholder="614 123 4567" />
              </Campo>
              <Campo label="Sitio web / Redes">
                <input className={inputCls} value={cfg.sitio_web || ''}
                  onChange={(e) => setCfg({ ...cfg, sitio_web: e.target.value })} placeholder="@tuempresa" />
              </Campo>
              <Campo label="Dirección completa" full>
                <input className={inputCls} value={cfg.direccion || ''}
                  onChange={(e) => setCfg({ ...cfg, direccion: e.target.value })} placeholder="Calle, colonia, ciudad" />
              </Campo>
            </div>

            <Campo label="Logo de la empresa">
              <div className="flex items-center gap-4 flex-wrap">
                {cfg.logo && (
                  <img src={cfg.logo} alt="Logo"
                    className="w-20 h-20 object-contain bg-slate-50 border border-slate-200 rounded-2xl p-2" />
                )}
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase text-slate-600 flex items-center gap-2 transition">
                  <Upload size={14} /> {cfg.logo ? 'Cambiar' : 'Subir logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => subirArchivo(e, 'logo')} />
                </label>
                {cfg.logo && (
                  <button onClick={() => quitarImagen('logo', 'el logo')}
                    className="text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition"><Trash2 size={16} /></button>
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-2">PNG con fondo transparente · máx. 800 KB</p>
            </Campo>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard size={18} /> Datos bancarios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Banco">
                <input className={inputCls} value={cfg.banco || ''}
                  onChange={(e) => setCfg({ ...cfg, banco: e.target.value })} placeholder="BBVA" />
              </Campo>
              <Campo label="Titular de la cuenta">
                <input className={inputCls} value={cfg.cuenta_nombre || ''}
                  onChange={(e) => setCfg({ ...cfg, cuenta_nombre: e.target.value })} placeholder="Nombre completo" />
              </Campo>
              <Campo label="Cuenta / CLABE">
                <input className={inputCls} value={cfg.cuenta_numero || ''}
                  onChange={(e) => setCfg({ ...cfg, cuenta_numero: e.target.value })} placeholder="012 345 678..." />
              </Campo>
            </div>
          </div>
        </div>
      )}

      {/* ══ DOCUMENTO ══ */}
      {tab === 'documento' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText size={18} /> Contenido del documento
            </h3>

            <Campo label="Título del documento">
              <input className={inputCls} value={cfg.titulo_documento || ''}
                onChange={(e) => setCfg({ ...cfg, titulo_documento: e.target.value.toUpperCase() })}
                onFocus={(e) => e.target.select()} placeholder="PRESUPUESTO" />
              <p className="text-[10px] font-bold text-slate-400 mt-1.5 ml-1">
                Ej. PRESUPUESTO, COTIZACIÓN, ORDEN DE SERVICIO
              </p>
            </Campo>

            <Campo label="Términos y condiciones">
              <textarea rows={4} className={`${inputCls} resize-none font-medium`}
                value={cfg.condiciones || ''}
                onChange={(e) => setCfg({ ...cfg, condiciones: e.target.value })}
                placeholder="Se solicitará el 50% de anticipo..." />
            </Campo>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={!!cfg.mostrar_firma}
                  onChange={(e) => setCfg({ ...cfg, mostrar_firma: e.target.checked })}
                  className="w-4 h-4 rounded accent-[color:var(--color-primario)]" />
                <span className="font-bold text-sm text-slate-700">Incluir espacio de firma en el PDF</span>
              </label>

              {cfg.mostrar_firma && (
                <div className="mt-4 flex items-center gap-4 flex-wrap">
                  {cfg.firma_base64 && (
                    <img src={cfg.firma_base64} alt="Firma"
                      className="h-16 object-contain bg-slate-50 border border-slate-200 rounded-xl px-3" />
                  )}
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase text-slate-600 flex items-center gap-2 transition">
                    <Upload size={14} /> {cfg.firma_base64 ? 'Cambiar firma' : 'Subir firma'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => subirArchivo(e, 'firma_base64')} />
                  </label>
                  {cfg.firma_base64 && (
                    <button onClick={() => quitarImagen('firma_base64', 'la firma')}
                      className="text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition"><Trash2 size={16} /></button>
                  )}
                </div>
              )}
            </div>
          </div>

          <PdfConfig pdf={pdfCfg} setPdf={setPdfCfg} config={{
            ...cfg,
            tituloDocumento: cfg.titulo_documento,
            cuentaNombre: cfg.cuenta_nombre,
            cuentaNumero: cfg.cuenta_numero,
            sitioWeb: cfg.sitio_web,
          }} />
        </div>
      )}

      {tab === 'apariencia' && <TemaConfig />}
      {tab === 'panel' && <DashboardConfig />}

      {/* Barra fija de guardado */}
      <div className="sticky bottom-0 -mx-4 md:-mx-8 px-4 md:px-8 py-4 mt-6
                bg-white/90 backdrop-blur border-t border-slate-200 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold text-slate-400 hidden sm:block">
            Los cambios de apariencia se ven al instante, pero debes guardar para conservarlos.
          </p>
          <button onClick={guardar} disabled={loading}
            className="w-full sm:w-auto bg-primario text-white px-8 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primario-dark transition shadow-lg disabled:opacity-50">
            <Save size={18} /> {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}