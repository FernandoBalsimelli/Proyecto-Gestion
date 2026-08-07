import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import { hoyLocal, formatoMX, rangoFechas, enRango } from '../utils/fecha.js';
import { exportarCSV } from '../utils/exportar.js';
import FiltroPeriodo from '../components/FiltroPeriodo.jsx';
import {
  DollarSign, TrendingDown, Wallet, Plus, Trash2, Calendar,
  FileText, Tag, Save, LayoutGrid, Download, Receipt,
  PieChart as PieIcon, AlertCircle, ArrowDownUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const num = (v) => Number(v) || 0;
const COLORES = ['#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const CATEGORIAS = ['Materiales', 'Combustible', 'Herramientas', 'Viáticos', 'Nómina', 'Renta', 'Servicios', 'Otros'];

function Tarjeta({ icon, bg, text, label, valor, destacado, negativo, sub }) {
  return (
    <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-4 ${
      destacado ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}>
      <div className={`${bg} ${text} p-4 rounded-2xl shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black tracking-tighter truncate ${
          destacado ? (negativo ? 'text-rose-400' : 'text-white') : 'text-slate-900'}`}>{valor}</p>
        {sub && <p className={`text-[10px] font-bold ${destacado ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}

export default function Finanzas({ session }) {
  const { negocioId, puede } = useNegocio();
  const { toast, confirmar } = useUI();

  const [gastos, setGastos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });

  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Materiales');
  const [proveedor, setProveedor] = useState('');
  const [fecha, setFecha] = useState(hoyLocal());

  const fetch_ = async () => {
    if (!negocioId) return;
    const [g, p, v] = await Promise.all([
      supabase.from('gastos').select('*').eq('negocio_id', negocioId).order('fecha', { ascending: false }),
      supabase.from('pagos').select('*').eq('negocio_id', negocioId).order('fecha', { ascending: false }),
      supabase.from('ventas').select('id, cliente, monto, pagado, fecha, estado').eq('negocio_id', negocioId),
    ]);
    setGastos(g.data || []);
    setPagos(p.data || []);
    setVentas(v.data || []);
  };

  useEffect(() => { fetch_(); /* eslint-disable-next-line */ }, [negocioId]);

  const rango   = useMemo(() => rangoFechas(periodo, custom), [periodo, custom]);
  const fGastos = useMemo(() => periodo === 'todo' ? gastos : gastos.filter(g => enRango(g.fecha, rango)), [gastos, rango, periodo]);
  const fPagos  = useMemo(() => periodo === 'todo' ? pagos  : pagos.filter(p => enRango(p.fecha, rango)),  [pagos, rango, periodo]);

  const ingresos = fPagos.reduce((a, p) => a + num(p.monto), 0);
  const egresos  = fGastos.reduce((a, g) => a + num(g.monto), 0);
  const utilidad = ingresos - egresos;
  const margen   = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

  const porCobrar = useMemo(() =>
    ventas.filter(v => v.estado !== 'cancelado')
          .reduce((a, v) => a + Math.max(0, num(v.monto) - num(v.pagado)), 0),
  [ventas]);

  const porCategoria = useMemo(() => {
    const m = {};
    fGastos.forEach(g => { const k = g.categoria || 'Otros'; m[k] = (m[k] || 0) + num(g.monto); });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fGastos]);

  const movimientos = useMemo(() => ([
    ...fPagos.map(p => ({ ...p, _tipo: 'ingreso', _label: `Abono — ${ventas.find(v => v.id === p.venta_id)?.cliente || 'Cliente'}`, _sub: `${p.metodo}${p.nota ? ` · ${p.nota}` : ''}` })),
    ...fGastos.map(g => ({ ...g, _tipo: 'egreso', _label: g.descripcion, _sub: `${g.categoria}${g.proveedor ? ` · ${g.proveedor}` : ''}` })),
  ]).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
  [fPagos, fGastos, ventas]);

  const agregarGasto = async (e) => {
    e.preventDefault();
    if (!descripcion.trim()) return toast.error('Escribe una descripción.');
    if (!(num(monto) > 0))   return toast.error('El monto debe ser mayor a cero.');

    setCargando(true);
    const { error } = await supabase.from('gastos').insert([{
      negocio_id: negocioId, user_id: session.user.id,
      descripcion: descripcion.trim(), categoria,
      proveedor: proveedor.trim() || null,
      monto: num(monto), fecha,
    }]);
    setCargando(false);
    if (error) return toast.error('Error al registrar: ' + error.message);
    setDescripcion(''); setMonto(''); setProveedor(''); setCategoria('Materiales');
    toast.ok('Egreso registrado.');
    fetch_();
  };

  const eliminarGasto = async (g) => {
    const ok = await confirmar({
      titulo: 'Eliminar egreso', mensaje: `"${g.descripcion}" por ${money(g.monto)}`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('gastos').delete().eq('id', g.id);
    if (error) return toast.error('Error: ' + error.message);
    toast.ok('Egreso eliminado.');
    fetch_();
  };

  const exportar = () => {
    if (!movimientos.length) return toast.warn('No hay movimientos en este periodo.');
    exportarCSV('flujo_de_caja', [
      { label: 'Fecha',     valor: m => m.fecha },
      { label: 'Tipo',      valor: m => m._tipo === 'ingreso' ? 'Ingreso' : 'Egreso' },
      { label: 'Concepto',  valor: m => m._label },
      { label: 'Detalle',   valor: m => m._sub },
      { label: 'Monto',     valor: m => (m._tipo === 'ingreso' ? '' : '-') + num(m.monto).toFixed(2) },
    ], movimientos);
    toast.ok('Archivo descargado.');
  };

  const input = 'w-full p-3 pl-9 bg-slate-50 rounded-xl outline-none border border-slate-100 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">Control Financiero</h2>
          <p className="text-slate-500 font-medium text-sm">
            Flujo de caja real · {fPagos.length} ingreso(s) · {fGastos.length} egreso(s) · Margen {margen.toFixed(0)}%
          </p>
        </div>
        <button onClick={exportar}
          className="bg-white border border-slate-200 hover:border-primario text-slate-600 hover:text-primario px-4 py-2.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-2 transition w-fit">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      <FiltroPeriodo valor={periodo} onChange={setPeriodo} custom={custom} onCustom={setCustom} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Tarjeta icon={<DollarSign size={24} />} bg="bg-emerald-100" text="text-emerald-600"
          label="Dinero recibido" valor={money(ingresos)} sub="Abonos del periodo" />
        <Tarjeta icon={<TrendingDown size={24} />} bg="bg-rose-100" text="text-rose-600"
          label="Total egresos" valor={money(egresos)} />
        <Tarjeta icon={<AlertCircle size={24} />} bg="bg-amber-100" text="text-amber-600"
          label="Por cobrar" valor={money(porCobrar)} sub="Saldo de toda la cartera" />
        <Tarjeta icon={<Wallet size={24} />} bg="bg-white/10" text="text-blue-400"
          label="Utilidad neta" valor={money(utilidad)} destacado negativo={utilidad < 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Formulario + gráfica */}
        <div className="xl:col-span-1 space-y-6">
          <form onSubmit={agregarGasto}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus size={18} /> Registrar egreso
            </h3>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descripción</label>
              <div className="relative mt-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Cable THW cal. 12" className={input} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoría</label>
              <div className="relative mt-1">
                <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={input}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                Proveedor <span className="text-slate-300">(opcional)</span>
              </label>
              <div className="relative mt-1">
                <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={proveedor} onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Ej. Home Depot" className={input} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Monto</label>
                <div className="relative mt-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="number" inputMode="decimal" min="0" step="any" value={monto}
                    onChange={(e) => setMonto(e.target.value)} onFocus={(e) => e.target.select()}
                    placeholder="0.00" className={`${input} font-black text-right`} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={cargando}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 transition flex justify-center items-center gap-2 disabled:opacity-50">
              <Save size={18} /> {cargando ? 'Guardando...' : 'Guardar egreso'}
            </button>
          </form>

          {porCategoria.length > 0 && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4 text-sm">
                <PieIcon size={16} /> Egresos por categoría
              </h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={3}>
                      {porCategoria.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => money(v)}
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 12 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Flujo de caja */}
        <div className="xl:col-span-2">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-5 flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2"><ArrowDownUp size={17} /> Flujo de caja</span>
              <span className="text-[10px] font-black text-slate-400 uppercase">{movimientos.length} movimiento(s)</span>
            </h3>

            {movimientos.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <Receipt size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="font-bold text-slate-500">Sin movimientos en este periodo</p>
                <p className="text-slate-400 text-sm mt-1">Prueba con otro rango de fechas.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {movimientos.map(m => {
                  const ing = m._tipo === 'ingreso';
                  return (
                    <div key={`${m._tipo}-${m.id}`}
                      className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition group gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl shadow-sm border border-slate-100 shrink-0 bg-white ${
                          ing ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {ing ? <DollarSign size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{m._label}</p>
                          <p className="text-[11px] text-slate-400 font-bold truncate">
                            {formatoMX(m.fecha)} · {m._sub}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className={`font-black tabular-nums ${ing ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {ing ? '+' : '−'}{money(m.monto)}
                        </p>
                        {!ing && puede('eliminar_registros') && (
                          <button onClick={() => eliminarGasto(m)}
                            className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition
                                       opacity-100 md:opacity-0 md:group-hover:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}