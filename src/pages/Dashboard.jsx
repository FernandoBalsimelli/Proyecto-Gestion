import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, AlertCircle, TrendingDown, FileText, Clock, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';

export default function Dashboard({ session }) {
  const { negocioId, puede, nombreNegocio } = useNegocio();
  const verFinanzas = puede('ver_finanzas');

  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);

  /* ─────────── Carga de datos ─────────── */
  const fetchData = async () => {
    if (!negocioId) return;

    // Ventas: las ve cualquier miembro
    const { data: vData, error: vError } = await supabase
      .from('ventas')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('fecha', { ascending: false });

    if (vError) console.error('Error al cargar ventas:', vError.message);
    setVentas(vData || []);

    // Gastos: sólo si tiene permiso (RLS igual lo bloquearía)
    if (verFinanzas) {
      const { data: gData, error: gError } = await supabase
        .from('gastos')
        .select('*')
        .eq('negocio_id', negocioId);

      if (gError) console.error('Error al cargar gastos:', gError.message);
      setGastos(gData || []);
    } else {
      setGastos([]);
    }

    setCargando(false);
  };

  /* ─────────── Realtime ─────────── */
  useEffect(() => {
    if (!negocioId) return;

    fetchData();

    const canal = supabase
      .channel(`dashboard-${negocioId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ventas',
        filter: `negocio_id=eq.${negocioId}`,
      }, fetchData)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gastos',
        filter: `negocio_id=eq.${negocioId}`,
      }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, verFinanzas]);

  /* ─────────── Cálculos ─────────── */
  const num = (v) => Number(v) || 0;

  const pagadas    = ventas.filter(v => v.estado === 'pagado');
  const pendientes = ventas.filter(v => v.estado !== 'pagado');

  const totalPagado    = pagadas.reduce((acc, v) => acc + num(v.monto), 0);
  const totalPendiente = pendientes.reduce((acc, v) => acc + num(v.monto), 0);
  const totalGastos    = gastos.reduce((acc, g) => acc + num(g.monto), 0);
  const utilidad       = totalPagado - totalGastos;

  const money = (n) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const dataGrafica = verFinanzas
    ? [
        { name: 'Cobrado',   valor: totalPagado,    color: '#10b981' },
        { name: 'Gastos',    valor: totalGastos,    color: '#f43f5e' },
        { name: 'Pendiente', valor: totalPendiente, color: '#f59e0b' },
      ]
    : [
        { name: 'Cobrado',   valor: totalPagado,    color: '#10b981' },
        { name: 'Pendiente', valor: totalPendiente, color: '#f59e0b' },
      ];

  /* ─────────── Estados de carga ─────────── */
  if (!negocioId || cargando) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-10 w-72 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-slate-200 rounded-3xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  /* ─────────── Tarjeta reutilizable ─────────── */
  const Tarjeta = ({ icon, bg, text, label, valor, destacado }) => (
    <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-4 ${
      destacado ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
    }`}>
      <div className={`${bg} ${text} p-4 rounded-2xl shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-[10px] font-black uppercase tracking-widest ${
          destacado ? 'text-slate-400' : 'text-slate-400'
        }`}>{label}</p>
        <p className={`text-2xl font-black tracking-tighter truncate ${
          destacado ? (valor >= 0 ? 'text-white' : 'text-rose-400') : 'text-slate-900'
        }`}>
          {money(valor)}
        </p>
      </div>
    </div>
  );

  /* ─────────── Render ─────────── */
  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">
            Panel de Control
          </h2>
          <p className="text-slate-500 font-medium text-sm">
            {nombreNegocio || 'Resumen operativo'} · {ventas.length} documentos registrados
          </p>
        </div>
        {!verFinanzas && (
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-1.5 w-fit">
            <Lock size={12} /> Vista limitada
          </span>
        )}
      </div>

      {/* Tarjetas */}
      <div className={`grid grid-cols-1 gap-6 ${verFinanzas ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'}`}>
        <Tarjeta
          icon={<DollarSign size={24} />}
          bg="bg-emerald-100" text="text-emerald-600"
          label="Ingresos Cobrados" valor={totalPagado}
        />
        <Tarjeta
          icon={<AlertCircle size={24} />}
          bg="bg-amber-100" text="text-amber-600"
          label="Por Cobrar" valor={totalPendiente}
        />
        {verFinanzas && (
          <>
            <Tarjeta
              icon={<TrendingDown size={24} />}
              bg="bg-rose-100" text="text-rose-600"
              label="Total Egresos" valor={totalGastos}
            />
            <Tarjeta
              icon={<DollarSign size={24} />}
              bg="bg-white/10" text="text-blue-400"
              label="Utilidad Neta" valor={utilidad} destacado
            />
          </>
        )}
      </div>

      {/* Gráfica + Pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Gráfica */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-700 mb-6 uppercase text-xs tracking-widest">
            Resumen Financiero
          </h3>
          {ventas.length === 0 && gastos.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate-300 gap-3">
              <FileText size={48} className="opacity-40" />
              <p className="font-bold text-slate-400 text-sm">Aún no hay movimientos registrados</p>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataGrafica} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#cbd5e1' }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(v) => money(v)}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="valor" radius={[12, 12, 0, 0]}>
                    {dataGrafica.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Pendientes */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">
              Pendientes de Cobro
            </h3>
            {pendientes.length > 0 && (
              <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg uppercase">
                {pendientes.length}
              </span>
            )}
          </div>

          {pendientes.length === 0 ? (
            <div className="h-[280px] flex flex-col items-center justify-center text-center gap-3">
              <div className="bg-emerald-50 text-emerald-500 p-4 rounded-2xl">
                <DollarSign size={28} />
              </div>
              <div>
                <p className="font-black text-slate-700">Cartera al día</p>
                <p className="text-slate-400 font-medium text-xs mt-1">
                  No tienes cobros pendientes.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {pendientes.slice(0, 8).map(v => (
                <div
                  key={v.id}
                  className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-white p-2 rounded-xl text-amber-500 shadow-sm border border-slate-100 shrink-0">
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {v.cliente || 'Público en General'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">{v.fecha}</p>
                    </div>
                  </div>
                  <span className="font-black text-amber-600 shrink-0">
                    {money(num(v.monto))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}