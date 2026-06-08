import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

export default function Dashboard({ session }) {
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Función para obtener los datos
  const fetchData = async () => {
    const [vData, gData] = await Promise.all([
      supabase.from('ventas').select('*'),
      supabase.from('gastos').select('*')
    ]);
    setVentas(vData.data || []);
    setGastos(gData.data || []);
    setCargando(false);
  };

  useEffect(() => {
    // 1. Carga inicial
    fetchData();


    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => {
        console.log('Cambio en ventas detectado, actualizando...');
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
        console.log('Cambio en gastos detectado, actualizando...');
        fetchData();
      })
      .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Cálculos
  const totalPagado = (ventas || []).filter(v => v.estado === 'pagado').reduce((acc, v) => acc + (Number(v.monto) || 0), 0);
  const totalPendiente = (ventas || []).filter(v => v.estado === 'pendiente').reduce((acc, v) => acc + (Number(v.monto) || 0), 0);
  const totalGastos = (gastos || []).reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  const dataGrafica = [
    { name: 'Pagado', valor: totalPagado },
    { name: 'Gastos', valor: totalGastos },
    { name: 'Pendiente', valor: totalPendiente },
  ];

  if (cargando) return <div className="p-8 text-slate-400">Cargando sistema...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Panel de Control</h2>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600"><DollarSign size={24}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Ingresos Pagados</p>
            <p className="text-2xl font-black text-slate-900">${totalPagado.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-amber-100 p-4 rounded-2xl text-amber-600"><AlertCircle size={24}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Cartera Vencida</p>
            <p className="text-2xl font-black text-amber-600">${totalPendiente.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-rose-100 p-4 rounded-2xl text-rose-600"><TrendingUp size={24}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Gastos</p>
            <p className="text-2xl font-black text-rose-600">${totalGastos.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* GRÁFICA Y LISTA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-700 mb-6 uppercase text-sm">Resumen Financiero</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataGrafica}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="valor" radius={[10, 10, 0, 0]}>
                  {dataGrafica.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#f43f5e' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-700 mb-6 uppercase text-sm">Últimos Pendientes</h3>
          <div className="space-y-4">
            {(ventas || []).filter(v => v.estado === 'pendiente').slice(0, 5).map(v => (
              <div key={v.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="font-bold text-slate-800">{v.cliente}</p>
                  <p className="text-xs text-slate-400">{v.fecha}</p>
                </div>
                <span className="font-black text-amber-600">${Number(v.monto).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}