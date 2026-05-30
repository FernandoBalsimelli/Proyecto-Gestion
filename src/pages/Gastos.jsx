import React, { useState, useEffect } from 'react';
import { DollarSign, Fuel, Hammer, Utensils, Trash2, PlusCircle, Receipt } from 'lucide-react';

export default function Gastos() {
  // 1. Cargar gastos guardados al iniciar
  const [gastos, setGastos] = useState(() => {
    const saved = localStorage.getItem('erp_gastos');
    return saved ? JSON.parse(saved) : [];
  });

  const [nuevoGasto, setNuevoGasto] = useState({
    concepto: '',
    categoria: 'Materiales',
    monto: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  // 2. Guardar automáticamente cuando cambie la lista
  useEffect(() => {
    localStorage.setItem('erp_gastos', JSON.stringify(gastos));
  }, [gastos]);

  const agregarGasto = (e) => {
    e.preventDefault();
    if (!nuevoGasto.concepto || !nuevoGasto.monto) return alert("Por favor llena el concepto y el monto");
    
    const gastoConId = { ...nuevoGasto, id: Date.now(), monto: parseFloat(nuevoGasto.monto) };
    setGastos([gastoConId, ...gastos]);
    
    // Limpiar formulario
    setNuevoGasto({
      concepto: '',
      categoria: 'Materiales',
      monto: '',
      fecha: new Date().toISOString().split('T')[0]
    });
  };

  const eliminarGasto = (id) => {
    setGastos(gastos.filter(g => g.id !== id));
  };

  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0);

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Control de Gastos</h2>
          <p className="text-slate-500 font-medium">Registro de insumos, combustible y viáticos</p>
        </div>
        <div className="bg-red-50 border border-red-100 px-6 py-3 rounded-2xl">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Total Acumulado</p>
          <p className="text-2xl font-black text-red-600">${totalGastos.toLocaleString('es-MX')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <PlusCircle className="text-blue-500" size={20}/> Nuevo Registro
          </h3>
          <form onSubmit={agregarGasto} className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Concepto</label>
              <input type="text" placeholder="Ej. Gasolina Ford Ranger" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={nuevoGasto.concepto} onChange={e => setNuevoGasto({...nuevoGasto, concepto: e.target.value})}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Monto ($)</label>
                <input type="number" placeholder="0.00" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition font-bold"
                  value={nuevoGasto.monto} onChange={e => setNuevoGasto({...nuevoGasto, monto: e.target.value})}/>
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Categoría</label>
                <select className="w-full p-3 bg-slate-50 rounded-xl outline-none"
                  value={nuevoGasto.categoria} onChange={e => setNuevoGasto({...nuevoGasto, categoria: e.target.value})}>
                  <option value="Materiales">Materiales</option>
                  <option value="Combustible">Combustible</option>
                  <option value="Viáticos">Viáticos</option>
                  <option value="Herramientas">Herramientas</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
              Registrar Gasto
            </button>
          </form>
        </div>

        {/* Lista de Gastos */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Receipt size={18} className="text-slate-400"/>
            <span className="font-bold text-slate-600">Historial de Movimientos</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {gastos.length === 0 ? (
              <p className="p-10 text-center text-slate-400 italic">No hay gastos registrados todavía.</p>
            ) : (
              gastos.map(g => (
                <div key={g.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 rounded-2xl text-slate-500">
                      {g.categoria === 'Combustible' && <Fuel size={20} />}
                      {g.categoria === 'Materiales' && <Hammer size={20} />}
                      {g.categoria === 'Viáticos' && <Utensils size={20} />}
                      {g.categoria === 'Herramientas' && <DollarSign size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{g.concepto}</p>
                      <p className="text-xs font-medium text-slate-400">{g.fecha} • {g.categoria}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-black text-red-500 text-lg">-${g.monto.toLocaleString('es-MX')}</span>
                    <button onClick={() => eliminarGasto(g.id)} className="text-slate-300 hover:text-red-500 transition">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}