import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';

const NegocioContext = createContext(null);
export const useNegocio = () => useContext(NegocioContext);

export const PALETAS = {
  blue:    { nombre: 'Azul',      p: '#2563eb', pd: '#1d4ed8', suave: '#eff6ff' },
  emerald: { nombre: 'Esmeralda', p: '#059669', pd: '#047857', suave: '#ecfdf5' },
  violet:  { nombre: 'Violeta',   p: '#7c3aed', pd: '#6d28d9', suave: '#f5f3ff' },
  rose:    { nombre: 'Rojo',      p: '#e11d48', pd: '#be123c', suave: '#fff1f2' },
  amber:   { nombre: 'Ámbar',     p: '#d97706', pd: '#b45309', suave: '#fffbeb' },
  cyan:    { nombre: 'Cian',      p: '#0891b2', pd: '#0e7490', suave: '#ecfeff' },
  slate:   { nombre: 'Grafito',   p: '#334155', pd: '#1e293b', suave: '#f8fafc' },
};

export const FUENTES = {
  sans:    { nombre: 'Moderna', css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' },
  serif:   { nombre: 'Clásica', css: 'ui-serif, Georgia, "Times New Roman", serif' },
  mono:    { nombre: 'Técnica', css: 'ui-monospace, "Cascadia Code", Consolas, monospace' },
  rounded: { nombre: 'Redonda', css: '"Trebuchet MS", ui-rounded, system-ui, sans-serif' },
};

const TEMA_DEFAULT = { color: 'blue', sidebar: 'oscuro', fuente: 'sans', radio: 'suave' };

const DASH_DEFAULT = {
  widgets: ['ingresos', 'por_cobrar', 'egresos', 'utilidad', 'agenda_hoy', 'grafica_cartera', 'cobranza'],
  periodo_default: 'mes',
};

const HEX_RE = /^#[0-9a-f]{6}$/i;
const SIDEBARS = ['oscuro', 'claro', 'color'];
const RADIOS = ['recto', 'suave', 'redondo'];

const ajustar = (hex, pct) => {
  if (!HEX_RE.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * (1 + pct));
  const g = cl(((n >> 8) & 255) * (1 + pct));
  const b = cl((n & 255) * (1 + pct));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
};

const mezclarBlanco = (hex, pct) => {
  if (!HEX_RE.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const m = (v) => Math.round(v + (255 - v) * pct);
  const r = m((n >> 16) & 255), g = m((n >> 8) & 255), b = m(n & 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
};

/**
 * Saneamos el tema antes de escribirlo en el DOM.
 * Sin esto, un valor arbitrario guardado en `configuracion.tema` se inyecta
 * tal cual en una CSS custom property: es un vector de CSS injection.
 */
const sanearTema = (t = {}) => ({
  color: t.color === 'custom' || PALETAS[t.color] ? t.color : 'blue',
  colorHex: HEX_RE.test(t.colorHex || '') ? t.colorHex : '#2563eb',
  sidebar: SIDEBARS.includes(t.sidebar) ? t.sidebar : 'oscuro',
  fuente: FUENTES[t.fuente] ? t.fuente : 'sans',
  radio: RADIOS.includes(t.radio) ? t.radio : 'suave',
});

export function NegocioProvider({ session, children }) {
  const [miembro, setMiembro] = useState(null);
  const [esSuperAdmin, setEsSuperAdmin] = useState(false);
  const [tema, setTemaRaw] = useState(TEMA_DEFAULT);
  const [dashboardCfg, setDashboardCfg] = useState(DASH_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const setTema = useCallback((t) => setTemaRaw(sanearTema(typeof t === 'function' ? t(tema) : t)), [tema]);

  /* ---- 1. Miembro + super admin ---- */
  const cargarMiembro = useCallback(async () => {
    if (!session?.user?.id) return;
    setCargando(true);

    const [{ data: filas, error: err }, { data: sa }] = await Promise.all([
      supabase.from('miembros')
        .select('*, negocios(nombre)')
        .eq('user_id', session.user.id)
        .order('created_at')
        .limit(1),
      supabase.rpc('es_super_admin'),
    ]);

    setEsSuperAdmin(sa === true);
    if (err) setError(err.message);
    else if (!filas?.length) { setMiembro(null); setError('SIN_NEGOCIO'); }
    else { setMiembro(filas[0]); setError(null); }
    setCargando(false);
  }, [session?.user?.id]);

  useEffect(() => { cargarMiembro(); }, [cargarMiembro]);

  const negocioId = miembro?.negocio_id ?? null;

  /* ---- 2. Tema y dashboard del negocio ---- */
  const recargarConfig = useCallback(async () => {
    if (!negocioId) return;
    const { data } = await supabase.from('configuracion')
      .select('tema, dashboard').eq('negocio_id', negocioId).maybeSingle();

    setTemaRaw(sanearTema({ ...TEMA_DEFAULT, ...(data?.tema || {}) }));
    setDashboardCfg({
      ...DASH_DEFAULT,
      ...(data?.dashboard || {}),
      widgets: Array.isArray(data?.dashboard?.widgets) ? data.dashboard.widgets : DASH_DEFAULT.widgets,
    });
  }, [negocioId]);

  useEffect(() => { recargarConfig(); }, [recargarConfig]);

  /* ---- 3. Aplicar el tema al DOM ---- */
  useEffect(() => {
    const t = sanearTema(tema);
    const custom = t.color === 'custom';
    const paleta = PALETAS[t.color] || PALETAS.blue;
    const base  = custom ? t.colorHex : paleta.p;
    const dark  = custom ? ajustar(base, -0.18) : paleta.pd;
    const suave = custom ? mezclarBlanco(base, 0.92) : paleta.suave;
    const f = FUENTES[t.fuente] || FUENTES.sans;

    const root = document.documentElement;
    root.style.setProperty('--color-primario', base);
    root.style.setProperty('--color-primario-dark', dark);
    root.style.setProperty('--color-primario-suave', suave);
    root.style.setProperty('--fuente-app', f.css);
    root.setAttribute('data-radio', t.radio);
  }, [tema]);

  const esDueno = miembro?.rol === 'dueno';

  /**
   * `puede` es solo para la interfaz: esconde botones.
   * La autorización real vive en las políticas RLS de Postgres y en la
   * Edge Function — nunca confíes solo en este flag.
   */
  const puede = useCallback(
    (p) => esDueno || miembro?.permisos?.[p] === true,
    [esDueno, miembro],
  );

  return (
    <NegocioContext.Provider value={{
      miembro,
      negocioId,
      nombreNegocio: miembro?.negocios?.nombre ?? '',
      esDueno,
      puede,
      cargando,
      error,
      esSuperAdmin,
      tema,
      setTema,
      dashboardCfg,
      setDashboardCfg,
      recargarConfig,
      recargarMiembro: cargarMiembro,
    }}>
      {children}
    </NegocioContext.Provider>
  );
}

export function Protegido({ permiso, children }) {
  const { puede } = useNegocio();
  if (!puede(permiso)) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center max-w-md shadow-sm">
          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
          <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Acceso restringido</h3>
          <p className="text-slate-500 font-medium text-sm mt-2">
            No tienes permiso para ver esta sección. Pídele al dueño del negocio que te lo habilite.
          </p>
        </div>
      </div>
    );
  }
  return children;
}