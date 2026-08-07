import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Edit2, Trash2, FileText, X, Download, Copy,
  MessageCircle, Plus, Wallet, AlertTriangle, CalendarClock
} from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import FiltroPeriodo from '../components/FiltroPeriodo.jsx';
import ModalPagos from '../components/ModalPagos.jsx';
import { rangoFechas, enRango, hoyLocal, formatoMX } from '../utils/fecha.js';
import { exportarCSV, abrirWhatsApp } from '../utils/exportar.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const diasVencido = (v) => {
  if (!v.fecha_compromiso || v.estado === 'cancelado') return null;
  if (num(v.pagado) >= num(v.monto) - 0.01) return null;
  const hoy = hoyLocal();
  if (v.fecha_compromiso >= hoy) return null;
  return Math.floor((new Date(hoy) - new Date(v.fecha_compromiso)) / 86400000);
};
const txt = (v) => (v ?? '').toString().toLowerCase();
const num = (v) => Number(v) || 0;

const ESTADOS = {
  pagado: { label: 'Pagado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export default function Historial({ session }) {
  const ponerCompromiso = async (v) => {
    const f = window.prompt('Fecha compromiso de pago (AAAA-MM-DD):', v.fecha_compromiso || hoyLocal());
    if (f === null) return;
    const valor = f.trim() || null;
    if (valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return toast.error('Formato inválido. Usa AAAA-MM-DD.');
    const { error } = await supabase.from('ventas').update({ fecha_compromiso: valor }).eq('id', v.id);
    if (error) return toast.error(error.message);
    toast.ok(valor ? 'Fecha registrada.' : 'Fecha eliminada.');
    fetchVentas();
  };
  const { negocioId, puede } = useNegocio();
  const { toast, confirmar } = useUI();
  const navigate = useNavigate();

  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [periodo, setPeriodo] = useState('mes');
  const [custom, setCustom] = useState({ desde: '', hasta: '' });
  const [cargando, setCargando] = useState(true);
  const [ventaPagos, setVentaPagos] = useState(null);

  const fetchVentas = async () => {
    if (!negocioId) return;
    const [v, c] = await Promise.all([
      supabase.from('ventas').select('*').eq('negocio_id', negocioId)
        .order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, telefono').eq('negocio_id', negocioId),
    ]);
    setVentas(v.data || []);
    setClientes(c.data || []);
    setCargando(false);
  };

  useEffect(() => {
    if (!negocioId) return;
    setCargando(true);
    fetchVentas();
    const canal = supabase.channel(`hist-${negocioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas', filter: `negocio_id=eq.${negocioId}` }, fetchVentas)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  const telDe = (v) => clientes.find(c => c.id === v.cliente_id)?.telefono;

  /* ── Acciones ── */
  const eliminar = async (v) => {
    const ok = await confirmar({
      titulo: 'Eliminar cotización',
      mensaje: `${v.cliente || 'Público en General'} · ${money(v.monto)}\n\nTambién se borrarán sus abonos. Esta acción no se puede deshacer.`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('ventas').delete().eq('id', v.id);
    if (error) return toast.error('Error al eliminar: ' + error.message);
    toast.ok('Cotización eliminada.');
    fetchVentas();
  };

  const cambiarEstado = async (v, nuevo) => {
    const saldo = num(v.monto) - num(v.pagado);

    if (nuevo === 'pagado' && saldo > 0.01) {
      const ok = await confirmar({
        titulo: 'Liquidar cotización',
        mensaje: `Se registrará un abono de ${money(saldo)} con fecha de hoy para cubrir el saldo.`,
        okTexto: 'Registrar y liquidar',
      });
      if (!ok) return;
      const { error } = await supabase.from('pagos').insert([{
        negocio_id: negocioId, venta_id: v.id, user_id: session.user.id,
        monto: saldo, fecha: hoyLocal(),
        metodo: v.metodo_pago || 'Efectivo', nota: 'Liquidación',
      }]);
      if (error) return toast.error('Error: ' + error.message);
      toast.ok('Cotización liquidada.');
      return fetchVentas();
    }

    if (nuevo === 'pendiente' && num(v.pagado) >= num(v.monto) - 0.01 && num(v.pagado) > 0) {
      return toast.warn('Esta cotización está liquidada. Elimina abonos desde el botón de pagos.');
    }

    const { error } = await supabase.from('ventas').update({ estado: nuevo }).eq('id', v.id);
    if (error) return toast.error('Error: ' + error.message);
    setVentas(prev => prev.map(x => x.id === v.id ? { ...x, estado: nuevo } : x));
    toast.ok(`Marcado como ${ESTADOS[nuevo].label.toLowerCase()}.`);
  };

  const duplicar = async (v) => {
    const ok = await confirmar({
      titulo: 'Duplicar cotización',
      mensaje: `Se creará una copia de "${v.cliente || 'Público en General'}" con la fecha de hoy, sin abonos.`,
      okTexto: 'Duplicar',
    });
    if (!ok) return;
    const { id, folio, created_at, pagado, ...resto } = v;
    const { error } = await supabase.from('ventas').insert([{
      ...resto, negocio_id: negocioId, user_id: session.user.id,
      fecha: hoyLocal(), estado: 'pendiente', pagado: 0,
    }]);
    if (error) return toast.error('Error al duplicar: ' + error.message);
    toast.ok('Copia creada correctamente.');
    fetchVentas();
  };

  const enviarWhatsApp = (v) => {
    const saldo = num(v.monto) - num(v.pagado);
    const msg =
      `Hola ${v.cliente || ''} 👋\n\n` +
      `Le comparto el detalle de su cotización${v.folio ? ` #${String(v.folio).padStart(4, '0')}` : ''}:\n\n` +
      (Array.isArray(v.conceptos) && v.conceptos.length
        ? v.conceptos.map(c => `• ${c.cantidad}x ${c.descripcion} — ${money(c.cantidad * c.precio)}`).join('\n')
        : (v.descripcion || '')) +
      `\n\n*Total: ${money(v.monto)}*` +
      (num(v.pagado) > 0 ? `\nAbonado: ${money(v.pagado)}\n*Saldo: ${money(saldo)}*` : '') +
      `\nFecha: ${formatoMX(v.fecha)}\n\nQuedo atento a cualquier duda.`;
    abrirWhatsApp(telDe(v), msg);
  };

  /* ── Filtros ── */
  const rango = useMemo(() => rangoFechas(periodo, custom), [periodo, custom]);

  const filtradas = useMemo(() => {
    const q = txt(busqueda);
    return ventas.filter(v => {
      if (periodo !== 'todo' && !enRango(v.fecha, rango)) return false;
      if (filtroEstado === 'vencidas') {
        if (diasVencido(v) === null) return false;
      }
      if (filtroEstado === 'abonadas') {
        if (!(num(v.pagado) > 0 && num(v.pagado) < num(v.monto) - 0.01)) return false;

      }

      else if (filtroEstado !== 'todos' && v.estado !== filtroEstado) return false;
      if (!q) return true;
      return txt(v.cliente).includes(q) || txt(v.descripcion).includes(q) || txt(v.folio).includes(q);
    });
  }, [ventas, busqueda, filtroEstado, rango, periodo]);

  const totales = useMemo(() => ({
    total: filtradas.reduce((a, v) => a + num(v.monto), 0),
    cobrado: filtradas.reduce((a, v) => a + num(v.pagado), 0),
    saldo: filtradas.filter(v => v.estado !== 'cancelado')
      .reduce((a, v) => a + Math.max(0, num(v.monto) - num(v.pagado)), 0),
  }), [filtradas]);

  const exportar = () => {
    if (!filtradas.length) return toast.warn('No hay documentos que exportar.');
    exportarCSV('cotizaciones', [
      { label: 'Folio', valor: v => v.folio ?? '' },
      { label: 'Fecha', valor: v => v.fecha },
      { label: 'Cliente', valor: v => v.cliente || 'Público en General' },
      { label: 'Concepto', valor: v => v.descripcion || '' },
      { label: 'Estado', valor: v => v.estado },
      { label: 'Total', valor: v => num(v.monto).toFixed(2) },
      { label: 'Abonado', valor: v => num(v.pagado).toFixed(2) },
      { label: 'Saldo', valor: v => Math.max(0, num(v.monto) - num(v.pagado)).toFixed(2) },
    ], filtradas);
    toast.ok('Archivo descargado.');
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter">Historial</h2>
          <p className="text-slate-500 font-medium text-sm">
            {filtradas.length} doc. · Total {money(totales.total)} · Cobrado{' '}
            <b className="text-emerald-600">{money(totales.cobrado)}</b> · Saldo{' '}
            <b className="text-amber-600">{money(totales.saldo)}</b>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar}
            className="bg-white border border-slate-200 hover:border-primario text-slate-600 hover:text-primario px-4 py-2.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-2 transition">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => navigate('/presupuestos')}
            className="bg-primario text-white px-4 py-2.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-2 hover:bg-primario-dark transition shadow-lg">
            <Plus size={14} /> Nueva
          </button>
        </div>
      </div>

      <FiltroPeriodo valor={periodo} onChange={setPeriodo} custom={custom} onCustom={setCustom} />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, concepto o folio..."
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 shadow-sm focus:border-primario transition" />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[['todos', 'Todos'], ['pendiente', 'Pendiente'], ['abonadas', 'Con abono'], ['vencidas', 'Vencidas'], ['pagado', 'Pagado'], ['cancelado', 'Cancelado']].map(([id, lbl]) => (
            <button key={id} onClick={() => setFiltroEstado(id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase transition ${filtroEstado === id ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {cargando ? (
          [1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-3xl animate-pulse" />)
        ) : filtradas.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-14 text-center">
            <FileText size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="font-bold text-slate-500">No se encontraron documentos</p>
            <p className="text-slate-400 text-sm mt-1">Prueba con otro periodo o limpia la búsqueda.</p>
          </div>
        ) : filtradas.map(v => {
          const est = ESTADOS[v.estado] || ESTADOS.pendiente;
          const total = num(v.monto), cobrado = num(v.pagado);
          const saldo = Math.max(0, total - cobrado);
          const parcial = cobrado > 0 && saldo > 0.01 && v.estado !== 'cancelado';
          const pct = total > 0 ? Math.min(100, (cobrado / total) * 100) : 0;

          return (
            <div key={v.id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-primario hover:shadow-md transition group">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`p-3 rounded-2xl border shrink-0 ${est.color}`}><FileText size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {diasVencido(v) !== null && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-1">
                          <CalendarClock size={10} /> Vencido {diasVencido(v)}d
                        </span>
                      )}
                      {v.folio && <span className="text-[10px] font-black text-slate-300 tracking-widest">#{String(v.folio).padStart(4, '0')}</span>}
                      <h4 className="font-black text-slate-800 truncate">{v.cliente || 'Público en General'}</h4>
                      {parcial && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-primario-suave text-primario-dark">
                          Abonado {pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{v.descripcion || 'Sin descripción'}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-1">
                      {formatoMX(v.fecha)} · {v.metodo_pago || 'Sin método'}
                    </p>

                    {parcial && (
                      <div className="mt-2.5 max-w-xs">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primario rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                          Abonado {money(cobrado)} · Saldo <span className="text-amber-600">{money(saldo)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 border-t lg:border-t-0 border-slate-100 pt-3 lg:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">
                      {parcial ? 'Saldo' : 'Total'}
                    </p>
                    <p className={`font-black text-lg tabular-nums ${parcial ? 'text-amber-600' : 'text-slate-900'}`}>
                      {money(parcial ? saldo : total)}
                    </p>
                  </div>

                  <select value={v.estado || 'pendiente'} onChange={(e) => cambiarEstado(v, e.target.value)}
                    className={`text-[10px] font-black uppercase px-2.5 py-2 rounded-xl border outline-none cursor-pointer ${est.color}`}>
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>

                  <div className="flex gap-0.5">
                    <button onClick={() => setVentaPagos(v)} title="Abonos y pagos"
                      className={`p-2 rounded-xl transition ${parcial
                        ? 'text-primario bg-primario-suave'
                        : 'text-slate-300 hover:text-primario hover:bg-primario-suave'}`}>
                      <Wallet size={17} />
                    </button>
                    <button onClick={() => enviarWhatsApp(v)} title="Enviar por WhatsApp"
                      className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition">
                      <MessageCircle size={17} />
                    </button>
                                        <button onClick={() => ponerCompromiso(v)} title="Fecha compromiso de pago"
                      className={`p-2 rounded-xl transition ${v.fecha_compromiso
                        ? 'text-amber-600 bg-amber-50' : 'text-slate-300 hover:text-amber-600 hover:bg-amber-50'}`}>
                      <CalendarClock size={17} />
                    </button>
                    <button onClick={() => duplicar(v)} title="Duplicar"
                      className="p-2 text-slate-300 hover:text-primario hover:bg-primario-suave rounded-xl transition">
                      <Copy size={17} />
                    </button>
                    <button onClick={() => navigate('/presupuestos', { state: { ventaEditar: v } })} title="Editar"
                      className="p-2 text-primario hover:bg-primario-suave rounded-xl transition">
                      <Edit2 size={17} />
                    </button>
                    {puede('eliminar_registros') && (
                      <button onClick={() => eliminar(v)} title="Eliminar"
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {ventaPagos && (
        <ModalPagos
          venta={ventaPagos}
          telefonoCliente={telDe(ventaPagos)}
          onCerrar={() => setVentaPagos(null)}
          onActualizado={async () => {
            await fetchVentas();
            setVentaPagos(prev => {
              const act = ventas.find(x => x.id === prev?.id);
              return act ? { ...prev, ...act } : prev;
            });
          }}
        />
      )}
    </div>
  );
}