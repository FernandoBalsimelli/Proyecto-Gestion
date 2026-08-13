import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Edit2, Trash2, FileText, X, Download, Copy,
  MessageCircle, Plus, Wallet, CalendarClock, Check,
} from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import FiltroPeriodo from '../components/FiltroPeriodo.jsx';
import ModalPagos from '../components/ModalPagos.jsx';
import { rangoFechas, enRango } from '../utils/fecha.js';
import { exportarCSV, abrirWhatsApp } from '../utils/exportar.js';
import {
  LIMITES, limpiarTexto, normalizar, fechaLocalISO,
  esFechaValida, verificarPolitica,
} from '../utils/seguridad.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const formatoMX = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const MAX_DOCUMENTOS = 1000;

const ESTADOS = {
  pagado:    { label: 'Pagado',    color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  pendiente: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  cancelado: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const diasVencido = (v) => {
  if (!v.fecha_compromiso || v.estado === 'cancelado') return null;
  if (num(v.pagado) >= num(v.monto) - 0.01) return null;
  const hoy = fechaLocalISO();
  if (v.fecha_compromiso >= hoy) return null;
  return Math.floor(
    (new Date(`${hoy}T12:00:00`) - new Date(`${v.fecha_compromiso}T12:00:00`)) / 86400000
  );
};

/**
 * Botón de acción.
 *
 * En móvil: icono + etiqueta, dentro de una celda de rejilla. Al vivir en
 * una celda con ancho asignado, es imposible que se desborde del contenedor
 * y quede recortado por el `overflow-x-hidden` del layout — que era
 * exactamente el problema anterior.
 * En escritorio (sm+): solo el icono, en una fila alineada a la derecha.
 */
function Accion({ icon, label, onClick, tono = 'neutro', activo = false }) {
  const tonos = {
    neutro:   'text-slate-500 hover:text-primario hover:bg-primario-suave',
    primario: 'text-primario hover:bg-primario-suave',
    verde:    'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50',
    ambar:    'text-slate-500 hover:text-amber-600 hover:bg-amber-50',
    rojo:     'text-slate-500 hover:text-rose-500 hover:bg-rose-50',
  };
  const activos = {
    primario: 'text-primario bg-primario-suave',
    verde:    'text-emerald-600 bg-emerald-50',
    ambar:    'text-amber-600 bg-amber-50',
    rojo:     'text-rose-500 bg-rose-50',
    neutro:   'text-primario bg-primario-suave',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`min-h-[52px] sm:min-h-[44px] w-full sm:w-auto sm:min-w-[44px] px-2
                  flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-0
                  rounded-xl border border-slate-100 sm:border-transparent
                  bg-slate-50 sm:bg-transparent transition
                  ${activo ? activos[tono] : tonos[tono]}`}
    >
      {icon}
      <span className="sm:hidden text-[9px] font-black uppercase leading-none tracking-tight">
        {label}
      </span>
    </button>
  );
}

export default function Historial({ session }) {
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
  const [errorCarga, setErrorCarga] = useState(null);
  const [ventaPagos, setVentaPagos] = useState(null);
  const [editandoFecha, setEditandoFecha] = useState(null);

  /* ─────────── Datos ─────────── */
  const fetchVentas = useCallback(async () => {
    if (!negocioId) return [];
    const [v, c] = await Promise.all([
      supabase.from('ventas').select('*')
        .eq('negocio_id', negocioId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(MAX_DOCUMENTOS),
      supabase.from('clientes').select('id, telefono')
        .eq('negocio_id', negocioId).limit(2000),
    ]);

    if (v.error) {
      setErrorCarga(v.error.message);
      setCargando(false);
      return [];
    }
    setErrorCarga(null);
    setVentas(v.data || []);
    setClientes(c.data || []);
    setCargando(false);
    return v.data || [];
  }, [negocioId]);

  useEffect(() => {
    if (!negocioId) { setCargando(false); return; }
    setCargando(true);
    fetchVentas();

    let t;
    const recargar = () => { clearTimeout(t); t = setTimeout(fetchVentas, 400); };
    const canal = supabase.channel(`hist-${negocioId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ventas', filter: `negocio_id=eq.${negocioId}` },
        recargar)
      .subscribe();

    return () => { clearTimeout(t); supabase.removeChannel(canal); };
  }, [negocioId, fetchVentas]);

  const telDe = (v) => clientes.find(c => String(c.id) === String(v.cliente_id))?.telefono;

  /* ─────────── Acciones ─────────── */
  const eliminar = async (v) => {
    const ok = await confirmar({
      titulo: 'Eliminar cotización',
      mensaje: `${v.cliente || 'Público en General'} · ${money(v.monto)}\n\nTambién se borrarán sus abonos. Esta acción no se puede deshacer.`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('ventas').delete().eq('id', v.id);
    if (error) return toast.error('No se pudo eliminar: ' + error.message);
    toast.ok('Cotización eliminada.');
    fetchVentas();
  };

  const cambiarEstado = async (v, nuevo) => {
    if (!ESTADOS[nuevo]) return;
    const saldo = num(v.monto) - num(v.pagado);

    if (nuevo === 'pagado' && saldo > 0.01) {
      if (!puede('registrar_pagos')) return toast.warn('No tienes permiso para registrar pagos.');
      const ok = await confirmar({
        titulo: 'Liquidar cotización',
        mensaje: `Se registrará un abono de ${money(saldo)} con fecha de hoy para cubrir el saldo.`,
        okTexto: 'Registrar y liquidar',
      });
      if (!ok) return;
      const { error } = await supabase.from('pagos').insert([{
        negocio_id: negocioId, venta_id: v.id, user_id: session.user.id,
        monto: saldo, fecha: fechaLocalISO(),
        metodo: v.metodo_pago || 'Efectivo', nota: 'Liquidación',
      }]);
      if (error) return toast.error('No se pudo liquidar: ' + error.message);
      toast.ok('Cotización liquidada.');
      return fetchVentas();
    }

    if (nuevo === 'pendiente' && num(v.pagado) >= num(v.monto) - 0.01 && num(v.pagado) > 0) {
      return toast.warn('Esta cotización está liquidada. Elimina los abonos desde el botón de pagos.');
    }

    const { error } = await supabase.from('ventas').update({ estado: nuevo }).eq('id', v.id);
    if (error) return toast.error('No se pudo cambiar el estado: ' + error.message);
    setVentas(prev => prev.map(x => (x.id === v.id ? { ...x, estado: nuevo } : x)));
    toast.ok(`Marcado como ${ESTADOS[nuevo].label.toLowerCase()}.`);
  };

  const duplicar = async (v) => {
    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    const ok = await confirmar({
      titulo: 'Duplicar cotización',
      mensaje: `Se creará una copia de "${v.cliente || 'Público en General'}" con la fecha de hoy, sin abonos.`,
      okTexto: 'Duplicar',
    });
    if (!ok) return;

    const { id, folio, created_at, pagado, fecha_compromiso, ...resto } = v;
    const { error } = await supabase.from('ventas').insert([{
      ...resto, negocio_id: negocioId, user_id: session.user.id,
      fecha: fechaLocalISO(), estado: 'pendiente', pagado: 0, fecha_compromiso: null,
    }]);
    if (error) return toast.error('No se pudo duplicar: ' + error.message);
    toast.ok('Copia creada correctamente.');
    fetchVentas();
  };

  const guardarCompromiso = async () => {
    const { id, valor } = editandoFecha;
    if (valor && !esFechaValida(valor)) return toast.error('Fecha no válida.');
    const { error } = await supabase.from('ventas')
      .update({ fecha_compromiso: valor || null }).eq('id', id);
    if (error) return toast.error('No se pudo guardar: ' + error.message);
    toast.ok(valor ? 'Fecha compromiso registrada.' : 'Fecha compromiso eliminada.');
    setEditandoFecha(null);
    fetchVentas();
  };

  const enviarWhatsApp = (v) => {
    const saldo = num(v.monto) - num(v.pagado);
    const lineas = Array.isArray(v.conceptos) && v.conceptos.length
      ? v.conceptos.slice(0, 25)
          .map(c => `• ${c.cantidad}x ${String(c.descripcion).slice(0, 80)} — ${money(c.cantidad * c.precio)}`)
          .join('\n')
      : String(v.descripcion || '').slice(0, 800);

    const msg =
      `Hola ${v.cliente || ''} 👋\n\n` +
      `Le comparto el detalle de su cotización${v.folio ? ` #${String(v.folio).padStart(4, '0')}` : ''}:\n\n` +
      lineas +
      `\n\n*Total: ${money(v.monto)}*` +
      (num(v.pagado) > 0 ? `\nAbonado: ${money(v.pagado)}\n*Saldo: ${money(saldo)}*` : '') +
      `\nFecha: ${formatoMX(v.fecha)}\n\nQuedo atento a cualquier duda.`;
    abrirWhatsApp(telDe(v), msg);
  };

  /* ─────────── Filtros ─────────── */
  const rango = useMemo(() => rangoFechas(periodo, custom), [periodo, custom]);

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    return ventas.filter(v => {
      if (periodo !== 'todo' && !enRango(v.fecha, rango)) return false;

      if (filtroEstado === 'vencidas') {
        if (diasVencido(v) === null) return false;
      } else if (filtroEstado === 'abonadas') {
        if (!(num(v.pagado) > 0 && num(v.pagado) < num(v.monto) - 0.01)) return false;
      } else if (filtroEstado !== 'todos' && v.estado !== filtroEstado) {
        return false;
      }

      if (!q) return true;
      return normalizar(v.cliente).includes(q)
        || normalizar(v.descripcion).includes(q)
        || String(v.folio ?? '').includes(q);
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
      { label: 'Folio',    valor: v => v.folio ?? '' },
      { label: 'Fecha',    valor: v => v.fecha },
      { label: 'Cliente',  valor: v => v.cliente || 'Público en General' },
      { label: 'Concepto', valor: v => String(v.descripcion || '').slice(0, LIMITES.descripcion) },
      { label: 'Estado',   valor: v => v.estado },
      { label: 'Total',    valor: v => num(v.monto).toFixed(2) },
      { label: 'Abonado',  valor: v => num(v.pagado).toFixed(2) },
      { label: 'Saldo',    valor: v => Math.max(0, num(v.monto) - num(v.pagado)).toFixed(2) },
    ], filtradas);
    toast.ok('Archivo descargado.');
  };

  /* ─────────── Render ─────────── */

  // Sin negocio resuelto, mostramos el motivo en vez de una lista vacía
  // que parece "se borró todo".
  if (!negocioId && !cargando) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 text-center max-w-lg mx-auto">
          <h3 className="font-black text-amber-800 uppercase">No se pudo cargar tu negocio</h3>
          <p className="text-amber-700 text-sm font-medium mt-2">
            Tus datos siguen ahí; lo que falla es resolver a qué negocio perteneces.
            Cierra sesión y vuelve a entrar. Si continúa, revisa las políticas RLS de
            la tabla <b>miembros</b> con el script <b>06_reparar_acceso.sql</b>.
          </p>
        </div>
      </div>
    );
  }

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

      {errorCarga && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold p-4 rounded-2xl">
          No se pudieron cargar los documentos: {errorCarga}
        </div>
      )}

      <FiltroPeriodo valor={periodo} onChange={setPeriodo} custom={custom} onCustom={setCustom} />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={busqueda} maxLength={LIMITES.busqueda}
            onChange={(e) => setBusqueda(limpiarTexto(e.target.value, LIMITES.busqueda))}
            placeholder="Buscar por cliente, concepto o folio..."
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 shadow-sm focus:border-primario transition" />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[['todos','Todos'],['pendiente','Pendiente'],['abonadas','Con abono'],['vencidas','Vencidas'],['pagado','Pagado'],['cancelado','Cancelado']]
            .map(([id, lbl]) => (
            <button key={id} onClick={() => setFiltroEstado(id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase transition ${
                filtroEstado === id
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {cargando ? (
          [1, 2, 3].map(i => <div key={i} className="h-52 bg-slate-200 rounded-3xl animate-pulse" />)
        ) : filtradas.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-14 text-center">
            <FileText size={44} className="mx-auto text-slate-200 mb-3" />
            <p className="font-bold text-slate-500">No se encontraron documentos</p>
            <p className="text-slate-400 text-sm mt-1">
              {ventas.length === 0
                ? 'Aún no hay cotizaciones registradas en este negocio.'
                : 'Prueba con otro periodo o limpia la búsqueda.'}
            </p>
          </div>
        ) : filtradas.map(v => {
          const est = ESTADOS[v.estado] || ESTADOS.pendiente;
          const total = num(v.monto), cobrado = num(v.pagado);
          const saldo = Math.max(0, total - cobrado);
          const parcial = cobrado > 0 && saldo > 0.01 && v.estado !== 'cancelado';
          const pct = total > 0 ? Math.min(100, (cobrado / total) * 100) : 0;
          const vencido = diasVencido(v);
          const editando = editandoFecha?.id === v.id;

          return (
            <div key={v.id}
              className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-primario hover:shadow-md transition">

              {/* ── Encabezado del documento ── */}
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div className={`p-3 rounded-2xl border shrink-0 ${est.color}`}><FileText size={22} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {vencido !== null && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-1">
                        <CalendarClock size={10} /> Vencido {vencido}d
                      </span>
                    )}
                    {v.folio && (
                      <span className="text-[10px] font-black text-slate-300 tracking-widest">
                        #{String(v.folio).padStart(4, '0')}
                      </span>
                    )}
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
                    {v.fecha_compromiso ? ` · compromiso ${formatoMX(v.fecha_compromiso)}` : ''}
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

              {/* ── Editor de fecha compromiso ── */}
              {editando && (
                <div className="mt-3 flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                  <span className="text-[10px] font-black text-amber-700 uppercase w-full sm:w-auto">
                    Compromiso de pago
                  </span>
                  <input type="date" value={editandoFecha.valor}
                    onChange={(e) => setEditandoFecha({ ...editandoFecha, valor: e.target.value })}
                    className="p-2 bg-white border border-amber-200 rounded-xl font-bold text-sm outline-none flex-1 min-w-[140px]" />
                  <button onClick={guardarCompromiso}
                    className="px-3 py-2 bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase flex items-center gap-1">
                    <Check size={13} /> Guardar
                  </button>
                  <button onClick={() => setEditandoFecha({ ...editandoFecha, valor: '' })}
                    className="px-3 py-2 bg-white text-amber-700 border border-amber-200 rounded-xl text-[11px] font-black uppercase">
                    Quitar
                  </button>
                  <button onClick={() => setEditandoFecha(null)}
                    className="px-3 py-2 text-slate-500 text-[11px] font-black uppercase">
                    Cancelar
                  </button>
                </div>
              )}

              {/* ── Importe y estado ── */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                <div className="mr-auto">
                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none">
                    {parcial ? 'Saldo' : 'Total'}
                  </p>
                  <p className={`font-black text-lg tabular-nums ${parcial ? 'text-amber-600' : 'text-slate-900'}`}>
                    {money(parcial ? saldo : total)}
                  </p>
                </div>

                <select value={v.estado || 'pendiente'} onChange={(e) => cambiarEstado(v, e.target.value)}
                  aria-label="Estado del documento"
                  className={`text-[10px] font-black uppercase px-2.5 min-h-[44px] rounded-xl border outline-none cursor-pointer ${est.color}`}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {/* ── Acciones: rejilla en móvil, fila en escritorio ── */}
              <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:justify-end sm:gap-1">
                <Accion icon={<Wallet size={18} />} label="Abonos" tono="primario" activo={parcial}
                  onClick={() => setVentaPagos(v)} />
                <Accion icon={<MessageCircle size={18} />} label="WhatsApp" tono="verde"
                  onClick={() => enviarWhatsApp(v)} />
                <Accion icon={<CalendarClock size={18} />} label="Compromiso" tono="ambar"
                  activo={!!v.fecha_compromiso}
                  onClick={() => setEditandoFecha({ id: v.id, valor: v.fecha_compromiso || fechaLocalISO() })} />
                <Accion icon={<Copy size={18} />} label="Duplicar"
                  onClick={() => duplicar(v)} />
                <Accion icon={<Edit2 size={18} />} label="Editar" tono="primario"
                  onClick={() => navigate('/presupuestos', { state: { ventaEditar: v } })} />
                {puede('eliminar_registros') && (
                  <Accion icon={<Trash2 size={18} />} label="Eliminar" tono="rojo"
                    onClick={() => eliminar(v)} />
                )}
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
            const frescas = await fetchVentas();
            const act = (frescas || []).find(x => x.id === ventaPagos.id);
            if (act) setVentaPagos(act);
          }}
        />
      )}
    </div>
  );
}