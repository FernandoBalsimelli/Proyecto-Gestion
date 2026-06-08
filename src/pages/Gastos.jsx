import React, { useState, useEffect } from 'react';
import { DollarSign, Fuel, Hammer, Utensils, Trash2, PlusCircle, Receipt, Truck } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

export default function Gastos({ session }) {
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(false);


  const [nuevoGasto, setNuevoGasto] = useState({
    descripcion: '',
    categoria: 'Materiales',
    monto: '',
    proveedor: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  // CARGAR GASTOS DE SUPABASE
  const fetchGastos = async () => {
    try {
      const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGastos(data || []);
    } catch (error) {
      console.error('Error al cargar gastos:', error.message);
    }
  };

  useEffect(() => {
    fetchGastos();
  }, []);

  // GUARDAR GASTO EN SUPABASE
  const agregarGasto = async (e) => {
    e.preventDefault();
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) {
      return alert("Por favor llena la descripción y el monto");
    }

    setCargando(true);
    try {
      const { error } = await supabase
        .from('gastos')
        .insert([{
          user_id: session.user.id,
          descripcion: nuevoGasto.descripcion,
          categoria: nuevoGasto.categoria,
          monto: parseFloat(nuevoGasto.monto),
          proveedor: nuevoGasto.proveedor,
          fecha: nuevoGasto.fecha
        }]);

      if (error) throw error;

      await fetchGastos();
      // Limpiar formulario
      setNuevoGasto({
        descripcion: '',
        categoria: 'Materiales',
        monto: '',
        proveedor: '',
        fecha: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      alert("Error al registrar gasto: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  // ELIMINAR GASTO EN SUPABASE
  const eliminarGasto = async (id) => {
    if (window.confirm("¿Seguro que deseas eliminar este gasto?")) {
      try {
        const { error } = await supabase
          .from('gastos')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await fetchGastos();
      } catch (error) {
        alert("Error al eliminar: " + error.message);
      }
    }
  };

  const totalGastos = gastos.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">Control de Gastos</h2>
          <p className="text-slate-500 font-medium">Registro de insumos, combustible y viáticos</p>
        </div>
        <div className="bg-red-50 border border-red-100 px-6 py-3 rounded-2xl min-w-[200px]">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Total Acumulado</p>
          <p className="text-2xl font-black text-red-600">${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULARIO */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-fit sticky top-8">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <PlusCircle className="text-blue-500" size={20}/> Nuevo Registro
          </h3>
          <form onSubmit={agregarGasto} className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Descripción</label>
              <input 
                type="text" 
                placeholder="Ej. Gasolina Ford Ranger" 
                className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition border border-slate-100"
                value={nuevoGasto.descripcion} 
                onChange={e => setNuevoGasto({...nuevoGasto, descripcion: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Monto ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00" 
                  className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition font-bold border border-slate-100"
                  value={nuevoGasto.monto} 
                  onChange={e => setNuevoGasto({...nuevoGasto, monto: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Categoría</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100"
                  value={nuevoGasto.categoria} 
                  onChange={e => setNuevoGasto({...nuevoGasto, categoria: e.target.value})}
                >
                  <option value="Materiales">Materiales</option>
                  <option value="Combustible">Combustible</option>
                  <option value="Viáticos">Viáticos</option>
                  <option value="Herramientas">Herramientas</option>
                  <option value="Servicios">Servicios</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Proveedor (Opcional)</label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Ej. The Home Depot" 
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition border border-slate-100"
                  value={nuevoGasto.proveedor} 
                  onChange={e => setNuevoGasto({...nuevoGasto, proveedor: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={cargando}
              className="w-full mt-2 bg-slate-900 text-white p-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
            >
              {cargando ? 'Registrando...' : 'Registrar Gasto'}
            </button>
          </form>
        </div>

        {/* LISTA DE GASTOS */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Receipt size={18} className="text-slate-400"/>
            <span className="font-bold text-slate-600">Historial de Movimientos</span>
          </div>
          <div className="divide-y divide-slate-50 overflow-y-auto flex-1 p-2">
            {gastos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Receipt size={48} className="opacity-20" />
                <p className="font-medium">No hay gastos registrados todavía.</p>
              </div>
            ) : (
              gastos.map(g => (
                <div key={g.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-slate-50 transition rounded-2xl group">
                  <div className="flex items-center gap-4 mb-2 sm:mb-0">
                    <div className="p-3 bg-slate-100 rounded-2xl text-slate-500 shrink-0">
                      {g.categoria === 'Combustible' && <Fuel size={20} />}
                      {g.categoria === 'Materiales' && <Hammer size={20} />}
                      {g.categoria === 'Viáticos' && <Utensils size={20} />}
                      {(g.categoria === 'Herramientas' || g.categoria === 'Servicios') && <DollarSign size={20} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-lg leading-tight">{g.descripcion}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs font-medium text-slate-400">
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{g.categoria}</span>
                        <span>•</span>
                        <span>{g.fecha}</span>
                        {g.proveedor && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{g.proveedor}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                    <span className="font-black text-red-500 text-lg">
                      -${Number(g.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                    <button 
                      onClick={() => eliminarGasto(g.id)} 
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
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