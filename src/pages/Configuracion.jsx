import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio, MODULOS_DEFAULT, MODULOS_CATALOGO, sanearModulos } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import {
  Save, Building, CreditCard, FileText, Settings, Palette,
  LayoutDashboard, Trash2, Upload,
  PackageCheck,
} from 'lucide-react';
import TemaConfig from '../components/TemaConfig.jsx';
import DashboardConfig from '../components/DashboardConfig.jsx';
import PdfConfig from '../components/PdfConfig.jsx';
import {
  LIMITES, limpiarTexto, textoParaGuardar,
  telefonoMX, formatearTelefono, validarImagen, numeroSeguro,
} from '../utils/seguridad.js';

const CFG_VACIA = {
  nombre: '', direccion: '', telefono: '', logo: null,
  banco: '', cuenta_nombre: '', cuenta_numero: '', condiciones: '',
  titulo_documento: 'PRESUPUESTO', especialidad: '', sitio_web: '',
  mostrar_firma: false, firma_base64: null,
  modulos: MODULOS_DEFAULT,
};

const PDF_DEFAULT = {
  plantilla: 'clasico', color: '#16415e', tabla: 'striped',
  mostrar_logo: true, mostrar_banco: true, mostrar_terminos: true, mostrar_pagina: true,
  mostrar_metodo_pago: true, mostrar_vigencia: true, mostrar_contacto_empresa: true, mostrar_nota: true, moneda: 'MXN', prefijo_folio: '', etiqueta_impuesto: 'IVA', tasa_impuesto: 16, etiqueta_total: 'TOTAL', pie_texto: '', nota_destacada: '', validez_dias: 15,
};
const COLOR_HEX_RE = /^#[0-9a-f]{6}$/i;
const sanearPdf = (pdf = {}) => ({
  ...PDF_DEFAULT,
  ...pdf,
  color: COLOR_HEX_RE.test(pdf.color || '') ? pdf.color : PDF_DEFAULT.color,
  prefijo_folio: textoParaGuardar(pdf.prefijo_folio, LIMITES.pdfPrefijo),
  etiqueta_impuesto: textoParaGuardar(pdf.etiqueta_impuesto, LIMITES.pdfEtiqueta) || 'IVA',
  etiqueta_total: textoParaGuardar(pdf.etiqueta_total, LIMITES.pdfEtiqueta) || 'TOTAL',
  pie_texto: textoParaGuardar(pdf.pie_texto, LIMITES.pdfPie),
  nota_destacada: textoParaGuardar(pdf.nota_destacada, LIMITES.pdfNota),
  tasa_impuesto: numeroSeguro(pdf.tasa_impuesto, { max: 100 }),
  validez_dias: Math.round(numeroSeguro(pdf.validez_dias, { max: 365, decimales: 0 })),
  moneda: ['MXN', 'USD', 'EUR'].includes(pdf.moneda) ? pdf.moneda : 'MXN',
});

const TABS = [
  { id: 'empresa',    label: 'Empresa',    icon: Building },
  { id: 'documento',  label: 'Documento',  icon: FileText },
  { id: 'apariencia', label: 'Apariencia', icon: Palette },
  { id: 'panel',      label: 'Panel',      icon: LayoutDashboard },
  { id: 'producto',   label: 'Producto',   icon: PackageCheck },
];

// Se declara fuera para que los campos conserven el foco al escribir.
function Campo({ label, children, full, ayuda }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="mt-1">{children}</div>
      {ayuda && <p className="text-[10px] font-bold text-slate-400 mt-1.5 ml-1">{ayuda}</p>}
    </div>
  );
}

