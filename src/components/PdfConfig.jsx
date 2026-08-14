import React, { useState, useEffect, useRef } from 'react';
import { PLANTILLAS, generarDocumentoPDF, DEMO } from '../utils/pdfGenerador.js';
import { FileText, Check, Eye, RefreshCw, Download } from 'lucide-react';
import { LIMITES, limpiarTexto } from '../utils/seguridad.js';

const OPCIONES = [
  { key: 'mostrar_logo',     label: 'Mostrar logo' },
  { key: 'mostrar_banco',    label: 'Datos bancarios' },
  { key: 'mostrar_terminos', label: 'Términos y condiciones' },
  { key: 'mostrar_pagina',   label: 'Número de página' },
  { key: 'mostrar_metodo_pago', label: 'Método de pago' },
  { key: 'mostrar_vigencia', label: 'Vigencia del documento' },
  { key: 'mostrar_contacto_empresa', label: 'Contacto de empresa en pie' },
  { key: 'mostrar_nota', label: 'Nota destacada' },
];

const COLORES_RAPIDOS = ['#16415e', '#1e293b', '#0f766e', '#4f46e5', '#b91c1c', '#c2410c', '#7c2d12', '#065f46'];

/* ✅ Fuera del componente */
function Seccion({ titulo, children }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{titulo}</p>
      {children}
    </div>
  );
}

