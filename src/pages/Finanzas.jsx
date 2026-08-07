import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { hoyLocal, formatoMX } from '../utils/fecha.js';
import { DollarSign, TrendingDown, Wallet, Plus, Trash2, Calendar, FileText, Tag, Save, LayoutGrid } from 'lucide-react';
import FiltroPeriodo from '../components/FiltroPeriodo.jsx';
import { rangoFechas, enRango } from '../utils/fecha.js';



export default function Finanzas({ session }) {
  const { negocioId, puede, esDueno } = useNegocio();
  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [periodo, setPeriodo] = useState('mes');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });


  // Estados del formulario
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Materiales');
  const [fecha, setFecha] = useState(hoyLocal());
  const rango = useMemo(() => rangoFechas(periodo, custom), [periodo, custom]);
  const fGastos = useMemo(() => periodo === 'todo' ? gastos : gastos.filter(g => enRango(g.fecha, rango)), [gastos, rango, periodo]);
  const fVentas = useMemo(() => periodo === 'todo' ? ventas : ventas.filter(v => enRango(v.fecha, rango)), [ventas, rango, periodo]);
  const ingresosTotales = fVentas.filter(v => v.estado === 'pagado').reduce((a, v) => a + (Number(v.monto) || 0), 0);
  const totalGastos = fGastos.reduce((a, g) => a + (Number(g.monto) || 0), 0);
  const utilidadNeta = ingresosTotales - totalGastos;
  // y renderiza fGastos.map(...) en el historial, no gastos.map(...)
  useEffect(() => {
    fetchFinanzas();
  }, [negocioId]);

  

const fetchFinanzas = async () => {
    if (!negocioId) return;
    const [g, v] = await Promise.all([
      supabase.from('gastos').select('*').eq('negocio_id', negocioId).order('fecha', { ascending: false }),
      supabase.from('ventas').select('monto, fecha, estado').eq('negocio_id', negocioId),
    ]);
    setGastos(g.data || []);
    setVentas(v.data || []);
  };

  const agregarGasto = async (e) => {
    e.preventDefault();
    if (!descripcion || !monto) return alert('Llena la descripción y el monto.');

    setCargando(true);
    try {
      const { error } = await supabase.from('gastos').insert([{
        negocio_id: negocioId,
        user_id: session.user.id,
        descripcion, categoria, monto: Number(monto), fecha
      }]);

      if (error) throw error;

      setDescripcion('');
      setMonto('');
      setCategoria('Materiales');
      fetchFinanzas();
    } catch (error) {
      alert("Error al registrar gasto: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const eliminarGasto = async (id) => {
    if (window.confirm('¿Seguro que quieres eliminar este gasto?')) {
      await supabase.from('gastos').delete().eq('id', id);
      fetchFinanzas();
    }
  };


  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Control Financiero</h2>
        <p className="text-slate-500 font-medium">Gestiona tus insumos y calcula tu utilidad real</p>
      </div>
      <FiltroPeriodo valor={periodo} onChange={setPeriodo} custom={custom} onCustom={setCustom} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600"><DollarSign size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Ingresos Cobrados</p>
            <p className="text-2xl font-black text-slate-900">${ingresosTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-rose-100 p-4 rounded-2xl text-rose-600"><TrendingDown size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Total Egresos</p>
            <p className="text-2xl font-black text-rose-600">${totalGastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl flex items-center gap-4">
          <div className="bg-white/10 p-4 rounded-2xl text-blue-400"><Wallet size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Utilidad Neta</p>
            <p className={`text-2xl font-black ${utilidadNeta >= 0 ? 'text-white' : 'text-rose-400'}`}>
              ${utilidadNeta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 space-y-4">
          <form onSubmit={agregarGasto} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus size={18} /> Registrar Nuevo Egreso
            </h3>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Descripción</label>
              <div className="relative mt-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text" required placeholder="Ej. Pastilla Eléctrica Dacon..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-100 font-medium text-slate-700"
                />
              </div>
            </div>

            {/* NUEVO CAMPO DE CATEGORÍA */}
            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Categoría</label>
              <div className="relative mt-1">
                <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={categoria} onChange={(e) => setCategoria(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-100 font-medium text-slate-700"
                >
                  <option value="Materiales">Materiales / Refacciones</option>
                  <option value="Combustible">Combustible</option>
                  <option value="Herramientas">Herramientas</option>
                  <option value="Viáticos">Viáticos / Comida</option>
                  <option value="Otros">Otros Servicios</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Monto Total</label>
              <div className="relative mt-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="number" required placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-100 font-bold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase ml-1">Fecha</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)}
                  className="w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none border border-slate-100 font-medium text-slate-700"
                />
              </div>
            </div>

            <button type="submit" disabled={cargando} className="w-full bg-slate-800 text-white p-4 rounded-xl font-bold hover:bg-slate-900 transition flex justify-center items-center gap-2 mt-4">
              <Save size={18} /> {cargando ? 'Guardando...' : 'Guardar Gasto'}
            </button>
          </form>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-6">Historial de Egresos</h3>
            {gastos.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-2xl">No hay gastos registrados aún.</div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {fGastos.map((gasto) => (
                  <div key={gasto.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 text-rose-500"><TrendingDown size={20} /></div>
                      <div>
                        <p className="font-bold text-slate-800">{gasto.descripcion}</p>
                        <p className="text-xs text-slate-400 font-medium">{gasto.categoria} • {gasto.fecha}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-black text-slate-900">${Number(gasto.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      <button onClick={() => eliminarGasto(gasto.id)} className="text-slate-300 hover:text-rose-500 transition p-1"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}