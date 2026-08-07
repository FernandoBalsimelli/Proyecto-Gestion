import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit2, Trash2, FileText, CheckCircle2, Clock, Ban, X } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import FiltroPeriodo from '../components/FiltroPeriodo.jsx';
import { rangoFechas, enRango } from '../utils/fecha.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const txt = (v) => (v ?? '').toString().toLowerCase();

const ESTADOS = {
  pagado:    { label: 'Pagado',    color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 size={13} /> },
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200',       icon: <Clock size={13} /> },
  cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500 border-slate-200',      icon: <Ban size={13} /> },
};

export default function Historial({ session }) {
  const { negocioId, puede } = useNegocio();
  const navigate = useNavigate();

  const [ventas, setVentas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [periodo, setPeriodo] = useState('mes');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });
  const [cargando, setCargando] = useState(true);

  const fetchVentas = async () => {
    if (!negocioId) return;
    setCargando(true);
    const { data, error } = await supabase
      .from('ventas').select('*')
      .eq('negocio_id', negocioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error) setVentas(data || []);
    setCargando(false);
  };

  useEffect(() => { fetchVentas(); }, [negocioId]);

  const eliminarVenta = async (v) => {
    if (!window.confirm(`¿Eliminar la cotización de "${v.cliente || 'Público en General'}"?`)) return;
    const { error } = await supabase.from('ventas').delete().eq('id', v.id);
    if (error) return alert('Error al eliminar: ' + error.message);
    fetchVentas();
  };

  const cambiarEstado = async (v, nuevo) => {
    const { error } = await supabase.from('ventas').update({ estado: nuevo }).eq('id', v.id);
    if (error) return alert('Error: ' + error.message);
    fetchVentas();
  };

  const rango = useMemo(() => rangoFechas(periodo, custom), [periodo, custom]);

  const filtradas = useMemo(() => {
    const q = txt(busqueda);
    return ventas.filter(v => {
      if (periodo !== 'todo' && !enRango(v.fecha, rango)) return false;
      if (filtroEstado !== 'todos' && v.estado !== filtroEstado) return false;
      if (!q) return true;
      return txt(v.cliente).includes(q)
          || txt(v.descripcion).includes(q)
          || txt(v.folio).includes(q);
    });
  }, [ventas, busqueda, filtroEstado, rango, periodo]);

  const totales = useMemo(() => ({
    cobrado:   filtradas.filter(v => v.estado === 'pagado').reduce((a, v) => a + (Number(v.monto) || 0), 0),
    pendiente: filtradas.filter(v => v.estado === 'pendiente').reduce((a, v) => a + (Number(v.monto) || 0), 0),
  }), [filtradas]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">Historial</h2>
        <p className="text-slate-500 font-medium text-sm">
          {filtradas.length} documento(s) · Cobrado {money(totales.cobrado)} · Pendiente {money(totales.pendiente)}
        </p>
      </div>

      <FiltroPeriodo valor={periodo} onChange={setPeriodo} custom={custom} onCustom={setCustom} />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, concepto o folio..."
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 shadow-sm focus:border-primario" />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {['todos', 'pendiente', 'pagado', 'cancelado'].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition ${
                filtroEstado === e ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              {e === 'todos' ? 'Todos' : ESTADOS[e].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {cargando ? (
          [1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-200 rounded-3xl animate-pulse" />)
        ) : filtradas.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <FileText size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="font-bold text-slate-500">No se encontraron documentos.</p>
            <p className="text-slate-400 text-sm mt-1">Prueba con otro periodo o limpia la búsqueda.</p>
          </div>
        ) : filtradas.map(v => {
          const est = ESTADOS[v.estado] || ESTADOS.pendiente;
          return (
            <div key={v.id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-primario transition group">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`p-3 rounded-2xl border shrink-0 ${est.color}`}>
                    <FileText size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {v.folio && <span className="text-[10px] font-black text-slate-300">#{String(v.folio).padStart(4, '0')}</span>}
                      <h4 className="font-black text-slate-800 truncate">{v.cliente || 'Público en General'}</h4>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{v.descripcion || 'Sin descripción'}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-1">{v.fecha} · {v.metodo_pago || 'Sin método'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total</p>
                    <p className="font-black text-lg text-slate-900">{money(v.monto)}</p>
                  </div>

                  <select value={v.estado || 'pendiente'} onChange={(e) => cambiarEstado(v, e.target.value)}
                    className={`text-[10px] font-black uppercase px-2.5 py-2 rounded-xl border outline-none cursor-pointer ${est.color}`}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>

                  <div className="flex gap-1">
                    <button onClick={() => navigate('/presupuestos', { state: { ventaEditar: v } })}
                      className="p-2 text-primario hover:bg-primario-suave rounded-xl transition">
                      <Edit2 size={18} />
                    </button>
                    {puede('eliminar_registros') && (
                      <button onClick={() => eliminarVenta(v)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}