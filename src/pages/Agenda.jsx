import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import {
  CalendarDays, Plus, Save, Trash2, Pencil, Clock, MapPin, User,
  CheckCircle2, PlayCircle, AlertTriangle, X, Search, ChevronRight,
  FileText, Bell,
} from 'lucide-react';
import {
  LIMITES, limpiarTexto, textoParaGuardar, normalizar,
  fechaLocalISO, sumarDiasLocal, esFechaValida, verificarPolitica,
} from '../utils/seguridad.js';

/* ══════════════ Constantes ══════════════ */

export const ESTADOS_AGENDA = {
  pendiente:  { label: 'Pendiente',  color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Clock },
  en_proceso: { label: 'En proceso', color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: PlayCircle },
  completado: { label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelado:  { label: 'Cancelado',  color: 'bg-slate-100 text-slate-500 border-slate-200',      icon: X },
};

export const PRIORIDADES = {
  alta:   { label: 'Alta',   color: 'bg-rose-100 text-rose-700',   barra: 'bg-rose-500' },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-600', barra: 'bg-slate-300' },
  baja:   { label: 'Baja',   color: 'bg-slate-50 text-slate-400',  barra: 'bg-slate-200' },
};

const VACIO = {
  titulo: '', descripcion: '', direccion: '',
  fecha: fechaLocalISO(), hora: '', duracion_min: 60,
  estado: 'pendiente', prioridad: 'normal', cliente_id: '', venta_id: '', recordatorio_fecha: '',
};

const MAX_TRABAJOS = 500;

const formatoMX = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const formatoDiaLargo = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

const etiquetaDia = (iso) => {
  const hoy = fechaLocalISO();
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDiasLocal(hoy, 1)) return 'Mañana';
  if (iso === sumarDiasLocal(hoy, -1)) return 'Ayer';
  return formatoDiaLargo(iso);
};

const estaVencido = (t) =>
  ['pendiente', 'en_proceso'].includes(t.estado) && t.fecha < fechaLocalISO();

const inputCls = 'w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

/* ══════════════ Página ══════════════ */

