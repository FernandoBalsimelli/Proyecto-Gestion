import React from 'react';
import { useNegocio } from '../context/NegocioContext.jsx';
import { LayoutDashboard, ChevronUp, ChevronDown, Check } from 'lucide-react';

export const CATALOGO_WIDGETS = {
  // ── Indicadores ──
  ingresos:         { label: 'Dinero recibido',      tipo: 'kpi' },
  por_cobrar:       { label: 'Por cobrar (saldo)',   tipo: 'kpi' },
  egresos:          { label: 'Total egresos',        tipo: 'kpi', permiso: 'ver_finanzas' },
  utilidad:         { label: 'Utilidad neta',        tipo: 'kpi', permiso: 'ver_finanzas' },
  num_cotizaciones: { label: 'N.º de cotizaciones',  tipo: 'kpi' },
  ticket_promedio:  { label: 'Ticket promedio',      tipo: 'kpi' },
  tasa_cierre:      { label: 'Tasa de cierre (%)',   tipo: 'kpi' },
  clientes_activos: { label: 'Clientes registrados', tipo: 'kpi' },
  agenda_kpi:       { label: 'Trabajos abiertos',    tipo: 'kpi' },

  // ── Bloques ──
  agenda_hoy:       { label: 'Agenda de hoy',        tipo: 'bloque' },
  agenda_proximos:  { label: 'Próximos 7 días',      tipo: 'bloque' },
  grafica_cartera:  { label: 'Gráfica de cartera',   tipo: 'bloque' },
  tendencia:        { label: 'Tendencia mensual',    tipo: 'bloque' },
  cobranza:         { label: 'Cobranza pendiente',   tipo: 'bloque' },
  abonos:           { label: 'Últimos abonos',       tipo: 'bloque' },
  top_clientes:     { label: 'Top 5 clientes',       tipo: 'bloque' },
  gastos_categoria: { label: 'Gastos por categoría', tipo: 'bloque', permiso: 'ver_finanzas' },
  ultimas:          { label: 'Últimas cotizaciones', tipo: 'bloque' },
};

export default function DashboardConfig() {
  const { dashboardCfg, setDashboardCfg, puede } = useNegocio();

  // Descartamos ids que ya no existen en el catálogo (config vieja guardada en BD).
  const activos = (dashboardCfg.widgets || []).filter(id => CATALOGO_WIDGETS[id]);

  const toggle = (id) => setDashboardCfg({
    ...dashboardCfg,
    widgets: activos.includes(id) ? activos.filter(w => w !== id) : [...activos, id],
  });

  const mover = (i, dir) => {
    const n = [...activos];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setDashboardCfg({ ...dashboardCfg, widgets: n });
  };

  const disponibles = Object.entries(CATALOGO_WIDGETS)
    .filter(([, w]) => !w.permiso || puede(w.permiso));

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
      <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
        <LayoutDashboard size={18} /> Panel de control
      </h3>

      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
          Orden de los elementos activos
        </p>
        {activos.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium bg-slate-50 p-4 rounded-2xl text-center">
            No hay elementos seleccionados.
          </p>
        ) : (
          <div className="space-y-2">
            {activos.map((id, i) => {
              const w = CATALOGO_WIDGETS[id];
              return (
                <div key={id} className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-300 w-5">{i + 1}</span>
                  <span className="flex-1 font-bold text-sm text-slate-700 truncate">{w.label}</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-500 shrink-0">
                    {w.tipo}
                  </span>
                  <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"
                    className="p-1.5 text-slate-400 hover:text-primario disabled:opacity-20"><ChevronUp size={16} /></button>
                  <button onClick={() => mover(i, 1)} disabled={i === activos.length - 1} aria-label="Bajar"
                    className="p-1.5 text-slate-400 hover:text-primario disabled:opacity-20"><ChevronDown size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Elementos disponibles</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {disponibles.map(([id, w]) => {
            const on = activos.includes(id);
            return (
              <button key={id} type="button" onClick={() => toggle(id)}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition ${
                  on ? 'border-primario bg-primario-suave' : 'border-slate-100 hover:border-slate-300'}`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                  on ? 'bg-primario text-white' : 'bg-slate-200'}`}>
                  {on && <Check size={13} strokeWidth={3} />}
                </div>
                <span className={`font-bold text-sm ${on ? 'text-primario-dark' : 'text-slate-600'}`}>{w.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Periodo por defecto</p>
        <select value={dashboardCfg.periodo_default || 'mes'}
          onChange={(e) => setDashboardCfg({ ...dashboardCfg, periodo_default: e.target.value })}
          className="w-full md:w-64 p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none">
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="trimestre">Trimestre</option>
          <option value="anio">Este año</option>
          <option value="todo">Todo</option>
        </select>
      </div>
    </div>
  );
}