/* Contador que solo aparece cerca del tope. */
function Contador({ valor, limite }) {
  const usado = (valor || '').length;
  if (usado < limite * 0.8) return null;
  return (
    <p className={`text-[10px] font-bold mt-1 text-right ${usado >= limite ? 'text-rose-500' : 'text-slate-400'}`}>
      {usado}/{limite}
    </p>
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
      setCfg(prev => ({ ...prev, ...limpio, modulos: sanearModulos(data.modulos) }));
      if (pdf) setPdfCfg(prev => ({ ...prev, ...pdf }));
    })();
  }, [negocioId]);

  /** Atajo para campos de texto con su límite correspondiente. */
  const setTexto = (campo, valor, limite, multilinea = false) =>
    setCfg(prev => ({ ...prev, [campo]: limpiarTexto(valor, limite, { multilinea }) }));

  const toggleModulo = (id) => setCfg(prev => ({
    ...prev,
    modulos: { ...sanearModulos(prev.modulos), [id]: prev.modulos?.[id] === false },
  }));

  // Solo se aceptan imágenes rasterizadas antes de guardarlas como base64.
  const subirArchivo = (e, campo) => {
    const file = e.target.files?.[0];
    e.target.value = '';                       // permite volver a elegir el mismo archivo
    const err = validarImagen(file);
    if (err) return toast.error(err);

    const reader = new FileReader();
    reader.onerror = () => toast.error('No se pudo leer el archivo.');
    reader.onloadend = () => {
      setCfg(prev => ({ ...prev, [campo]: reader.result }));
      toast.ok('Imagen cargada. No olvides guardar.');
    };
    reader.readAsDataURL(file);
  };

  const quitarImagen = async (campo, nombre) => {
    const ok = await confirmar({
      titulo: `Quitar ${nombre}`,
      mensaje: 'Se eliminará al guardar.',
      okTexto: 'Quitar', peligro: true,
    });
    if (ok) setCfg(prev => ({ ...prev, [campo]: null }));
  };

  const guardar = async () => {
    if (!negocioId) return toast.error('Cargando negocio, espera un momento.');
    if (loading) return;

    setLoading(true);
    const { id, created_at, ...limpio } = cfg;

    // Se valida nuevamente antes de guardar la configuración.
    const payload = {
      ...limpio,
      nombre:           textoParaGuardar(cfg.nombre, LIMITES.nombreNegocio) || null,
      especialidad:     textoParaGuardar(cfg.especialidad, LIMITES.especialidad) || null,
      telefono:         telefonoMX(cfg.telefono) || null,
      sitio_web:        textoParaGuardar(cfg.sitio_web, LIMITES.sitioWeb) || null,
      direccion:        textoParaGuardar(cfg.direccion, LIMITES.direccion) || null,
      banco:            textoParaGuardar(cfg.banco, LIMITES.banco) || null,
      cuenta_nombre:    textoParaGuardar(cfg.cuenta_nombre, LIMITES.cuentaNombre) || null,
      cuenta_numero:    textoParaGuardar(cfg.cuenta_numero, LIMITES.cuentaNumero) || null,
      titulo_documento: textoParaGuardar(cfg.titulo_documento, LIMITES.tituloDocumento).toUpperCase() || 'PRESUPUESTO',
      condiciones:      textoParaGuardar(cfg.condiciones, LIMITES.condiciones, { multilinea: true }) || null,
      tema,
      dashboard: dashboardCfg,
      pdf: sanearPdf(pdfCfg),
      modulos: sanearModulos(cfg.modulos),
      negocio_id: negocioId,
      user_id: session.user.id,
    };

    const { error } = await supabase.from('configuracion')
      .upsert(payload, { onConflict: 'negocio_id' });

    setLoading(false);
    if (error) return toast.error('No se pudo guardar: ' + error.message);
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
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wide transition ${
                on ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
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
                <input className={inputCls} value={cfg.nombre || ''} maxLength={LIMITES.nombreNegocio}
                  onChange={(e) => setTexto('nombre', e.target.value, LIMITES.nombreNegocio)}
                  placeholder="Balsimelli Electric" />
                <Contador valor={cfg.nombre} limite={LIMITES.nombreNegocio} />
              </Campo>

              <Campo label="Especialidad / Giro">
                <input className={inputCls} value={cfg.especialidad || ''} maxLength={LIMITES.especialidad}
                  onChange={(e) => setTexto('especialidad', e.target.value, LIMITES.especialidad)}
                  placeholder="Servicios eléctricos" />
              </Campo>

              <Campo label="Teléfono" ayuda="10 dígitos. Puedes pegar con lada o guiones.">
                {/* Mismo tratamiento que en Clientes: type="text" + inputMode
                    numeric. type="number"/"tel" dejan pasar "e", "+" y "-". */}
                <input className={inputCls} type="text" inputMode="numeric" maxLength={12}
                  value={formatearTelefono(cfg.telefono)}
                  onChange={(e) => setCfg({ ...cfg, telefono: telefonoMX(e.target.value) })}
                  placeholder="614 123 4567" />
              </Campo>

              <Campo label="Sitio web / Redes">
                <input className={inputCls} value={cfg.sitio_web || ''} maxLength={LIMITES.sitioWeb}
                  onChange={(e) => setTexto('sitio_web', e.target.value, LIMITES.sitioWeb)}
                  placeholder="@tuempresa" />
              </Campo>

              <Campo label="Dirección completa" full>
                <input className={inputCls} value={cfg.direccion || ''} maxLength={LIMITES.direccion}
                  onChange={(e) => setTexto('direccion', e.target.value, LIMITES.direccion)}
                  placeholder="Calle, colonia, ciudad" />
                <Contador valor={cfg.direccion} limite={LIMITES.direccion} />
              </Campo>
            </div>

            <Campo label="Logo de la empresa"
              ayuda="PNG, JPG o WEBP · máximo 800 KB. Los SVG no se permiten por seguridad.">
              <div className="flex items-center gap-4 flex-wrap">
                {cfg.logo && (
                  <img src={cfg.logo} alt="Logo actual"
                    className="w-20 h-20 object-contain bg-slate-50 border border-slate-200 rounded-2xl p-2" />
                )}
                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase text-slate-600 flex items-center gap-2 transition">
                  <Upload size={14} /> {cfg.logo ? 'Cambiar' : 'Subir logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => subirArchivo(e, 'logo')} />
                </label>
                {cfg.logo && (
                  <button onClick={() => quitarImagen('logo', 'el logo')}
                    aria-label="Quitar logo"
                    className="text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </Campo>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard size={18} /> Datos bancarios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Banco">
                <input className={inputCls} value={cfg.banco || ''} maxLength={LIMITES.banco}
                  onChange={(e) => setTexto('banco', e.target.value, LIMITES.banco)} placeholder="BBVA" />
              </Campo>
              <Campo label="Titular de la cuenta">
                <input className={inputCls} value={cfg.cuenta_nombre || ''} maxLength={LIMITES.cuentaNombre}
                  onChange={(e) => setTexto('cuenta_nombre', e.target.value, LIMITES.cuentaNombre)}
                  placeholder="Nombre completo" />
              </Campo>
              <Campo label="Cuenta / CLABE">
                <input className={inputCls} value={cfg.cuenta_numero || ''} maxLength={LIMITES.cuentaNumero}
                  onChange={(e) => setTexto('cuenta_numero', e.target.value, LIMITES.cuentaNumero)}
                  placeholder="012 345 678..." />
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

            <Campo label="Título del documento"
              ayuda="Ej. PRESUPUESTO, COTIZACIÓN, ORDEN DE SERVICIO">
              <input className={inputCls} value={cfg.titulo_documento || ''} maxLength={LIMITES.tituloDocumento}
                onChange={(e) => setTexto('titulo_documento', e.target.value.toUpperCase(), LIMITES.tituloDocumento)}
                onFocus={(e) => e.target.select()} placeholder="PRESUPUESTO" />
            </Campo>

            <Campo label="Términos y condiciones"
              ayuda="En el PDF se imprimen hasta 6 líneas; el resto se recorta.">
              <textarea rows={4} className={`${inputCls} resize-none font-medium`}
                value={cfg.condiciones || ''} maxLength={LIMITES.condiciones}
                onChange={(e) => setTexto('condiciones', e.target.value, LIMITES.condiciones, true)}
                placeholder="Se solicitará el 50% de anticipo antes del comienzo de la obra..." />
              <Contador valor={cfg.condiciones} limite={LIMITES.condiciones} />
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
                    <img src={cfg.firma_base64} alt="Firma actual"
                      className="h-16 object-contain bg-slate-50 border border-slate-200 rounded-xl px-3" />
                  )}
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase text-slate-600 flex items-center gap-2 transition">
                    <Upload size={14} /> {cfg.firma_base64 ? 'Cambiar firma' : 'Subir firma'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={(e) => subirArchivo(e, 'firma_base64')} />
                  </label>
                  {cfg.firma_base64 && (
                    <button onClick={() => quitarImagen('firma_base64', 'la firma')}
                      aria-label="Quitar firma"
                      className="text-rose-500 hover:bg-rose-50 p-2.5 rounded-xl transition">
                      <Trash2 size={16} />
                    </button>
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
      {tab === 'producto' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><PackageCheck size={18} /> Módulos del producto</h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Activa solo lo que necesite cada negocio. Desactivar un módulo oculta sus pantallas y widgets, pero nunca borra sus datos.</p>
          </div>
          <div className="space-y-3">
            {Object.entries(MODULOS_CATALOGO).map(([id, mod]) => {
              const activo = cfg.modulos?.[id] !== false;
              return <button key={id} type="button" onClick={() => toggleModulo(id)} aria-pressed={activo}
                className={`w-full text-left p-4 rounded-2xl border-2 transition flex items-center gap-3 ${activo ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
                <span className={`w-10 h-6 rounded-full p-1 transition ${activo ? 'bg-primario' : 'bg-slate-300'}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${activo ? 'translate-x-4' : ''}`} />
                </span>
                <span className="min-w-0"><span className={`block font-black text-sm ${activo ? 'text-primario-dark' : 'text-slate-600'}`}>{mod.label}</span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">{mod.desc}</span></span>
              </button>;
            })}
          </div>
          <p className="text-[11px] font-bold text-slate-400">Guarda los cambios para aplicarlos. Puedes reactivar cualquier módulo sin perder historial.</p>
        </div>
      )}

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