export default function PdfConfig({ pdf, setPdf, config }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const urlRef = useRef(null);

  const set = (k, v) => setPdf({ ...pdf, [k]: v });

  const elegirPlantilla = (id) => setPdf({
    ...pdf,
    plantilla: id,
    color: PLANTILLAS[id].color,
    tabla: PLANTILLAS[id].tabla,
  });

  const generarPreview = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = generarDocumentoPDF({ config, pdfCfg: pdf, ...DEMO }, 'bloburl');
    urlRef.current = url;
    setPreviewUrl(url);
  };

  // Regenera automáticamente al cambiar cualquier ajuste (con debounce)
  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(generarPreview, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, abierto, config?.logo, config?.nombre]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const descargarPrueba = () =>
    generarDocumentoPDF({ config, pdfCfg: pdf, ...DEMO }, 'save');

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3 flex-wrap">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <FileText size={18} /> Diseño del PDF
        </h3>
        <div className="flex gap-2">
          <button type="button" onClick={descargarPrueba}
            className="text-[11px] font-black uppercase px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1.5">
            <Download size={13} /> Descargar prueba
          </button>
          <button type="button" onClick={() => { setAbierto(!abierto); if (!abierto) generarPreview(); }}
            className={`text-[11px] font-black uppercase px-3 py-2 rounded-xl flex items-center gap-1.5 transition ${
              abierto ? 'bg-primario text-white' : 'bg-primario-suave text-primario-dark hover:bg-primario hover:text-white'}`}>
            <Eye size={13} /> {abierto ? 'Ocultar' : 'Vista previa'}
          </button>
        </div>
      </div>

      {/* ── Vista previa ── */}
      {abierto && (
        <div className="bg-slate-100 rounded-2xl p-3 border border-slate-200">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Documento de ejemplo
            </span>
            <button type="button" onClick={generarPreview}
              className="text-slate-400 hover:text-primario" title="Regenerar">
              <RefreshCw size={14} />
            </button>
          </div>
          {previewUrl ? (
            <iframe title="preview" src={previewUrl}
              className="w-full h-[520px] rounded-xl bg-white border border-slate-300" />
          ) : (
            <div className="h-[520px] flex items-center justify-center text-slate-400 font-bold text-sm">
              Generando vista previa...
            </div>
          )}
          <p className="text-[10px] font-bold text-slate-400 mt-2 px-1">
            Usa datos ficticios. Los cambios se reflejan automáticamente.
          </p>
        </div>
      )}

      {/* ── Plantillas ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Object.entries(PLANTILLAS).map(([id, p]) => {
          const on = pdf.plantilla === id;
          return (
            <button key={id} type="button" onClick={() => elegirPlantilla(id)}
              className={`text-left p-4 rounded-2xl border-2 transition ${
                on ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-slate-800 text-sm">{p.nombre}</span>
                {on && <Check size={16} className="text-primario" strokeWidth={3} />}
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-2 space-y-1 mb-2 relative overflow-hidden">
                {p.bandaSuperior && <div className="h-1.5 rounded" style={{ backgroundColor: p.color }} />}
                {p.barraLateral && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: p.color }} />}
                <div className="flex justify-between items-center">
                  <div className="w-5 h-5 bg-slate-200 rounded" />
                  {p.tituloEnCaja
                    ? <div className="h-3 w-16 rounded" style={{ backgroundColor: p.color }} />
                    : <div className="h-2 w-14 rounded" style={{ backgroundColor: p.color }} />}
                </div>
                <div className="h-1 bg-slate-100 rounded w-2/3" />
                <div className="h-2 rounded mt-1.5" style={{ backgroundColor: p.headerFill ? p.color : '#e2e8f0' }} />
                <div className="h-1 bg-slate-100 rounded" />
                <div className="h-1 bg-slate-50 rounded" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 leading-tight">{p.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ── Color ── */}
      <Seccion titulo="Color del documento">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="relative w-12 h-12 rounded-2xl border-2 border-slate-200 cursor-pointer overflow-hidden shrink-0"
            style={{ backgroundColor: pdf.color || '#16415e' }}>
            <input type="color" value={pdf.color || '#16415e'}
              onChange={(e) => set('color', e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </label>
          <input maxLength="7" value={pdf.color || '#16415e'} onChange={(e) => set('color', limpiarTexto(e.target.value, 7))}
            className="w-32 p-2.5 bg-slate-50 border border-slate-100 rounded-xl font-mono font-bold text-sm outline-none uppercase" />
          <div className="flex gap-1.5 flex-wrap">
            {COLORES_RAPIDOS.map(c => (
              <button key={c} type="button" onClick={() => set('color', c)}
                className="w-7 h-7 rounded-lg hover:scale-110 transition border border-black/10"
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </Seccion>

      {/* ── Tabla ── */}
      <Seccion titulo="Estilo de tabla">
        <div className="grid grid-cols-3 gap-2">
          {[['striped', 'Rayas'], ['grid', 'Cuadrícula'], ['plain', 'Simple']].map(([id, n]) => (
            <button key={id} type="button" onClick={() => set('tabla', id)}
              className={`p-3 rounded-2xl border-2 text-[11px] font-black uppercase transition ${
                pdf.tabla === id ? 'border-primario bg-primario-suave text-primario-dark' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>
              {n}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Datos comerciales">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-600">Moneda<select value={pdf.moneda || 'MXN'} onChange={(e) => set('moneda', e.target.value)} className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold"><option value="MXN">Peso mexicano (MX$)</option><option value="USD">Dólar estadounidense (US$)</option><option value="EUR">Euro (€)</option></select></label>
          <label className="text-xs font-bold text-slate-600">Prefijo de folio<input maxLength={LIMITES.pdfPrefijo} value={pdf.prefijo_folio || ''} onChange={(e) => set('prefijo_folio', limpiarTexto(e.target.value, LIMITES.pdfPrefijo))} placeholder="Ej. COT-" className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
          <label className="text-xs font-bold text-slate-600">Etiqueta de impuesto<input maxLength={LIMITES.pdfEtiqueta} value={pdf.etiqueta_impuesto || 'IVA'} onChange={(e) => set('etiqueta_impuesto', limpiarTexto(e.target.value, LIMITES.pdfEtiqueta))} placeholder="IVA" className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
          <label className="text-xs font-bold text-slate-600">Tasa de impuesto (%)<input type="number" min="0" max="100" value={pdf.tasa_impuesto ?? 16} onChange={(e) => set('tasa_impuesto', Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
          <label className="text-xs font-bold text-slate-600">Etiqueta del total<input maxLength={LIMITES.pdfEtiqueta} value={pdf.etiqueta_total || 'TOTAL'} onChange={(e) => set('etiqueta_total', limpiarTexto(e.target.value, LIMITES.pdfEtiqueta))} placeholder="TOTAL" className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
          <label className="text-xs font-bold text-slate-600">Vigencia predeterminada (días)<input type="number" min="0" max="365" value={pdf.validez_dias ?? 15} onChange={(e) => set('validez_dias', Math.max(0, Math.min(365, Number(e.target.value) || 0)))} className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2">Texto adicional en el pie<input maxLength={LIMITES.pdfPie} value={pdf.pie_texto || ''} onChange={(e) => set('pie_texto', limpiarTexto(e.target.value, LIMITES.pdfPie))} placeholder="Ej. Gracias por su preferencia" className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2">Nota destacada bajo el encabezado<input maxLength={LIMITES.pdfNota} value={pdf.nota_destacada || ''} onChange={(e) => set('nota_destacada', limpiarTexto(e.target.value, LIMITES.pdfNota))} placeholder="Ej. Precios sujetos a disponibilidad" className="mt-1 w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold" /></label>
        </div>
      </Seccion>

      {/* ── Secciones ── */}
      <Seccion titulo="Secciones visibles">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {OPCIONES.map(o => {
            const on = pdf[o.key] !== false;
            return (
              <button key={o.key} type="button" onClick={() => set(o.key, !on)}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition ${
                  on ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${on ? 'bg-primario text-white' : 'bg-slate-200'}`}>
                  {on && <Check size={13} strokeWidth={3} />}
                </div>
                <span className={`font-bold text-sm ${on ? 'text-primario-dark' : 'text-slate-600'}`}>{o.label}</span>
              </button>
            );
          })}
        </div>
      </Seccion>
    </div>
  );
}
