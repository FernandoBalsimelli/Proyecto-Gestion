import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  DollarSign, AlertCircle, TrendingDown, FileText, Clock, Lock,
  Wallet, Users, Percent, Receipt, Trophy,
} from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { CATALOGO_WIDGETS } from '../components/DashboardConfig.jsx';
import FiltroPeriodo from '../components/FiltroPeriodo.jsx';
import { rangoFechas, enRango } from '../utils/fecha.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v) => Number(v) || 0;

/* ── Componentes base (fuera para no perder foco) ── */
function Kpi({ icon, bg, text, label, valor, destacado }) {
  return (
    <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-4 ${
      destacado ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}>
      <div className={`${bg} ${text} p-4 rounded-2xl shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className={`text-2xl font-black tracking-tighter truncate ${
          destacado ? 'text-white' : 'text-slate-900'}`}>{valor}</p>
      </div>
    </div>
  );
}

function Panel({ titulo, icon, children }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="font-black text-slate-700 mb-6 uppercase text-xs tracking-widest flex items-center gap-2">
        {icon} {titulo}
      </h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 16, border: '1px solid #e2e8f0',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: 12,
};

/* ══════════════ DASHBOARD ══════════════ */
export default function Dashboard({ session }) {
  const { negocioId, puede, nombreNegocio, dashboardCfg } = useNegocio();
  const verFinanzas = puede('ver_finanzas');

  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [clientes, setClientes] = useState(0);
  const [cargando, setCargando] = useState(true);

  const [periodo, setPeriodo] = useState(dashboardCfg?.periodo_default || 'mes');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });

  useEffect(() => { setPeriodo(dashboardCfg?.periodo_default || 'mes'); }, [dashboardCfg?.periodo_default]);

  const fetchData = async () => {
    if (!negocioId) return;
    const [v, g, c] = await Promise.all([
      supabase.from('ventas').select('*').eq('negocio_id', negocioId).order('fecha', { ascending: false }),
      verFinanzas
        ? supabase.from('gastos').select('*').eq('negocio_id', negocioId)
        : Promise.resolve({ data: [] }),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('negocio_id', negocioId),
    ]);
    setVentas(v.data || []);
    setGastos(g.data || []);
    setClientes(c.count || 0);
    setCargando(false);
  };

  useEffect(() => {
    if (!negocioId) return;
    fetchData();
    const canal = supabase.channel(`dash-${negocioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas', filter: `negocio_id=eq.${negocioId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos', filter: `negocio_id=eq.${negocioId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, verFinanzas]);

  /* ── Filtrado por periodo ── */
  const rango = useMemo(() => rangoFechas(periodo, custom), [periodo, custom]);
  const fVentas = useMemo(
    () => periodo === 'todo' ? ventas : ventas.filter(v => enRango(v.fecha, rango)),
    [ventas, rango, periodo]);
  const fGastos = useMemo(
    () => periodo === 'todo' ? gastos : gastos.filter(g => enRango(g.fecha, rango)),
    [gastos, rango, periodo]);

  /* ── Métricas ── */
  const d = useMemo(() => {
    const pagadas    = fVentas.filter(v => v.estado === 'pagado');
    const pendientes = fVentas.filter(v => v.estado === 'pendiente');
    const canceladas = fVentas.filter(v => v.estado === 'cancelado');
    const cobrado    = pagadas.reduce((a, v) => a + num(v.monto), 0);
    const porCobrar  = pendientes.reduce((a, v) => a + num(v.monto), 0);
    const egresos    = fGastos.reduce((a, g) => a + num(g.monto), 0);
    const cerradas   = pagadas.length + pendientes.length + canceladas.length;

    // Top clientes
    const porCliente = {};
    pagadas.forEach(v => {
      const k = v.cliente || 'Público en General';
      porCliente[k] = (porCliente[k] || 0) + num(v.monto);
    });
    const top = Object.entries(porCliente)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, valor]) => ({ name, valor }));

    // Gastos por categoría
    const porCat = {};
    fGastos.forEach(g => {
      const k = g.categoria || 'Otros';
      porCat[k] = (porCat[k] || 0) + num(g.monto);
    });
    const cats = Object.entries(porCat).map(([name, value]) => ({ name, value }));

    // Tendencia (últimos 6 meses, ignora el filtro)
    const meses = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const pref = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`;
      meses.push({
        name: dd.toLocaleDateString('es-MX', { month: 'short' }),
        ingresos: ventas.filter(v => v.estado === 'pagado' && v.fecha?.startsWith(pref)).reduce((a, v) => a + num(v.monto), 0),
        egresos: gastos.filter(g => g.fecha?.startsWith(pref)).reduce((a, g) => a + num(g.monto), 0),
      });
    }

    return {
      pagadas, pendientes, canceladas, cobrado, porCobrar, egresos,
      utilidad: cobrado - egresos,
      total: fVentas.length,
      ticket: pagadas.length ? cobrado / pagadas.length : 0,
      cierre: cerradas ? (pagadas.length / cerradas) * 100 : 0,
      top, cats, meses,
    };
  }, [fVentas, fGastos, ventas, gastos]);

  const COLORES = ['#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  /* ── Definición de widgets ── */
  const W = {
    ingresos: () => <Kpi icon={<DollarSign size={24} />} bg="bg-emerald-100" text="text-emerald-600" label="Ingresos cobrados" valor={money(d.cobrado)} />,
    por_cobrar: () => <Kpi icon={<AlertCircle size={24} />} bg="bg-amber-100" text="text-amber-600" label="Por cobrar" valor={money(d.porCobrar)} />,
    egresos: () => <Kpi icon={<TrendingDown size={24} />} bg="bg-rose-100" text="text-rose-600" label="Total egresos" valor={money(d.egresos)} />,
    utilidad: () => <Kpi icon={<Wallet size={24} />} bg="bg-white/10" text="text-blue-400" label="Utilidad neta" valor={money(d.utilidad)} destacado />,
    num_cotizaciones: () => <Kpi icon={<FileText size={24} />} bg="bg-slate-100" text="text-slate-600" label="Cotizaciones" valor={d.total} />,
    ticket_promedio: () => <Kpi icon={<Receipt size={24} />} bg="bg-violet-100" text="text-violet-600" label="Ticket promedio" valor={money(d.ticket)} />,
    tasa_cierre: () => <Kpi icon={<Percent size={24} />} bg="bg-cyan-100" text="text-cyan-600" label="Tasa de cierre" valor={`${d.cierre.toFixed(0)}%`} />,
    clientes_activos: () => <Kpi icon={<Users size={24} />} bg="bg-indigo-100" text="text-indigo-600" label="Clientes" valor={clientes} />,

    grafica_cartera: () => (
      <Panel titulo="Estado de cartera" icon={<BarChartIcon />}>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { name: 'Cobrado', valor: d.cobrado, c: '#10b981' },
              ...(verFinanzas ? [{ name: 'Egresos', valor: d.egresos, c: '#f43f5e' }] : []),
              { name: 'Pendiente', valor: d.porCobrar, c: '#f59e0b' },
            ]} margin={{ top: 10, right: 10, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => money(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="valor" radius={[12, 12, 0, 0]}>
                {[0, 1, 2].map(i => <Cell key={i} fill={['#10b981', '#f43f5e', '#f59e0b'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    ),

    tendencia: () => (
      <Panel titulo="Tendencia · últimos 6 meses">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.meses} margin={{ top: 10, right: 10, left: -10 }}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => money(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" strokeWidth={3} fill="url(#gi)" />
              {verFinanzas && <Area type="monotone" dataKey="egresos" name="Egresos" stroke="#f43f5e" strokeWidth={3} fill="url(#ge)" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    ),

    pendientes: () => (
      <Panel titulo={`Pendientes de cobro (${d.pendientes.length})`} icon={<Clock size={14} />}>
        {d.pendientes.length === 0 ? (
          <div className="h-[240px] flex flex-col items-center justify-center gap-3 text-center">
            <div className="bg-emerald-50 text-emerald-500 p-4 rounded-2xl"><DollarSign size={28} /></div>
            <p className="font-black text-slate-700">Cartera al día</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {d.pendientes.slice(0, 8).map(v => (
              <div key={v.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{v.cliente || 'Público en General'}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{v.fecha}</p>
                </div>
                <span className="font-black text-amber-600 shrink-0">{money(v.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),

    top_clientes: () => (
      <Panel titulo="Top 5 clientes" icon={<Trophy size={14} />}>
        {d.top.length === 0 ? <p className="text-slate-400 text-sm font-medium py-10 text-center">Sin datos en este periodo.</p> : (
          <div className="space-y-3">
            {d.top.map((c, i) => {
              const pct = (c.valor / d.top[0].valor) * 100;
              return (
                <div key={c.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-bold text-slate-700 truncate">{i + 1}. {c.name}</span>
                    <span className="font-black text-slate-900 shrink-0 ml-2">{money(c.valor)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primario rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    ),

    gastos_categoria: () => (
      <Panel titulo="Gastos por categoría">
        {d.cats.length === 0 ? <p className="text-slate-400 text-sm font-medium py-10 text-center">Sin gastos en este periodo.</p> : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.cats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {d.cats.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v)} contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    ),

    ultimas: () => (
      <Panel titulo="Últimas cotizaciones" icon={<FileText size={14} />}>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {fVentas.slice(0, 8).map(v => (
            <div key={v.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate text-sm">{v.cliente || 'Público en General'}</p>
                <p className="text-[11px] text-slate-400 font-medium">{v.fecha}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                  v.estado === 'pagado' ? 'bg-emerald-100 text-emerald-700'
                  : v.estado === 'cancelado' ? 'bg-slate-200 text-slate-500'
                  : 'bg-amber-100 text-amber-700'}`}>{v.estado}</span>
                <span className="font-black text-slate-800 text-sm">{money(v.monto)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    ),
  };

  const activos = (dashboardCfg?.widgets || []).filter(id => {
    const w = CATALOGO_WIDGETS[id];
    return w && W[id] && (!w.permiso || puede(w.permiso));
  });
  const kpis = activos.filter(id => CATALOGO_WIDGETS[id].tipo === 'kpi');
  const bloques = activos.filter(id => CATALOGO_WIDGETS[id].tipo === 'bloque');

  if (!negocioId || cargando) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-10 w-72 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-3xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">Panel de Control</h2>
          <p className="text-slate-500 font-medium text-sm">
            {nombreNegocio} · {fVentas.length} documento(s) en el periodo
          </p>
        </div>
        {!verFinanzas && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-1.5 w-fit">
            <Lock size={12} /> Vista limitada
          </span>
        )}
      </div>

      <FiltroPeriodo valor={periodo} onChange={setPeriodo} custom={custom} onCustom={setCustom} />

      {activos.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
          <p className="font-bold text-slate-500">Tu panel está vacío.</p>
          <p className="text-slate-400 text-sm mt-1">Ve a Configuración → Panel de Control para elegir qué mostrar.</p>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {kpis.map(id => <React.Fragment key={id}>{W[id]()}</React.Fragment>)}
        </div>
      )}

      {bloques.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bloques.map(id => <React.Fragment key={id}>{W[id]()}</React.Fragment>)}
        </div>
      )}
    </div>
  );
}

function BarChartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-9"/></svg>;
}