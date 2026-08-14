import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgenda } from '../context/AgendaContext.jsx';
import {
  CalendarDays, Clock, MapPin, ArrowRight, CheckCircle2,
  AlertTriangle, Plus, Bell,
} from 'lucide-react';
import { fechaLocalISO, sumarDiasLocal } from '../utils/seguridad.js';

/**
 * Hook compartido: una sola consulta a `agenda` que alimenta los tres widgets
 * del dashboard. Se monta una vez aunque el usuario active varios widgets.
 */
const Panel = ({ titulo, icon, children, accion }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
    <div className="flex items-center justify-between mb-5 gap-2">
      <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
        {icon} {titulo}
      </h3>
      {accion}
    </div>
    {children}
  </div>
);

const PRIORIDAD_BARRA = { alta: 'bg-rose-500', normal: 'bg-slate-300', baja: 'bg-slate-200' };

function Fila({ t, hoy, onCompletar, onAbrir }) {
  const vencido = t.fecha < hoy;
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition">
      <div className={`w-1 self-stretch rounded-full shrink-0 ${PRIORIDAD_BARRA[t.prioridad] || PRIORIDAD_BARRA.normal}`} />
      <button onClick={onAbrir} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {t.hora && (
            <span className="text-[11px] font-black text-slate-700 tabular-nums">{String(t.hora).slice(0, 5)}</span>
          )}
          <p className="font-bold text-slate-800 truncate text-sm">{t.titulo}</p>
          {vencido && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 flex items-center gap-1">
              <AlertTriangle size={9} /> Vencido
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
          {!vencido && t.fecha !== hoy && <span>{t.fecha.split('-').reverse().slice(0, 2).join('/')}</span>}
          {t.direccion && <><MapPin size={10} /> {t.direccion}</>}
        </p>
      </button>
      <button onClick={onCompletar} title="Marcar como terminado"
        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition shrink-0">
        <CheckCircle2 size={18} />
      </button>
    </div>
  );
}

function Vacio({ mensaje, onNuevo }) {
  return (
    <div className="py-10 text-center">
      <div className="bg-emerald-50 text-emerald-500 p-4 rounded-2xl w-fit mx-auto mb-3">
        <CheckCircle2 size={26} />
      </div>
      <p className="font-black text-slate-700 text-sm">{mensaje}</p>
      <button onClick={onNuevo}
        className="mt-3 text-[10px] font-black uppercase text-primario hover:underline inline-flex items-center gap-1">
        <Plus size={11} /> Agendar trabajo
      </button>
    </div>
  );
}

/* ══════════ Widget 1: trabajos de hoy (+ vencidos) ══════════ */
export function WidgetAgendaHoy() {
  const navigate = useNavigate();
  const { deHoy, vencidos, cargando, cambiarEstado } = useAgenda();
  const hoy = fechaLocalISO();

  const completar = async (t) => {
    await cambiarEstado(t.id, 'completado');
  };

  const lista = [...vencidos, ...deHoy];

  return (
    <Panel
      titulo={`Agenda de hoy (${deHoy.length})`}
      icon={<CalendarDays size={14} />}
      accion={
        <button onClick={() => navigate('/agenda')}
          className="text-[10px] font-black uppercase text-primario hover:underline flex items-center gap-1">
          Ver agenda <ArrowRight size={11} />
        </button>
      }>
      {cargando ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : lista.length === 0 ? (
        <Vacio mensaje="Sin trabajos pendientes para hoy" onNuevo={() => navigate('/agenda')} />
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {vencidos.length > 0 && (
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1">
              {vencidos.length} atrasado(s)
            </p>
          )}
          {lista.slice(0, 8).map(t => (
            <Fila key={t.id} t={t} hoy={hoy}
              onAbrir={() => navigate('/agenda')}
              onCompletar={() => completar(t)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════ Widget 2: próximos 7 días ══════════ */
export function WidgetAgendaProximos() {
  const navigate = useNavigate();
  const { proximos, cargando, cambiarEstado } = useAgenda();
  const hoy = fechaLocalISO();

  const completar = async (t) => {
    await cambiarEstado(t.id, 'completado');
  };

  return (
    <Panel titulo="Próximos 7 días" icon={<Clock size={14} />}
      accion={
        <button onClick={() => navigate('/agenda')}
          className="text-[10px] font-black uppercase text-primario hover:underline flex items-center gap-1">
          Ver todo <ArrowRight size={11} />
        </button>
      }>
      {cargando ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : proximos.length === 0 ? (
        <Vacio mensaje="No hay nada agendado esta semana" onNuevo={() => navigate('/agenda')} />
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {proximos.slice(0, 8).map(t => (
            <Fila key={t.id} t={t} hoy={hoy}
              onAbrir={() => navigate('/agenda')}
              onCompletar={() => completar(t)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════ Widget 3: KPI de trabajos abiertos ══════════ */
export function KpiAgenda() {
  const { trabajos, deHoy, vencidos } = useAgenda();
  return (
    <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm flex items-center gap-4">
      <div className="bg-primario-suave text-primario p-4 rounded-2xl shrink-0">
        <CalendarDays size={24} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trabajos abiertos</p>
        <p className="text-2xl font-black tracking-tighter text-slate-900">{trabajos.length}</p>
        <p className="text-[10px] font-bold text-slate-400 truncate">
          {deHoy.length} hoy
          {vencidos.length > 0 && <span className="text-rose-500"> · {vencidos.length} atrasado(s)</span>}
        </p>
      </div>
    </div>
  );
}

/** Seguimiento de clientes/materiales sin obligar a crear otra tarea. */
export function WidgetRecordatorios() {
  const navigate = useNavigate();
  const { trabajos, cargando } = useAgenda();
  const hoy = fechaLocalISO();
  const limite = sumarDiasLocal(hoy, 3);
  const recordatorios = trabajos
    .filter(t => t.recordatorio_fecha && t.recordatorio_fecha <= limite)
    .sort((a, b) => a.recordatorio_fecha.localeCompare(b.recordatorio_fecha));

  return (
    <Panel titulo="Recordatorios" icon={<Bell size={14} />}
      accion={<button onClick={() => navigate('/agenda')} className="text-[10px] font-black uppercase text-primario hover:underline">Ver agenda</button>}>
      {cargando ? <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" /> : recordatorios.length === 0 ? (
        <p className="py-8 text-center text-sm font-bold text-slate-400">Sin seguimientos para los próximos 3 días.</p>
      ) : (
        <div className="space-y-2">
          {recordatorios.slice(0, 6).map(t => (
            <button key={t.id} onClick={() => navigate('/agenda')} className="w-full text-left p-3 bg-amber-50 rounded-2xl hover:bg-amber-100 transition">
              <p className="text-[10px] font-black text-amber-700 uppercase">{t.recordatorio_fecha <= hoy ? 'Para hoy o vencido' : t.recordatorio_fecha.split('-').reverse().slice(0, 2).join('/')}</p>
              <p className="font-bold text-slate-700 text-sm truncate">{t.titulo}</p>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