export default function Agenda({ session }) {
  const { negocioId, puede } = useNegocio();
  const { toast, confirmar } = useUI();
  const navigate = useNavigate();

  const [trabajos, setTrabajos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [filtro, setFiltro] = useState('proximos');
  const [busqueda, setBusqueda] = useState('');

  /* ─────────── Datos ─────────── */
  const cargar = useCallback(async () => {
    if (!negocioId) return;
    const [t, c, v] = await Promise.all([
      supabase.from('agenda').select('*')
        .eq('negocio_id', negocioId)
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true, nullsFirst: false })
        .limit(MAX_TRABAJOS),
      supabase.from('clientes').select('id, nombre, alias, telefono, direccion')
        .eq('negocio_id', negocioId).order('nombre').limit(2000),
      supabase.from('ventas').select('id, folio, cliente_id, cliente, monto, estado')
        .eq('negocio_id', negocioId).order('fecha', { ascending: false }).limit(1000),
    ]);
    if (t.error) toast.error('No se pudo cargar la agenda: ' + t.error.message);
    setTrabajos(t.data || []);
    setClientes(c.data || []);
    setVentas(v.data || []);
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  useEffect(() => {
    if (!negocioId) return;
    setCargando(true);
    cargar();

    let timer;
    const recargar = () => { clearTimeout(timer); timer = setTimeout(cargar, 400); };
    const canal = supabase.channel(`agenda-${negocioId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'agenda', filter: `negocio_id=eq.${negocioId}` },
        recargar)
      .subscribe();

    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [negocioId, cargar]);

  /* ─────────── Formulario ─────────── */
  const setCampo = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const elegirCliente = (id) => {
    const c = clientes.find(x => String(x.id) === String(id));
    setForm(p => ({
      ...p,
      cliente_id: id,
      // Si el trabajo no tiene dirección propia, heredamos la del cliente.
      direccion: p.direccion || (c?.direccion ? limpiarTexto(c.direccion, LIMITES.direccion) : ''),
    }));
  };

  const abrirNuevo = (fechaPre) => {
    setEditId(null);
    setForm({ ...VACIO, fecha: fechaPre || fechaLocalISO() });
    setMostrarForm(true);
  };

  const editar = (t) => {
    setEditId(t.id);
    setForm({
      titulo: t.titulo || '',
      descripcion: t.descripcion || '',
      direccion: t.direccion || '',
      fecha: t.fecha || fechaLocalISO(),
      hora: t.hora ? String(t.hora).slice(0, 5) : '',
      duracion_min: t.duracion_min ?? 60,
      estado: t.estado || 'pendiente',
      prioridad: t.prioridad || 'normal',
      cliente_id: t.cliente_id ?? '',
      venta_id: t.venta_id ?? '',
      recordatorio_fecha: t.recordatorio_fecha ?? '',
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;

    const titulo = textoParaGuardar(form.titulo, LIMITES.agendaTitulo);
    if (titulo.length < 3) return toast.error('Escribe de qué se trata el trabajo (mínimo 3 caracteres).');
    if (!esFechaValida(form.fecha)) return toast.error('La fecha no es válida.');

    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    const duracion = Math.min(1440, Math.max(0, Math.round(Number(form.duracion_min) || 0)));

    const payload = {
      titulo,
      descripcion: textoParaGuardar(form.descripcion, LIMITES.agendaDescripcion, { multilinea: true }) || null,
      direccion: textoParaGuardar(form.direccion, LIMITES.direccion) || null,
      fecha: form.fecha,
      hora: form.hora || null,
      duracion_min: duracion,
      estado: ESTADOS_AGENDA[form.estado] ? form.estado : 'pendiente',
      prioridad: PRIORIDADES[form.prioridad] ? form.prioridad : 'normal',
      cliente_id: form.cliente_id || null,
      venta_id: form.venta_id || null,
      recordatorio_fecha: form.recordatorio_fecha || null,
    };

    setGuardando(true);
    const { error } = editId
      ? await supabase.from('agenda').update(payload).eq('id', editId)
      : await supabase.from('agenda').insert([{
          negocio_id: negocioId, user_id: session?.user?.id || null, ...payload,
        }]);
    setGuardando(false);

    if (error) return toast.error('No se pudo guardar: ' + error.message);
    toast.ok(editId ? 'Trabajo actualizado.' : 'Trabajo agendado.');
    setForm(VACIO);
    setEditId(null);
    setMostrarForm(false);
    cargar();
  };

  const cambiarEstado = async (t, estado) => {
    if (!ESTADOS_AGENDA[estado]) return;
    const { error } = await supabase.from('agenda').update({ estado }).eq('id', t.id);
    if (error) return toast.error('No se pudo actualizar: ' + error.message);
    setTrabajos(prev => prev.map(x => (x.id === t.id ? { ...x, estado } : x)));
    toast.ok(`Marcado como ${ESTADOS_AGENDA[estado].label.toLowerCase()}.`);
  };

  const posponer = async (t) => {
    if (t.estado === 'completado') return toast.warn('Un trabajo terminado no se puede posponer.');
    const base = t.fecha >= fechaLocalISO() ? t.fecha : fechaLocalISO();
    const nuevaFecha = sumarDiasLocal(base, 1);
    const ok = await confirmar({
      titulo: 'Posponer trabajo',
      mensaje: `“${t.titulo}” se moverá al ${formatoMX(nuevaFecha)}.`,
      okTexto: 'Posponer',
    });
    if (!ok) return;
    const { error } = await supabase.from('agenda').update({ fecha: nuevaFecha, estado: 'pendiente' }).eq('id', t.id);
    if (error) return toast.error('No se pudo posponer: ' + error.message);
    toast.ok(`Trabajo pospuesto al ${formatoMX(nuevaFecha)}.`);
    cargar();
  };

  const eliminar = async (t) => {
    const ok = await confirmar({
      titulo: 'Eliminar de la agenda',
      mensaje: `"${t.titulo}"`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('agenda').delete().eq('id', t.id);
    if (error) return toast.error('No se pudo eliminar: ' + error.message);
    toast.ok('Trabajo eliminado.');
    if (editId === t.id) { setEditId(null); setMostrarForm(false); }
    cargar();
  };

  /* ─────────── Filtrado y agrupación ─────────── */
  const FILTROS = [
    { id: 'proximos',  label: 'Próximos' },
    { id: 'hoy',       label: 'Hoy' },
    { id: 'semana',    label: '7 días' },
    { id: 'vencidos',  label: 'Vencidos' },
    { id: 'completado',label: 'Terminados' },
    { id: 'todos',     label: 'Todos' },
  ];

  const filtrados = useMemo(() => {
    const hoy = fechaLocalISO();
    const q = normalizar(busqueda);

    return trabajos.filter(t => {
      const abierto = ['pendiente', 'en_proceso'].includes(t.estado);
      switch (filtro) {
        case 'hoy':        if (t.fecha !== hoy || !abierto) return false; break;
        case 'semana':     if (!abierto || t.fecha < hoy || t.fecha > sumarDiasLocal(hoy, 7)) return false; break;
        case 'vencidos':   if (!estaVencido(t)) return false; break;
        case 'completado': if (t.estado !== 'completado') return false; break;
        case 'proximos':   if (!abierto) return false; break;
        default: break;
      }
      if (!q) return true;
      const cli = clientes.find(c => String(c.id) === String(t.cliente_id));
      return normalizar(t.titulo).includes(q)
        || normalizar(t.descripcion).includes(q)
        || normalizar(t.direccion).includes(q)
        || normalizar(cli?.nombre).includes(q);
    });
  }, [trabajos, filtro, busqueda, clientes]);

  const porDia = useMemo(() => {
    const mapa = new Map();
    const orden = filtro === 'completado' ? -1 : 1;
    [...filtrados]
      .sort((a, b) => orden * ((a.fecha + (a.hora || '99')).localeCompare(b.fecha + (b.hora || '99'))))
      .forEach(t => {
        if (!mapa.has(t.fecha)) mapa.set(t.fecha, []);
        mapa.get(t.fecha).push(t);
      });
    return [...mapa.entries()];
  }, [filtrados, filtro]);

  const conteos = useMemo(() => {
    const hoy = fechaLocalISO();
    return {
      hoy: trabajos.filter(t => t.fecha === hoy && ['pendiente', 'en_proceso'].includes(t.estado)).length,
      vencidos: trabajos.filter(estaVencido).length,
      abiertos: trabajos.filter(t => ['pendiente', 'en_proceso'].includes(t.estado)).length,
    };
  }, [trabajos]);

  const nombreCliente = (id) => clientes.find(c => String(c.id) === String(id))?.nombre;
  const cotizacionesDisponibles = form.cliente_id
    ? ventas.filter(v => String(v.cliente_id) === String(form.cliente_id))
    : ventas;

  const crearCotizacion = (t) => navigate('/presupuestos', {
    state: { agendaOrigen: { id: t.id, clienteId: t.cliente_id, cliente: nombreCliente(t.cliente_id) } },
  });

  /* ─────────── Render ─────────── */
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
            <CalendarDays className="text-primario" /> Agenda
          </h2>
          <p className="text-slate-500 font-medium text-sm">
            {conteos.abiertos} trabajo(s) abiertos · {conteos.hoy} para hoy
            {conteos.vencidos > 0 && <span className="text-rose-600 font-bold"> · {conteos.vencidos} vencido(s)</span>}
          </p>
        </div>
        <button onClick={() => (mostrarForm ? setMostrarForm(false) : abrirNuevo())}
          className={`px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase flex items-center gap-2 transition w-fit ${
            mostrarForm ? 'bg-slate-200 text-slate-600' : 'bg-primario text-white shadow-lg hover:bg-primario-dark'}`}>
          <Plus size={14} /> {mostrarForm ? 'Cerrar' : 'Nuevo trabajo'}
        </button>
      </div>

      {/* ══ Formulario ══ */}
      {mostrarForm && (
        <form onSubmit={guardar} className="bg-white p-6 rounded-3xl border-2 border-primario shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
            {editId ? <Pencil size={16} /> : <Plus size={16} />}
            {editId ? 'Editar trabajo' : 'Agendar trabajo'}
          </h3>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">¿Qué hay que hacer? *</label>
            <input value={form.titulo} maxLength={LIMITES.agendaTitulo}
              onChange={(e) => setCampo('titulo', limpiarTexto(e.target.value, LIMITES.agendaTitulo))}
              className={inputCls} placeholder="Ej. Cambio de centro de carga" autoFocus />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={(e) => setCampo('fecha', e.target.value)}
                className={inputCls} required />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Hora</label>
              <input type="time" value={form.hora} onChange={(e) => setCampo('hora', e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Duración (min)</label>
              <input type="number" min="0" max="1440" step="15" value={form.duracion_min}
                onChange={(e) => setCampo('duracion_min', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Prioridad</label>
              <select value={form.prioridad} onChange={(e) => setCampo('prioridad', e.target.value)}
                className={inputCls}>
                {Object.entries(PRIORIDADES).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cliente</label>
              <select value={form.cliente_id} onChange={(e) => elegirCliente(e.target.value)} className={inputCls}>
                <option value="">Sin cliente asignado</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}{c.alias ? ` — ${c.alias}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado</label>
              <select value={form.estado} onChange={(e) => setCampo('estado', e.target.value)} className={inputCls}>
                {Object.entries(ESTADOS_AGENDA).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cotización vinculada</label>
            <select value={form.venta_id} onChange={(e) => setCampo('venta_id', e.target.value)} className={inputCls}>
              <option value="">Sin cotización vinculada</option>
              {cotizacionesDisponibles.map(v => (
                <option key={v.id} value={v.id}>
                  #{String(v.folio || '').padStart(4, '0')} · {v.cliente || 'Público en General'} · {money(v.monto)}
                </option>
              ))}
            </select>
            <p className="text-[10px] font-medium text-slate-400 mt-1">Puedes vincular una existente o crear una desde la flecha del trabajo.</p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha de recordatorio</label>
            <input type="date" value={form.recordatorio_fecha} onChange={(e) => setCampo('recordatorio_fecha', e.target.value)} className={inputCls} />
            <p className="text-[10px] font-medium text-slate-400 mt-1">Úsala para llamadas de seguimiento, compras de material o confirmación con el cliente.</p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Dirección</label>
            <input value={form.direccion} maxLength={LIMITES.direccion}
              onChange={(e) => setCampo('direccion', limpiarTexto(e.target.value, LIMITES.direccion))}
              className={inputCls} placeholder="Calle, número y colonia" />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
              Notas <span className="text-slate-300">({form.descripcion.length}/{LIMITES.agendaDescripcion})</span>
            </label>
            <textarea rows={3} value={form.descripcion} maxLength={LIMITES.agendaDescripcion}
              onChange={(e) => setCampo('descripcion', limpiarTexto(e.target.value, LIMITES.agendaDescripcion, { multilinea: true }))}
              className={`${inputCls} resize-none font-medium`}
              placeholder="Material a llevar, referencias del lugar, acuerdos con el cliente..." />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={guardando}
              className="flex-1 bg-primario text-white p-3.5 rounded-2xl font-bold hover:bg-primario-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={16} /> {guardando ? 'Guardando...' : editId ? 'Actualizar' : 'Agendar'}
            </button>
            <button type="button" onClick={() => { setMostrarForm(false); setEditId(null); setForm(VACIO); }}
              className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* ══ Filtros ══ */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={busqueda} maxLength={LIMITES.busqueda}
            onChange={(e) => setBusqueda(limpiarTexto(e.target.value, LIMITES.busqueda))}
            placeholder="Buscar trabajo, cliente o dirección..."
            className="w-full pl-12 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 shadow-sm focus:border-primario transition" />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Limpiar"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-black uppercase transition ${
                filtro === f.id
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              {f.label}
              {f.id === 'vencidos' && conteos.vencidos > 0 && (
                <span className="ml-1.5 text-rose-500">{conteos.vencidos}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Listado por día ══ */}
      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-3xl animate-pulse" />)}
        </div>
      ) : porDia.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-14 text-center">
          <CalendarDays size={44} className="mx-auto text-slate-200 mb-3" />
          <p className="font-bold text-slate-500">
            {trabajos.length === 0 ? 'Tu agenda está vacía' : 'Nada en este filtro'}
          </p>
          <p className="text-slate-400 text-sm mt-1 mb-4">
            {trabajos.length === 0
              ? 'Agenda el primer trabajo para no perderle la pista.'
              : 'Prueba con otro filtro o limpia la búsqueda.'}
          </p>
          <button onClick={() => abrirNuevo()}
            className="bg-primario text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase inline-flex items-center gap-2">
            <Plus size={14} /> Nuevo trabajo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {porDia.map(([fecha, items]) => {
            const vencidoDia = fecha < fechaLocalISO();
            return (
              <div key={fecha} className="space-y-2">
                <div className="flex items-center gap-3 px-1">
                  <h3 className={`text-[11px] font-black uppercase tracking-widest ${
                    fecha === fechaLocalISO() ? 'text-primario' : vencidoDia ? 'text-rose-500' : 'text-slate-400'}`}>
                    {etiquetaDia(fecha)}
                  </h3>
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[10px] font-black text-slate-300">{items.length}</span>
                  <button onClick={() => abrirNuevo(fecha)} title="Agendar en este día"
                    className="text-slate-300 hover:text-primario"><Plus size={15} /></button>
                </div>

                {items.map(t => {
                  const est = ESTADOS_AGENDA[t.estado] || ESTADOS_AGENDA.pendiente;
                  const pri = PRIORIDADES[t.prioridad] || PRIORIDADES.normal;
                  const Icono = est.icon;
                  const cliente = nombreCliente(t.cliente_id);
                  const vencido = estaVencido(t);

                  return (
                    <div key={t.id}
                      className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-primario transition overflow-hidden flex">
                      <div className={`w-1.5 shrink-0 ${pri.barra}`} aria-hidden="true" />
                      <div className="flex-1 p-4 sm:p-5 min-w-0">

                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-2xl border shrink-0 ${est.color}`}>
                            <Icono size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {t.hora && (
                                <span className="text-[11px] font-black text-slate-700 tabular-nums">
                                  {String(t.hora).slice(0, 5)}
                                </span>
                              )}
                              <h4 className={`font-black truncate ${
                                t.estado === 'completado' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {t.titulo}
                              </h4>
                              {t.prioridad === 'alta' && (
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${pri.color}`}>
                                  Alta
                                </span>
                              )}
                              {vencido && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-1">
                                  <AlertTriangle size={10} /> Vencido
                                </span>
                              )}
                            </div>

                            {t.descripcion && (
                              <p className="text-sm text-slate-500 line-clamp-2 mt-1">{t.descripcion}</p>
                            )}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-bold text-slate-400">
                              {cliente && (
                                <button onClick={() => navigate('/clientes')}
                                  className="flex items-center gap-1.5 hover:text-primario">
                                  <User size={12} /> {cliente}
                                </button>
                              )}
                              {t.direccion && (
                                <a target="_blank" rel="noopener noreferrer"
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion)}`}
                                  className="flex items-center gap-1.5 hover:text-primario truncate max-w-[220px]">
                                  <MapPin size={12} /> {t.direccion}
                                </a>
                              )}
                            {t.duracion_min > 0 && (
                              <span className="flex items-center gap-1.5">
                                <Clock size={12} /> {t.duracion_min} min
                              </span>
                            )}
                            {t.venta_id && (
                              <button onClick={() => navigate('/historial')}
                                className="flex items-center gap-1.5 text-primario hover:underline">
                                <FileText size={12} /> Cotización vinculada
                              </button>
                            )}
                            {t.recordatorio_fecha && (
                              <span className={`flex items-center gap-1.5 ${t.recordatorio_fecha <= fechaLocalISO() ? 'text-amber-600' : 'text-slate-400'}`}>
                                <Bell size={12} /> Recordatorio {formatoMX(t.recordatorio_fecha)}
                              </span>
                            )}
                            </div>
                          </div>
                        </div>

                        {/* Acciones: siempre visibles, con área táctil de 44px */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <select value={t.estado} onChange={(e) => cambiarEstado(t, e.target.value)}
                            aria-label="Estado del trabajo"
                            className={`text-[10px] font-black uppercase px-2.5 min-h-[44px] rounded-xl border outline-none cursor-pointer mr-auto ${est.color}`}>
                            {Object.entries(ESTADOS_AGENDA).map(([id, s]) => (
                              <option key={id} value={id}>{s.label}</option>
                            ))}
                          </select>

                          {t.estado !== 'completado' && (
                            <button onClick={() => cambiarEstado(t, 'completado')}
                              className="min-h-[44px] px-4 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase hover:bg-emerald-100 transition flex items-center gap-1.5">
                              <CheckCircle2 size={15} /> Terminado
                            </button>
                          )}
                          {t.estado !== 'completado' && (
                            <button onClick={() => posponer(t)} title="Posponer para mañana"
                              className="min-h-[44px] px-3 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black uppercase hover:bg-amber-100 transition flex items-center gap-1">
                              <Clock size={14} /> Mañana
                            </button>
                          )}
                          <button onClick={() => crearCotizacion(t)} title="Crear y vincular cotización"
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-primario hover:bg-primario-suave transition">
                            <ChevronRight size={18} />
                          </button>
                          <button onClick={() => editar(t)} title="Editar"
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-primario hover:bg-primario-suave transition">
                            <Pencil size={17} />
                          </button>
                          {puede('eliminar_registros') && (
                            <button onClick={() => eliminar(t)} title="Eliminar"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition">
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
