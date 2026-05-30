import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  BarChart3, 
  Receipt,
  AlertCircle,
  ArrowUpCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export default function Finanzas() {
  const [gastos, setGastos] = useState([]);
  const [ingresosPresupuestos, setIngresosPresupuestos] = useState([]);
  const [otrosIngresos, setOtrosIngresos] = useState([]);
  const [datosGrafica, setDatosGrafica] = useState([]);
  
  const [nuevoMovimiento, setNuevoMovimiento] = useState({ 
    descripcion: '', 
    monto: '', 
    categoria: 'Materiales',
    otraCategoria: '', // Nueva casilla para categoría personalizada
    tipo: 'GASTO' 
  });

  useEffect(() => {
    const gastosGuardados = JSON.parse(localStorage.getItem('erp_gastos')) || [];
    const otrosIngresosGuardados = JSON.parse(localStorage.getItem('erp_otros_ingresos')) || [];
    const presupuestos = JSON.parse(localStorage.getItem('erp_historial_presupuestos')) || [];
    
    const pagados = presupuestos.filter(p => p.estado === 'PAGADO');
    
    setIngresosPresupuestos(pagados);
    setGastos(gastosGuardados);
    setOtrosIngresos(otrosIngresosGuardados);

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataProcesada = meses.map(mes => ({ name: mes, ingresos: 0, gastos: 0 }));

    pagados.forEach(p => {
      const mesIndex = parseInt(p.fecha.split('/')[1]) - 1;
      if (mesIndex >= 0 && mesIndex < 12) dataProcesada[mesIndex].ingresos += p.total;
    });

    otrosIngresosGuardados.forEach(i => {
      const mesIndex = parseInt(i.fecha.split('/')[1]) - 1;
      if (mesIndex >= 0 && mesIndex < 12) dataProcesada[mesIndex].ingresos += i.monto;
    });

    gastosGuardados.forEach(g => {
      const mesIndex = parseInt(g.fecha.split('/')[1]) - 1;
      if (mesIndex >= 0 && mesIndex < 12) dataProcesada[mesIndex].gastos += g.monto;
    });

    setDatosGrafica(dataProcesada.slice(0, new Date().getMonth() + 1));
  }, []);

  const seleccionarTodo = (e) => e.target.select();

  const registrarMovimiento = (e) => {
    e.preventDefault();
    if (!nuevoMovimiento.monto || !nuevoMovimiento.descripcion) return;

    // Lógica para la categoría personalizada
    const categoriaFinal = nuevoMovimiento.categoria === 'OTRO' 
      ? nuevoMovimiento.otraCategoria.toUpperCase() || 'GENERAL'
      : nuevoMovimiento.categoria;

    const registro = {
      id: Date.now(),
      descripcion: nuevoMovimiento.descripcion,
      monto: Math.max(0, parseFloat(nuevoMovimiento.monto) || 0),
      categoria: categoriaFinal,
      fecha: new Date().toLocaleDateString('es-MX')
    };

    if (nuevoMovimiento.tipo === 'GASTO') {
      const actualizados = [registro, ...gastos];
      setGastos(actualizados);
      localStorage.setItem('erp_gastos', JSON.stringify(actualizados));
    } else {
      const actualizados = [registro, ...otrosIngresos];
      setOtrosIngresos(actualizados);
      localStorage.setItem('erp_otros_ingresos', JSON.stringify(actualizados));
    }

    setNuevoMovimiento({ descripcion: '', monto: '', categoria: 'Materiales', otraCategoria: '', tipo: 'GASTO' });
    window.location.reload(); 
  };

  const eliminarMovimiento = (id, tipo) => {
    if (tipo === 'GASTO') {
      const filtrados = gastos.filter(g => g.id !== id);
      setGastos(filtrados);
      localStorage.setItem('erp_gastos', JSON.stringify(filtrados));
    } else {
      const filtrados = otrosIngresos.filter(i => i.id !== id);
      setOtrosIngresos(filtrados);
      localStorage.setItem('erp_otros_ingresos', JSON.stringify(filtrados));
    }
    window.location.reload();
  };

  const totalIngresos = ingresosPresupuestos.reduce((acc, c) => acc + c.total, 0) + otrosIngresos.reduce((acc, c) => acc + c.monto, 0);
  const totalGastos = gastos.reduce((acc, curr) => acc + curr.monto, 0);
  const balance = totalIngresos - totalGastos;

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic">Finanzas Reales</h2>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Control de flujo de caja</p>
      </div>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24}/></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobrado</span>
          </div>
          <p className="text-3xl font-black text-slate-900">${totalIngresos.toLocaleString('es-MX')}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><TrendingDown size={24}/></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gastado</span>
          </div>
          <p className="text-3xl font-black text-slate-900">${totalGastos.toLocaleString('es-MX')}</p>
        </div>

        <div className={`p-6 rounded-3xl border shadow-xl transition-all ${balance >= 0 ? 'bg-slate-900 border-slate-900' : 'bg-orange-600 border-orange-600'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 text-white rounded-2xl"><Wallet size={24}/></div>
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Utilidad Neta</span>
          </div>
          <p className="text-3xl font-black text-white">${balance.toLocaleString('es-MX')}</p>
        </div>
      </div>

      {/* GRÁFICA RESTAURADA */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datosGrafica}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: '700', fill: '#94a3b8'}} dy={10} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" name="Ingresos ($)" />
              <Area type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorGastos)" name="Gastos ($)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        {/* REGISTRO CON CAMPO "OTRO" */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-6 uppercase text-[10px] font-black tracking-widest text-slate-400">
            <ArrowUpCircle size={18}/> Nuevo Movimiento
          </div>
          <form onSubmit={registrarMovimiento} className="space-y-4">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                <button type="button" onClick={() => setNuevoMovimiento({...nuevoMovimiento, tipo: 'GASTO'})} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition ${nuevoMovimiento.tipo === 'GASTO' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500'}`}>Gasto</button>
                <button type="button" onClick={() => setNuevoMovimiento({...nuevoMovimiento, tipo: 'INGRESO'})} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition ${nuevoMovimiento.tipo === 'INGRESO' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-500'}`}>Ingreso</button>
            </div>
            
            <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold" value={nuevoMovimiento.descripcion} onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, descripcion: e.target.value})} placeholder="Ej. Gasolina o Asesoría" required />
            
            <div className="grid grid-cols-2 gap-4">
              <input type="number" step="0.01" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none font-black" value={nuevoMovimiento.monto} onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, monto: e.target.value})} onFocus={seleccionarTodo} placeholder="0.00" required />
              <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none font-bold" value={nuevoMovimiento.categoria} onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, categoria: e.target.value})}>
                <option>Materiales</option>
                <option>Nómina</option>
                <option>Combustible</option>
                <option>Servicios</option>
                <option value="OTRO">OTRO...</option>
              </select>
            </div>

            {nuevoMovimiento.categoria === 'OTRO' && (
              <input 
                className="w-full p-3 bg-blue-50 rounded-xl border border-blue-100 outline-none font-bold text-blue-700 animate-in fade-in zoom-in duration-200" 
                placeholder="Escribe la categoría" 
                value={nuevoMovimiento.otraCategoria}
                onChange={(e) => setNuevoMovimiento({...nuevoMovimiento, otraCategoria: e.target.value})}
                required
              />
            )}
            
            <button className={`w-full p-4 rounded-2xl font-black text-white transition-all shadow-lg active:scale-95 ${nuevoMovimiento.tipo === 'GASTO' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
              Registrar {nuevoMovimiento.tipo}
            </button>
          </form>
        </div>

        {/* HISTORIAL */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 mb-6 uppercase tracking-widest text-[10px]">Movimientos Manuales</h3>
          <div className="space-y-3">
            {[...gastos, ...otrosIngresos].sort((a,b) => b.id - a.id).map((m) => {
              const esGasto = gastos.some(g => g.id === m.id);
              return (
                <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100">
                  <div className="flex gap-4 items-center">
                    <div className={`p-2 rounded-xl ${esGasto ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        {esGasto ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-700">{m.descripcion}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{m.fecha} — {m.categoria}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className={`font-black text-sm ${esGasto ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {esGasto ? '-' : '+'}${m.monto.toLocaleString('es-MX')}
                    </p>
                    <button onClick={() => eliminarMovimiento(m.id, esGasto ? 'GASTO' : 'INGRESO')} className="text-slate-200 hover:text-rose-500 transition-colors">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}