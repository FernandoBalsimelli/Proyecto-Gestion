import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from './ui/UI.jsx';
import {
  X, Search, Plus, Trash2, Package, Tag, LayoutGrid, Save, TrendingUp, Pencil,
} from 'lucide-react';
import {
  LIMITES, limpiarTexto, textoParaGuardar, normalizar,
  entradaNumerica, bloquearTeclasNumericas, numeroSeguro, verificarPolitica,
} from '../utils/seguridad.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const CATEGORIAS = ['General', 'Mano de obra', 'Material', 'Equipo', 'Servicio', 'Traslado'];
const UNIDADES = ['pza', 'mt', 'm²', 'hr', 'día', 'servicio', 'kg', 'lote'];

const VACIO = { descripcion: '', precio: '', unidad: 'pza', categoria: 'General' };
const MAX_SERVICIOS = 1000;

export default function ModalCatalogo({ onCerrar, onAgregar }) {
  const { negocioId, puede } = useNegocio();
  const { toast, confirmar } = useUI();

  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState('todas');
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  /* ─────────── Datos ─────────── */
  const cargar = useCallback(async () => {
    if (!negocioId) return;
    const { data, error } = await supabase.from('servicios').select('*')
      .eq('negocio_id', negocioId)
      .order('veces_usado', { ascending: false })
      .order('descripcion')
      .limit(MAX_SERVICIOS);
    if (error) toast.error('No se pudo cargar el catálogo: ' + error.message);
    setItems(data || []);
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onCerrar]);

  /* ─────────── Acciones ─────────── */
  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;

    const descripcion = textoParaGuardar(form.descripcion, LIMITES.descripcionConcepto);
    if (!descripcion) return toast.error('Escribe una descripción.');

    if (!editId && items.length >= MAX_SERVICIOS) {
      return toast.error(`El catálogo admite hasta ${MAX_SERVICIOS} servicios.`);
    }

    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    setGuardando(true);
    const payload = {
      descripcion,
      precio: numeroSeguro(form.precio, { max: LIMITES.maxMonto }),
      unidad: UNIDADES.includes(form.unidad) ? form.unidad : 'pza',
      categoria: CATEGORIAS.includes(form.categoria) ? form.categoria : 'General',
    };

    const { error } = editId
      ? await supabase.from('servicios').update(payload).eq('id', editId)
      : await supabase.from('servicios').insert([{ negocio_id: negocioId, ...payload }]);

    setGuardando(false);
    if (error) return toast.error('No se pudo guardar: ' + error.message);

    toast.ok(editId ? 'Servicio actualizado.' : 'Servicio agregado al catálogo.');
    setForm(VACIO); setEditId(null); setMostrarForm(false);
    cargar();
  };

  const eliminar = async (it) => {
    const ok = await confirmar({
      titulo: 'Eliminar del catálogo',
      mensaje: `"${it.descripcion}"`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('servicios').delete().eq('id', it.id);
    if (error) return toast.error('No se pudo eliminar: ' + error.message);
    toast.ok('Eliminado.');
    if (editId === it.id) { setEditId(null); setForm(VACIO); setMostrarForm(false); }
    cargar();
  };

  const usar = (it) => {
    onAgregar({
      cantidad: 1,
      descripcion: it.descripcion,
      precio: String(it.precio ?? ''),
    });

    // La RPC incrementa el contador de uso de forma atómica.
    supabase.rpc('incrementar_uso_servicio', { p_id: it.id }).then(() => {});

    toast.ok(`"${it.descripcion.slice(0, 30)}${it.descripcion.length > 30 ? '…' : ''}" agregado.`);
  };

  const editar = (it) => {
    setEditId(it.id);
    setForm({
      descripcion: it.descripcion || '',
      precio: String(it.precio ?? ''),
      unidad: it.unidad || 'pza',
      categoria: it.categoria || 'General',
    });
    setMostrarForm(true);
  };

  /* ─────────── Filtros ─────────── */
  const cats = useMemo(
    () => ['todas', ...new Set(items.map(i => i.categoria || 'General'))],
    [items]
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return items.filter(i =>
      (cat === 'todas' || (i.categoria || 'General') === cat) &&
      (!q || normalizar(i.descripcion).includes(q))
    );
  }, [items, busqueda, cat]);

  const input = 'w-full p-3 pl-9 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

  /* ─────────── Render ─────────── */
  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_.15s]"
      onClick={onCerrar} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-slate-50 w-full sm:max-w-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col animate-[popIn_.2s]">

        {/* ── Encabezado ── */}
        <div className="p-5 sm:p-6 bg-white sm:rounded-t-3xl rounded-t-3xl border-b border-slate-200 shrink-0 space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catálogo</p>
              <h3 className="font-black text-slate-800 text-xl">Precios y servicios</h3>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition">
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input value={busqueda} maxLength={LIMITES.busqueda} autoFocus
                onChange={(e) => setBusqueda(limpiarTexto(e.target.value, LIMITES.busqueda))}
                placeholder="Buscar en el catálogo..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-primario/10 transition" />
            </div>
            <button onClick={() => { setMostrarForm(!mostrarForm); setEditId(null); setForm(VACIO); }}
              className={`px-4 rounded-2xl font-black text-[11px] uppercase transition flex items-center gap-1.5 shrink-0 ${
                mostrarForm ? 'bg-slate-200 text-slate-600' : 'bg-primario text-white shadow-lg'}`}>
              <Plus size={15} /> Nuevo
            </button>
          </div>

          {cats.length > 2 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {cats.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition ${
                    cat === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {c === 'todas' ? 'Todas' : c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Cuerpo ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">

          {mostrarForm && (
            <form onSubmit={guardar} className="bg-white p-5 rounded-3xl border-2 border-primario shadow-sm space-y-3">
              <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                {editId ? <Pencil size={15} /> : <Plus size={15} />}
                {editId ? 'Editar servicio' : 'Nuevo servicio'}
              </h4>

              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input value={form.descripcion} maxLength={LIMITES.descripcionConcepto}
                  onChange={(e) => setForm({ ...form, descripcion: limpiarTexto(e.target.value, LIMITES.descripcionConcepto) })}
                  placeholder="Ej. Instalación de contacto polarizado" className={input} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="text" inputMode="decimal" value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: entradaNumerica(e.target.value, { maxEnteros: 8 }) })}
                    onKeyDown={bloquearTeclasNumericas}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00" className={`${input} text-right`} />
                </div>
                <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none">
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none">
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-primario text-white p-3 rounded-2xl font-bold text-sm hover:bg-primario-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save size={16} /> {guardando ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditId(null); setForm(VACIO); }}
                  className="px-5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {cargando ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <LayoutGrid size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="font-bold text-slate-500">
                {items.length === 0 ? 'Tu catálogo está vacío' : 'Sin resultados'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {items.length === 0
                  ? 'Guarda tus servicios más frecuentes para cotizar en segundos.'
                  : 'Prueba con otra búsqueda o categoría.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(it => (
                <div key={it.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3 hover:border-primario hover:shadow-sm transition">
                  <button onClick={() => usar(it)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                    <div className="bg-primario-suave text-primario p-2.5 rounded-xl shrink-0"><Package size={17} /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{it.descripcion}</p>
                      <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                        {it.categoria} · por {it.unidad}
                        {it.veces_usado > 0 && (
                          <span className="text-primario flex items-center gap-0.5">
                            <TrendingUp size={10} /> {it.veces_usado}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>

                  <span className="font-black text-slate-800 tabular-nums shrink-0">{money(it.precio)}</span>

                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => editar(it)} aria-label="Editar servicio"
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-primario hover:bg-primario-suave rounded-xl transition">
                      <Pencil size={15} />
                    </button>
                    {puede('eliminar_registros') && (
                      <button onClick={() => eliminar(it)} aria-label="Eliminar servicio"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 sm:rounded-b-3xl shrink-0 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold text-slate-400 hidden sm:block">
            Toca un servicio para agregarlo a la cotización.
          </p>
          <button onClick={onCerrar}
            className="w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
