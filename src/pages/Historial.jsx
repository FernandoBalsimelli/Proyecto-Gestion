import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit2, Trash2, FileText, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

export default function Historial({ session }) {
  const navigate = useNavigate(); 
  const [ventas, setVentas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetchVentas();
  }, []);

  const fetchVentas = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .order('fecha', { ascending: false });

    if (!error) setVentas(data || []);
    setCargando(false);
  };

  const eliminarVenta = async (id) => {
    if (window.confirm("¿Seguro que quieres eliminar este registro?")) {
      const { error } = await supabase.from('ventas').delete().eq('id', id);
      if (!error) fetchVentas();
    }
  };


  const cargarParaEditar = (venta) => {
    navigate('/presupuestos', { state: { ventaEditar: venta } });
  };

  const ventasFiltradas = (ventas || []).filter(v => 
    v.cliente.toLowerCase().includes(busqueda.toLowerCase()) || 
    v.descripcion.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Historial</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={20}/>
          <input 
            className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none w-full md:w-80 font-bold text-slate-700 shadow-sm"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {cargando ? (
          <p className="text-center p-10 font-bold text-slate-400">Cargando historial...</p>
        ) : (
          ventasFiltradas.map((v) => (
            <div key={v.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 hover:border-blue-300 transition">
              <div className="flex items-center gap-4 w-full">
                <div className={`p-3 rounded-2xl ${v.estado === 'pagado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  <FileText size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-slate-800 text-lg">{v.cliente}</h4>
                  <p className="text-sm text-slate-500">{v.descripcion}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total</p>
                  <p className="font-black text-lg text-slate-900">${Number(v.monto).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => cargarParaEditar(v)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => eliminarVenta(v.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-xl transition">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}