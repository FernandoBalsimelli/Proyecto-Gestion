import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Save, FileDown, User, Calendar, CreditCard,
  FileText, Calculator, CheckCircle, Copy,
} from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { generarDocumentoPDF } from '../utils/pdfGenerador.js';
import { hoyLocal, formatoMX } from '../utils/fecha.js';
import { useUI } from '../components/ui/UI.jsx';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

/* ✅ Fuera del componente: textarea que crece solo */
function AutoTextarea({ value, onChange, className = '', ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(46, el.scrollHeight) + 'px';
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={onChange} className={className} {...props} />;
}

const FILA_VACIA = { cantidad: 1, descripcion: '', precio: '' };

export default function Presupuestos({ session }) {
  const { toast } = useUI();
  const { negocioId } = useNegocio();
  const location = useLocation();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [config, setConfig] = useState({
    tituloDocumento: 'PRESUPUESTO', especialidad: '', nombre: '', direccion: '',
    telefono: '', logo: null, banco: '', cuentaNombre: '', cuentaNumero: '',
    condiciones: 'Se solicitará el 50% de anticipo antes del comienzo de la obra. El presupuesto tiene una vigencia de 15 días.',
    sitioWeb: '', mostrar_firma: false, firma_base64: null,
  });
  const [pdfCfg, setPdfCfg] = useState({ plantilla: 'clasico', color: '#16415e', tabla: 'striped' });

  const [ventaId, setVentaId] = useState(null);
  const [folio, setFolio] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [fecha, setFecha] = useState(hoyLocal());
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [estado, setEstado] = useState('pendiente');
  const [incluirIva, setIncluirIva] = useState(false);
  const [conceptos, setConceptos] = useState([{ ...FILA_VACIA }]);

  /* ─────────── Carga inicial ─────────── */
  useEffect(() => {
    if (!negocioId) return;

    (async () => {
      const { data: cli } = await supabase
        .from('clientes').select('id, nombre, alias')
        .eq('negocio_id', negocioId).order('nombre');
      setClientes(cli || []);

      const { data: cfg } = await supabase
        .from('configuracion').select('*')
        .eq('negocio_id', negocioId).maybeSingle();

      if (cfg) {
        setConfig(prev => ({
          ...prev,
          tituloDocumento: cfg.titulo_documento || 'PRESUPUESTO',
          especialidad: cfg.especialidad || '',
          nombre: cfg.nombre || '',
          direccion: cfg.direccion || '',
          telefono: cfg.telefono || '',
          logo: cfg.logo || null,
          banco: cfg.banco || '',
          cuentaNombre: cfg.cuenta_nombre || '',
          cuentaNumero: cfg.cuenta_numero || '',
          condiciones: cfg.condiciones || prev.condiciones,
          sitioWeb: cfg.sitio_web || '',
          mostrar_firma: cfg.mostrar_firma || false,
          firma_base64: cfg.firma_base64 || null,
        }));
        if (cfg.pdf) setPdfCfg(p => ({ ...p, ...cfg.pdf }));
      }
    })();
  }, [negocioId]);

  /* ─────────── Cargar venta a editar ─────────── */
  useEffect(() => {
    const v = location.state?.ventaEditar;
    if (!v) return;

    setVentaId(v.id);
    setFolio(v.folio ?? null);
    setClienteId(v.cliente_id || '');
    setClienteNombre(v.cliente || '');
    setFecha(v.fecha || hoyLocal());
    setMetodoPago(v.metodo_pago || 'Efectivo');
    setEstado(v.estado || 'pendiente');

    if (Array.isArray(v.conceptos) && v.conceptos.length) {
      setConceptos(v.conceptos);
    } else if (v.descripcion) {
      const parts = v.descripcion.split(' | ').map(item => {
        const m = item.trim().match(/^(\d+(?:\.\d+)?)x\s+(.+?)(?:\s+\(\$([\d.]+)\))?$/);
        return m
          ? { cantidad: Number(m[1]), descripcion: m[2].trim(), precio: m[3] ? Number(m[3]) : '' }
          : { cantidad: 1, descripcion: item.trim(), precio: '' };
      });
      setConceptos(parts.length ? parts : [{ ...FILA_VACIA }]);
    }
  }, [location.state]);

  /* ─────────── Helpers ─────────── */
  const seleccionarTodo = (e) => e.target.select();
  const agregarFila = () => setConceptos(c => [...c, { ...FILA_VACIA }]);
  const duplicarFila = (i) =>
    setConceptos(c => [...c.slice(0, i + 1), { ...c[i] }, ...c.slice(i + 1)]);
  const eliminarFila = (i) =>
    setConceptos(c => (c.length === 1 ? [{ ...FILA_VACIA }] : c.filter((_, j) => j !== i)));

  const actualizarFila = (i, campo, valor) =>
    setConceptos(c => c.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  const subtotal = useMemo(
    () => conceptos.reduce((a, c) => a + (Number(c.cantidad) || 0) * (Number(c.precio) || 0), 0),
    [conceptos]
  );
  const montoIva = incluirIva ? subtotal * 0.16 : 0;
  const totalNeto = subtotal + montoIva;
  const tituloBoton = (config.tituloDocumento || 'PRESUPUESTO').toLowerCase().replace(/^./, c => c.toUpperCase());

  const conceptosLimpios = () =>
    conceptos
      .filter(c => c.descripcion.trim() !== '' && Number(c.cantidad) > 0)
      .map(c => ({
        cantidad: Number(c.cantidad) || 0,
        descripcion: c.descripcion.trim(),
        precio: Number(c.precio) || 0,
      }));

  /* ─────────── PDF ─────────── */
  const generarPDF = () => {
    const limpios = conceptosLimpios();
    if (!limpios.length) return toast.error('Agrega al menos un concepto válido para el PDF.');

    generarDocumentoPDF({
      config, pdfCfg,
      cliente: clienteNombre,
      fecha: formatoMX(fecha),
      metodoPago, folio,
      conceptos: limpios,
      subtotal, montoIva, total: totalNeto, incluirIva,
    }, 'save');
  };

  /* ─────────── Guardar ─────────── */
  const guardarVenta = async () => {
    const limpios = conceptosLimpios();
    if (!limpios.length) return toast.error('Agrega al menos un concepto con descripción y cantidad.');
    if (totalNeto <= 0) return toast.error('El total está en ceros. Agrega precios válidos.');
    if (!negocioId) return toast.ok('Cargando negocio, espera un momento.');

    setCargando(true);
    try {
      const descripcion = limpios.map(c => `${c.cantidad}x ${c.descripcion} ($${c.precio})`).join(' | ');

      const datos = {
        cliente: clienteNombre || 'Público en General',
        cliente_id: clienteId || null,
        descripcion,
        conceptos: limpios,
        monto: totalNeto,
        fecha,
        metodo_pago: metodoPago,
        estado,
      };

      if (ventaId) {
        const { error } = await supabase.from('ventas').update(datos).eq('id', ventaId);
        if (error) throw error;
        toast.ok('Cotización actualizada correctamente.');
        navigate('/historial');
      } else {
        const { data, error } = await supabase
          .from('ventas')
          .insert([{ negocio_id: negocioId, user_id: session.user.id, ...datos }])
          .select('id, folio').single();
        if (error) throw error;
        setVentaId(data.id);
        setFolio(data.folio ?? null);
        toast.ok('Cotización registrada exitosamente.');
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setCargando(false);
    }
  };

  const nuevo = () => {
    setVentaId(null); setFolio(null); setClienteId(''); setClienteNombre('');
    setFecha(hoyLocal()); setMetodoPago('Efectivo'); setEstado('pendiente');
    setIncluirIva(false); setConceptos([{ ...FILA_VACIA }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inputBase = 'w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

  /* ─────────── Render ─────────── */
  return (
    <div className="p-4 md:p-8 space-y-6 pb-40 md:pb-8">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase flex items-center gap-2">
            <Calculator className="text-primario" />
            {ventaId ? 'Editar documento' : 'Nuevo documento'}
          </h2>
          <p className="text-slate-500 font-medium text-sm">
            {folio ? `Folio #${String(folio).padStart(4, '0')} · ` : ''}
            {conceptos.length} concepto(s)
          </p>
        </div>
        {ventaId && (
          <button onClick={nuevo}
            className="text-[11px] font-black uppercase px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
            + Crear uno nuevo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ══ PANEL IZQUIERDO ══ */}
        <div className="xl:col-span-1">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5 xl:sticky xl:top-8">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText size={18} /> Datos del documento
            </h3>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cliente</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                <select
                  value={clienteId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setClienteId(id);
                    const c = clientes.find(x => String(x.id) === String(id));
                    setClienteNombre(c ? c.nombre : '');
                  }}
                  className={`${inputBase} pl-9 font-bold`}>
                  <option value="">Público en General</option>
                  {clienteNombre && !clienteId && (
                    <option value="__sin_registrar" disabled>{clienteNombre} (sin registrar)</option>
                  )}
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}{c.alias ? ` — ${c.alias}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                  className={`${inputBase} pl-9`} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Método de pago</label>
              <div className="relative mt-1">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
                  className={`${inputBase} pl-9`}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Por definir</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado</label>
              <div className="relative mt-1">
                <CheckCircle className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 ${estado === 'pagado' ? 'text-emerald-500'
                    : estado === 'cancelado' ? 'text-slate-400' : 'text-amber-500'}`} />
                <select value={estado} onChange={(e) => setEstado(e.target.value)}
                  className={`w-full p-3 pl-9 rounded-xl outline-none border font-bold transition ${estado === 'pagado' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : estado === 'cancelado' ? 'bg-slate-100 border-slate-300 text-slate-500'
                        : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  <option value="pendiente">Pendiente (por cobrar)</option>
                  <option value="pagado">Pagado (completado)</option>
                  <option value="cancelado">Cancelado (archivado)</option>
                </select>
              </div>
            </div>

            {/* Totales — escritorio */}
            <div className="hidden xl:block pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between text-sm font-medium text-slate-500">
                <span>Subtotal</span><span>{money(subtotal)}</span>
              </div>
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={incluirIva} onChange={(e) => setIncluirIva(e.target.checked)}
                    className="w-4 h-4 rounded accent-[color:var(--color-primario)] cursor-pointer" />
                  <span className="text-sm font-bold text-slate-600">IVA (16%)</span>
                </span>
                <span className="text-sm text-slate-500">{money(montoIva)}</span>
              </label>
              <div className="pt-3 mt-1 border-t border-slate-200 flex justify-between items-center">
                <span className="font-black text-slate-800 uppercase text-sm">Total</span>
                <span className="text-2xl font-black text-primario tracking-tighter">{money(totalNeto)}</span>
              </div>
            </div>

            <div className="hidden xl:flex flex-col gap-2 pt-2">
              <button onClick={guardarVenta} disabled={cargando}
                className="bg-primario text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-primario-dark transition shadow-lg flex justify-center items-center gap-2 disabled:opacity-50">
                <Save size={18} /> {cargando ? 'Guardando...' : ventaId ? 'Actualizar' : 'Registrar'}
              </button>
              <button onClick={generarPDF}
                className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-slate-900 transition flex justify-center items-center gap-2">
                <FileDown size={18} /> Descargar {tituloBoton}
              </button>
            </div>
          </div>
        </div>

        {/* ══ CONCEPTOS ══ */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Conceptos del servicio</h3>
            <button onClick={agregarFila}
              className="text-primario bg-primario-suave hover:bg-primario hover:text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 text-sm transition">
              <Plus size={16} /> Agregar línea
            </button>
          </div>

          {conceptos.map((c, i) => {
            const importe = (Number(c.cantidad) || 0) * (Number(c.precio) || 0);
            return (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-black text-slate-300 pt-3.5 w-6 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <AutoTextarea
                    value={c.descripcion}
                    onChange={(e) => actualizarFila(i, 'descripcion', e.target.value)}
                    placeholder="Descripción del servicio o material..."
                    className="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 font-medium resize-none leading-snug focus:bg-white focus:ring-2 focus:ring-primario/10 transition"
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => duplicarFila(i)} title="Duplicar"
                      className="p-2 text-slate-300 hover:text-primario hover:bg-primario-suave rounded-lg transition">
                      <Copy size={16} />
                    </button>
                    <button onClick={() => eliminarFila(i)} title="Eliminar"
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-end gap-2 pl-8">
                  <div className="w-20 shrink-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Cant.</label>
                    <input type="number" inputMode="decimal" min="0" step="any" value={c.cantidad}
                      onChange={(e) => actualizarFila(i, 'cantidad', e.target.value)} onFocus={seleccionarTodo}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-center outline-none focus:bg-white" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Precio unitario</label>
                    <input type="number" inputMode="decimal" min="0" step="any" value={c.precio} placeholder="0.00"
                      onChange={(e) => actualizarFila(i, 'precio', e.target.value)} onFocus={seleccionarTodo}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-right outline-none focus:bg-white" />
                  </div>
                  <div className="flex-1 text-right">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Importe</label>
                    <p className="p-3 font-black text-slate-800 tabular-nums">{money(importe)}</p>
                  </div>
                </div>
              </div>
            );
          })}

          <button onClick={agregarFila}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold hover:border-primario hover:text-primario transition flex items-center justify-center gap-2">
            <Plus size={18} /> Agregar otra línea
          </button>
        </div>
      </div>

      {/* ══ BARRA FIJA MÓVIL ══ */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-30 shadow-2xl space-y-3">
        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={incluirIva} onChange={(e) => setIncluirIva(e.target.checked)}
              className="w-4 h-4 rounded accent-[color:var(--color-primario)]" />
            <span className="text-[11px] font-black text-slate-500 uppercase">IVA 16%</span>
          </label>
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase block leading-none">Total</span>
            <span className="text-2xl font-black text-primario tabular-nums">{money(totalNeto)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generarPDF}
            className="flex-1 bg-slate-800 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5">
            <FileDown size={16} /> PDF
          </button>
          <button onClick={guardarVenta} disabled={cargando}
            className="flex-[2] bg-primario text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Save size={16} /> {cargando ? 'Guardando...' : ventaId ? 'Actualizar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}