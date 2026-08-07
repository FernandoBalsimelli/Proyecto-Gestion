import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';

const NegocioContext = createContext(null);
export const useNegocio = () => useContext(NegocioContext);

export const PALETAS = {
  blue: { nombre: 'Azul', p: '#2563eb', pd: '#1d4ed8', suave: '#eff6ff' },
  emerald: { nombre: 'Esmeralda', p: '#059669', pd: '#047857', suave: '#ecfdf5' },
  violet: { nombre: 'Violeta', p: '#7c3aed', pd: '#6d28d9', suave: '#f5f3ff' },
  rose: { nombre: 'Rojo', p: '#e11d48', pd: '#be123c', suave: '#fff1f2' },
  amber: { nombre: 'Ámbar', p: '#d97706', pd: '#b45309', suave: '#fffbeb' },
  cyan: { nombre: 'Cian', p: '#0891b2', pd: '#0e7490', suave: '#ecfeff' },
  slate: { nombre: 'Grafito', p: '#334155', pd: '#1e293b', suave: '#f8fafc' },
};

export const FUENTES = {
  sans: { nombre: 'Moderna', css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' },
  serif: { nombre: 'Clásica', css: 'ui-serif, Georgia, "Times New Roman", serif' },
  mono: { nombre: 'Técnica', css: 'ui-monospace, "Cascadia Code", Consolas, monospace' },
  rounded: { nombre: 'Redonda', css: '"Trebuchet MS", ui-rounded, system-ui, sans-serif' },
};

const TEMA_DEFAULT = { color: 'blue', sidebar: 'oscuro', fuente: 'sans', radio: 'suave' };
const DASH_DEFAULT = {
  widgets: ['ingresos', 'por_cobrar', 'egresos', 'utilidad', 'grafica_cartera', 'pendientes'],
  periodo_default: 'mes',
};
function ajustar(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * (1 + pct));
  const g = cl(((n >> 8) & 255) * (1 + pct));
  const b = cl((n & 255) * (1 + pct));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function mezclarBlanco(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const m = (v) => Math.round(v + (255 - v) * pct);
  const r = m((n >> 16) & 255), g = m((n >> 8) & 255), b = m(n & 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function NegocioProvider({ session, children }) {
  const [miembro, setMiembro] = useState(null);
  const [esSuperAdmin, setEsSuperAdmin] = useState(false);
  const [tema, setTema] = useState(TEMA_DEFAULT);
  const [dashboardCfg, setDashboardCfg] = useState(DASH_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  /* ---- 1. Miembro + super admin ---- */
  useEffect(() => {
    if (!session?.user?.id) return;
    let activo = true;

    (async () => {
      const { data: filas, error: err } = await supabase
        .from('miembros')
        .select('*, negocios(nombre)')
        .eq('user_id', session.user.id)
        .order('created_at')
        .limit(1);

      const { data: sa } = await supabase.rpc('es_super_admin');

      if (!activo) return;
      setEsSuperAdmin(sa === true);
      if (err) setError(err.message);
      else if (!filas?.length) setError('SIN_NEGOCIO');
      else { setMiembro(filas[0]); setError(null); }
      setCargando(false);
    })();

    return () => { activo = false; };
  }, [session?.user?.id]);

  const negocioId = miembro?.negocio_id ?? null;

  /* ---- 2. Tema y dashboard del negocio ---- */
  const recargarConfig = useCallback(async () => {
    if (!negocioId) return;
    const { data } = await supabase
      .from('configuracion')
      .select('tema, dashboard')
      .eq('negocio_id', negocioId)
      .maybeSingle();

    setTema({ ...TEMA_DEFAULT, ...(data?.tema || {}) });
    setDashboardCfg({ ...DASH_DEFAULT, ...(data?.dashboard || {}) });
  }, [negocioId]);

  useEffect(() => { recargarConfig(); }, [recargarConfig]);

  /* ---- 3. Aplicar el tema al DOM ---- */
  useEffect(() => {
    const custom = tema.color === 'custom' && /^#[0-9a-f]{6}$/i.test(tema.colorHex || '');
    const base = custom ? tema.colorHex : (PALETAS[tema.color] || PALETAS.blue).p;
    const dark = custom ? ajustar(base, -0.18) : (PALETAS[tema.color] || PALETAS.blue).pd;
    const suave = custom ? mezclarBlanco(base, 0.92) : (PALETAS[tema.color] || PALETAS.blue).suave;
    const f = FUENTES[tema.fuente] || FUENTES.sans;

    const root = document.documentElement;
    root.style.setProperty('--color-primario', base);
    root.style.setProperty('--color-primario-dark', dark);
    root.style.setProperty('--color-primario-suave', suave);
    root.style.setProperty('--fuente-app', f.css);
    root.setAttribute('data-radio', tema.radio || 'suave');
  }, [tema]);
  const esDueno = miembro?.rol === 'dueno';
  const puede = (p) => esDueno || miembro?.permisos?.[p] === true;

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
      setTema,            // para previsualizar en vivo
      dashboardCfg,
      setDashboardCfg,
      recargarConfig,
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