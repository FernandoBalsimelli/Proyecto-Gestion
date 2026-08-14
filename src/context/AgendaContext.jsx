import React, {
  createContext, useContext, useState, useEffect, useMemo, useCallback,
} from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from './NegocioContext.jsx';
import { fechaLocalISO, sumarDiasLocal } from '../utils/seguridad.js';

/**
 * ══════════════════════════════════════════════════════════════
 *  AgendaContext — una sola fuente de datos para toda la agenda
 * ══════════════════════════════════════════════════════════════
 *
 * POR QUÉ EXISTE ESTE ARCHIVO:
 *
 * Antes cada widget del dashboard llamaba a su propio hook, y cada hook
 * creaba un canal de realtime con el MISMO nombre:
 *
 *     supabase.channel(`dash-agenda-${negocioId}`)
 *
 * El cliente de Supabase guarda los canales por nombre (topic). El primer
 * widget lo creaba y lo suscribía; el segundo recibía ESE MISMO canal, ya
 * suscrito, e intentaba añadirle un listener. De ahí el error:
 *
 *     cannot add `postgres_changes` callbacks for realtime:dash-agenda-…
 *     after `subscribe()`
 *
 * Se podría parchar poniéndole un nombre aleatorio a cada canal, pero eso
 * dejaría 3 suscripciones y 3 consultas idénticas por cada carga del panel.
 * La solución correcta es esta: un proveedor que consulta una vez, mantiene
 * una sola suscripción, y reparte los datos a quien los necesite —widgets
 * del dashboard, badge del menú lateral y la página de Agenda.
 */

const AgendaContext = createContext(null);

/** Devuelve null si no hay proveedor montado, para poder degradar con gracia. */
export const useAgendaOpcional = () => useContext(AgendaContext);

export const useAgenda = () => {
  const ctx = useContext(AgendaContext);
  if (!ctx) {
    throw new Error('useAgenda debe usarse dentro de <AgendaProvider>.');
  }
  return ctx;
};

const HORIZONTE_DIAS = 365;  // cubre el KPI de trabajos abiertos sin otra suscripción
const MAX_TRABAJOS = 300;

export function AgendaProvider({ children }) {
  const { negocioId, moduloActivo } = useNegocio();

  const [trabajos, setTrabajos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  /* ─────────── Carga ───────────
     Solo trabajos ABIERTOS y dentro del horizonte: es lo que alimenta los
     resúmenes. La página de Agenda hace su propia consulta cuando el usuario
     pide filtros históricos. */
  const recargar = useCallback(async () => {
    if (!negocioId) { setCargando(false); return; }

    const hoy = fechaLocalISO();
    const { data, error: err } = await supabase
      .from('agenda')
      .select('id, titulo, fecha, hora, estado, prioridad, direccion, cliente_id, venta_id, duracion_min, recordatorio_fecha')
      .eq('negocio_id', negocioId)
      .in('estado', ['pendiente', 'en_proceso'])
      .lte('fecha', sumarDiasLocal(hoy, HORIZONTE_DIAS))
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true, nullsFirst: false })
      .limit(MAX_TRABAJOS);

    if (err) setError(err.message);
    else { setError(null); setTrabajos(data || []); }
    setCargando(false);
  }, [negocioId]);

  useEffect(() => {
    if (!negocioId || !moduloActivo('agenda')) { setTrabajos([]); setCargando(false); return; }

    setCargando(true);
    recargar();

    /* UN canal, con nombre único por negocio, creado UNA vez.
       El antirrebote evita recargar cinco veces si se guardan varios
       trabajos seguidos. */
    let t;
    const debounced = () => { clearTimeout(t); t = setTimeout(recargar, 400); };

    const canal = supabase
      .channel(`agenda-ctx-${negocioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda', filter: `negocio_id=eq.${negocioId}` },
        debounced,
      )
      .subscribe();

    return () => {
      clearTimeout(t);
      supabase.removeChannel(canal);
    };
  }, [negocioId, recargar, moduloActivo]);

  /* ─────────── Acciones compartidas ─────────── */

  /** Marca un trabajo con otro estado y actualiza la vista al instante. */
  const cambiarEstado = useCallback(async (id, estado) => {
    const previos = trabajos;
    // Optimista: si el estado deja de estar abierto, sale de la lista.
    setTrabajos(prev =>
      ['pendiente', 'en_proceso'].includes(estado)
        ? prev.map(t => (t.id === id ? { ...t, estado } : t))
        : prev.filter(t => t.id !== id)
    );

    const { error: err } = await supabase.from('agenda').update({ estado }).eq('id', id);
    if (err) { setTrabajos(previos); return err.message; }
    return null;
  }, [trabajos]);

  /* ─────────── Derivados ─────────── */
  const valor = useMemo(() => {
    const hoy = fechaLocalISO();
    const finSemana = sumarDiasLocal(hoy, 7);

    const vencidos = trabajos.filter(t => t.fecha < hoy);
    const deHoy = trabajos.filter(t => t.fecha === hoy);
    const proximos = trabajos.filter(t => t.fecha > hoy);
    const estaSemana = trabajos.filter(t => t.fecha >= hoy && t.fecha <= finSemana);

    return {
      cargando,
      error,
      trabajos,
      vencidos,
      deHoy,
      proximos,
      estaSemana,
      // El badge del menú: lo que requiere atención hoy o antes.
      pendientesUrgentes: vencidos.length + deHoy.length,
      recargar,
      cambiarEstado,
    };
  }, [trabajos, cargando, error, recargar, cambiarEstado]);

  return <AgendaContext.Provider value={valor}>{children}</AgendaContext.Provider>;
}
