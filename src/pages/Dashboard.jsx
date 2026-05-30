import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  FileText, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Users,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    ingresosReales: 0,
    pendientesCobro: 0,
    totalPresupuestos: 0,
    clientesActivos: 0
  });
  const [graficaData, setGraficaData] = useState([]);

  useEffect(() => {
    // 1. Cargar datos de LocalStorage
    const presupuestos = JSON.parse(localStorage.getItem('erp_historial_presupuestos')) || [];
    const clientes = JSON.parse(localStorage.getItem('erp_clientes')) || [];
    const otrosIngresos = JSON.parse(localStorage.getItem('erp_otros_ingresos')) || [];

    // 2. Filtrar Ingresos Reales (Presupuestos PAGADOS + Otros Ingresos)
    const pagados = presupuestos.filter(p => p.estado === 'PAGADO');
    const pendientes = presupuestos.filter(p => p.estado !== 'PAGADO');

    const sumaPagados = pagados.reduce((acc, p) => acc + p.total, 0);
    const sumaOtros = otrosIngresos.reduce((acc, i) => acc + i.monto, 0);
    const sumaPendientes = pendientes.reduce((acc, p) => acc + p.total, 0);

    setStats({
      ingresosReales: sumaPagados + sumaOtros,
      pendientesCobro: sumaPendientes,
      totalPresupuestos: presupuestos.length,
      clientesActivos: clientes.length
    });

    // 3. Preparar datos para la gráfica (Comparativa Real vs Pendiente)
    const dataComp = [
      { name: 'Cobrado', monto: sumaPagados + sumaOtros, color: '#10b981' },
      { name: 'Pendiente', monto: sumaPendientes, color: '#f59e0b' }
    ];
    setGraficaData(dataComp);

  }, []);

  const tarjetas = [
    { 
      label: 'Ingresos Reales', 
      valor: `$${stats.ingresosReales.toLocaleString('es-MX')}`, 
      icon: <CheckCircle2 className="text-emerald-500"/>, 
      bg: 'bg-emerald-50',
      desc: 'Dinero ya cobrado'
    },
    { 
      label: 'Por Cobrar', 
      valor: `$${stats.pendientesCobro.toLocaleString('es-MX')}`, 
      icon: <Clock className="text-amber-500"/>, 
      bg: 'bg-amber-50',
      desc: 'Presupuestos pendientes'
    },
    { 
      label: 'Cotizaciones', 
      valor: stats.totalPresupuestos, 
      icon: <FileText className="text-blue-500"/>, 
      bg: 'bg-blue-50',
      desc: 'Total en historial'
    },
    { 
      label: 'Clientes', 
      valor: stats.clientesActivos, 
      icon: <Users className="text-indigo-500"/>, 
      bg: 'bg-indigo-50',
      desc: 'En tu base de datos'
    },
  ];

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div>
        <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter italic">Panel de Control</h2>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Resumen operativo y financiero</p>
      </div>

      {/* TARJETAS DE MÉTRICAS REALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tarjetas.map((t, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-4 ${t.bg} rounded-2xl group-hover:scale-110 transition-transform`}>
                {t.icon}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.label}</span>
            </div>
            <p className="text-3xl font-black text-slate-900 mb-1">{t.valor}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{t.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* GRÁFICA DE FLUJO */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600"/> Estado de Cartera
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficaData} barSize={60}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fontBold: '800', fill: '#64748b'}}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="monto" radius={[15, 15, 15, 15]}>
                  {graficaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AVISOS RÁPIDOS */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
          <h3 className="font-black uppercase text-[10px] tracking-[0.2em] mb-6 text-blue-400">Notificaciones</h3>
          <div className="space-y-6">
            {stats.pendientesCobro > 0 ? (
              <div className="flex gap-4 items-start border-l-2 border-amber-500 pl-4">
                <AlertCircle className="text-amber-500 shrink-0" size={20}/>
                <div>
                  <p className="font-bold text-sm">Cobros Pendientes</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1">
                    Tienes ${stats.pendientesCobro.toLocaleString()} por recuperar en presupuestos no marcados como pagados.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 items-start border-l-2 border-emerald-500 pl-4">
                <CheckCircle2 className="text-emerald-500 shrink-0" size={20}/>
                <div>
                  <p className="font-bold text-sm">Cartera Limpia</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1">Todos tus presupuestos están al día.</p>
                </div>
              </div>
            )}
            
            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Recordatorio Técnico</p>
              <p className="text-xs font-medium text-slate-300 leading-relaxed">
                Recuerda que los ingresos se sincronizan automáticamente con tu historial de presupuestos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}