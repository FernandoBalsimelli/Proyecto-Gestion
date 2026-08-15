import React, {
  createContext, useContext, useState, useEffect, useMemo, useCallback,
} from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from './NegocioContext.jsx';
import { fechaLocalISO, sumarDiasLocal } from '../utils/seguridad.js';

// Fuente única de trabajos abiertos para Agenda, el menú y los widgets.

const AgendaContext = createContext(null);

// Permite usar componentes de agenda sin romper vistas donde no se monta el proveedor.
export const useAgendaOpcional = () => useContext(AgendaContext);

export const useAgenda = () => {
  const ctx = useContext(AgendaContext);
  if (!ctx) {
    throw new Error('useAgenda debe usarse dentro de <AgendaProvider>.');
  }
  return ctx;
};

const HORIZONTE_DIAS = 365;  // Mantiene visibles los trabajos abiertos del año.
const MAX_TRABAJOS = 300;

export function AgendaProvider({ children }) {
  const { negocioId, moduloActivo } = useNegocio();

  const [trabajos, setTrabajos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Solo se cargan trabajos abiertos; el historial se consulta en su página.
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

    // Un solo canal por negocio evita duplicar suscripciones de Realtime.
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

  // Actualiza la vista de inmediato y revierte si la base rechaza el cambio.
  const cambiarEstado = useCallback(async (id, estado) => {
    const previos = trabajos;
    // Los trabajos cerrados dejan de formar parte de los resúmenes abiertos.
    setTrabajos(prev =>
      ['pendiente', 'en_proceso'].includes(estado)
        ? prev.map(t => (t.id === id ? { ...t, estado } : t))
        : prev.filter(t => t.id !== id)
    );

    const { error: err } = await supabase.from('agenda').update({ estado }).eq('id', id);
    if (err) { setTrabajos(previos); return err.message; }
    return null;
  }, [trabajos]);

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
      // El indicador del menú suma pendientes de hoy y atrasados.
      pendientesUrgentes: vencidos.length + deHoy.length,
      recargar,
      cambiarEstado,
    };
  }, [trabajos, cargando, error, recargar, cambiarEstado]);

  return <AgendaContext.Provider value={valor}>{children}</AgendaContext.Provider>;
}
