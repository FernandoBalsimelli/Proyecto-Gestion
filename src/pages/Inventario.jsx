import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, Boxes, Download, Pencil, Plus, Save, Trash2, Truck, X } from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import { exportarCSV } from '../utils/exportar.js';
import { entradaNumerica, fechaLocalISO, LIMITES, limpiarTexto, numeroSeguro, telefonoMX, textoParaGuardar } from '../utils/seguridad.js';

const UNIDADES = ['Pieza', 'Metro', 'Centímetro', 'Paquete', 'Caja', 'Juego', 'Rollo', 'Kilogramo', 'Litro', 'Servicio', 'Otro'];
const VACIO = { nombre: '', sku: '', unidad: 'Pieza', minimo: '', costo: '', proveedor_id: '' };
const input = 'w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primario/10';
const money = n => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const cantidad = n => Number(n) || 0;

export default function Inventario({ session }) {
  const { negocioId } = useNegocio();
  const { toast, confirmar } = useUI();
  const [items, setItems] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movs, setMovs] = useState([]);
  const [item, setItem] = useState(VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [proveedor, setProveedor] = useState({ nombre: '', telefono: '', contacto: '' });
  const [mov, setMov] = useState({ item_id: '', tipo: 'entrada', cantidad: '', nota: '' });

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    const [i, p, m] = await Promise.all([
      supabase.from('almacen_articulos').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre'),
      supabase.from('almacen_proveedores').select('*').eq('negocio_id', negocioId).order('nombre'),
      supabase.from('almacen_movimientos').select('*, almacen_articulos(nombre)').eq('negocio_id', negocioId).order('created_at', { ascending: false }).limit(30),
    ]);
    if (i.error || p.error || m.error) return toast.error((i.error || p.error || m.error).message);
    setItems(i.data || []); setProveedores(p.data || []); setMovs(m.data || []);
  }, [negocioId, toast]);
  useEffect(() => { cargar(); }, [cargar]);
  const bajos = useMemo(() => items.filter(i => cantidad(i.existencias) <= cantidad(i.minimo)), [items]);

  const cancelarEdicion = () => { setItem(VACIO); setEditandoId(null); };
  const editarItem = material => {
    setEditandoId(material.id);
    setItem({ nombre: material.nombre || '', sku: material.sku || '', unidad: UNIDADES.includes(material.unidad) ? material.unidad : 'Otro', minimo: String(material.minimo ?? ''), costo: String(material.costo ?? ''), proveedor_id: material.proveedor_id || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const guardarItem = async e => {
    e.preventDefault();
    const nombre = textoParaGuardar(item.nombre, LIMITES.descripcion);
    if (!nombre) return toast.warn('Escribe el nombre del material.');
    const datos = { nombre, sku: textoParaGuardar(item.sku, 50) || null, unidad: item.unidad, minimo: numeroSeguro(item.minimo), costo: numeroSeguro(item.costo), proveedor_id: item.proveedor_id || null };
    const { error } = editandoId ? await supabase.from('almacen_articulos').update(datos).eq('id', editandoId) : await supabase.from('almacen_articulos').insert([{ negocio_id: negocioId, ...datos }]);
    if (error) return toast.error(error.message);
    toast.ok(editandoId ? 'Material actualizado.' : 'Material guardado.'); cancelarEdicion(); cargar();
  };
  const eliminarItem = async material => {
    const ok = await confirmar({ titulo: 'Eliminar material', mensaje: `“${material.nombre}” dejará de aparecer en existencias. Su historial se conservará.`, okTexto: 'Eliminar', peligro: true });
    if (!ok) return;
    const { error } = await supabase.from('almacen_articulos').update({ activo: false }).eq('id', material.id);
    if (error) return toast.error(error.message);
    if (editandoId === material.id) cancelarEdicion();
    toast.ok('Material eliminado de existencias.'); cargar();
  };
  const guardarProveedor = async e => {
    e.preventDefault(); const nombre = textoParaGuardar(proveedor.nombre, LIMITES.proveedor);
    if (!nombre) return toast.warn('Escribe el nombre del proveedor.');
    const { error } = await supabase.from('almacen_proveedores').insert([{ negocio_id: negocioId, nombre, telefono: telefonoMX(proveedor.telefono) || null, contacto: textoParaGuardar(proveedor.contacto, LIMITES.nombre) || null }]);
    if (error) return toast.error(error.message);
    setProveedor({ nombre: '', telefono: '', contacto: '' }); toast.ok('Proveedor guardado.'); cargar();
  };
  const guardarMov = async e => {
    e.preventDefault(); const material = items.find(i => i.id === mov.item_id), unidades = numeroSeguro(mov.cantidad);
    if (!material || unidades <= 0) return toast.warn('Selecciona un material y una cantidad válida.');
    const delta = mov.tipo === 'salida' ? -unidades : unidades;
    if (cantidad(material.existencias) + delta < 0) return toast.warn('No hay existencias suficientes.');
    const { error } = await supabase.from('almacen_movimientos').insert([{ negocio_id: negocioId, articulo_id: material.id, user_id: session.user.id, tipo: mov.tipo, cantidad: unidades, nota: textoParaGuardar(mov.nota, LIMITES.nota) || null, fecha: fechaLocalISO() }]);
    if (error) return toast.error(error.message);
    const { error: stockError } = await supabase.from('almacen_articulos').update({ existencias: cantidad(material.existencias) + delta }).eq('id', material.id);
    if (stockError) return toast.error(stockError.message);
    setMov({ item_id: '', tipo: 'entrada', cantidad: '', nota: '' }); toast.ok('Movimiento registrado.'); cargar();
  };
  const exportar = () => {
    if (!items.length) return toast.warn('No hay materiales para exportar.');
    exportarCSV('inventario', [{ label: 'Material', valor: x => x.nombre }, { label: 'Código', valor: x => x.sku || '' }, { label: 'Unidad', valor: x => x.unidad }, { label: 'Existencias', valor: x => x.existencias }, { label: 'Mínimo', valor: x => x.minimo }, { label: 'Costo', valor: x => x.costo }], items);
    toast.ok('Inventario exportado.');
  };

  return <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex gap-3 items-center"><Boxes className="text-primario" /> Inventario y proveedores</h2><p className="text-sm text-slate-500">Materiales, existencias, mínimos y movimientos para evitar compras urgentes.</p></div><button onClick={exportar} className="bg-white border px-4 py-2 rounded-xl text-xs font-black"><Download size={14} className="inline mr-1" />Exportar CSV</button></div>
    {bajos.length > 0 && <p className="p-4 bg-amber-50 rounded-2xl text-amber-800 font-bold"><AlertTriangle className="inline mr-2" />{bajos.length} material(es) requieren reposición.</p>}
    <div className="grid xl:grid-cols-3 gap-6">
      <form onSubmit={guardarItem} className="bg-white border rounded-3xl p-5 space-y-3"><div className="flex justify-between gap-2"><h3 className="font-black"><Plus size={17} className="inline mr-2" />{editandoId ? 'Editar material' : 'Nuevo material'}</h3>{editandoId && <button type="button" onClick={cancelarEdicion} className="text-slate-400 hover:text-slate-700" aria-label="Cancelar edición"><X size={18} /></button>}</div><input maxLength={LIMITES.descripcion} className={input} value={item.nombre} onChange={e => setItem({ ...item, nombre: limpiarTexto(e.target.value, LIMITES.descripcion) })} placeholder="Nombre del material" /><div className="grid grid-cols-2 gap-2"><input maxLength="50" className={input} value={item.sku} onChange={e => setItem({ ...item, sku: limpiarTexto(e.target.value, 50) })} placeholder="Código" /><select className={input} value={item.unidad} onChange={e => setItem({ ...item, unidad: e.target.value })} aria-label="Unidad de medida">{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><input className={input} inputMode="decimal" value={item.minimo} onChange={e => setItem({ ...item, minimo: entradaNumerica(e.target.value) })} placeholder="Existencia mínima" /><input className={input} inputMode="decimal" value={item.costo} onChange={e => setItem({ ...item, costo: entradaNumerica(e.target.value) })} placeholder="Costo unitario" /></div><select className={input} value={item.proveedor_id} onChange={e => setItem({ ...item, proveedor_id: e.target.value })}><option value="">Sin proveedor</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select><button className="w-full bg-primario text-white p-3 rounded-xl font-bold"><Save size={16} className="inline mr-1" />{editandoId ? 'Guardar cambios' : 'Guardar material'}</button></form>
      <form onSubmit={guardarMov} className="bg-white border rounded-3xl p-5 space-y-3"><h3 className="font-black"><ArrowDownToLine size={17} className="inline mr-2" />Movimiento</h3><select className={input} value={mov.item_id} onChange={e => setMov({ ...mov, item_id: e.target.value })}><option value="">Selecciona material</option>{items.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.existencias} {i.unidad})</option>)}</select><select className={input} value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value })}><option value="entrada">Entrada o compra</option><option value="salida">Salida o uso en trabajo</option><option value="ajuste">Ajuste de inventario</option></select><input className={input} inputMode="decimal" value={mov.cantidad} onChange={e => setMov({ ...mov, cantidad: entradaNumerica(e.target.value) })} placeholder="Cantidad" /><input maxLength={LIMITES.nota} className={input} value={mov.nota} onChange={e => setMov({ ...mov, nota: limpiarTexto(e.target.value, LIMITES.nota) })} placeholder="Trabajo, factura o motivo" /><button className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold">Registrar movimiento</button></form>
      <form onSubmit={guardarProveedor} className="bg-white border rounded-3xl p-5 space-y-3"><h3 className="font-black"><Truck size={17} className="inline mr-2" />Nuevo proveedor</h3><input maxLength={LIMITES.proveedor} className={input} value={proveedor.nombre} onChange={e => setProveedor({ ...proveedor, nombre: limpiarTexto(e.target.value, LIMITES.proveedor) })} placeholder="Nombre o empresa" /><input maxLength={LIMITES.nombre} className={input} value={proveedor.contacto} onChange={e => setProveedor({ ...proveedor, contacto: limpiarTexto(e.target.value, LIMITES.nombre) })} placeholder="Contacto" /><input maxLength="12" inputMode="numeric" className={input} value={proveedor.telefono} onChange={e => setProveedor({ ...proveedor, telefono: telefonoMX(e.target.value) })} placeholder="Teléfono" /><button className="w-full bg-slate-100 p-3 rounded-xl font-bold">Guardar proveedor</button></form>
    </div>
    <div className="grid lg:grid-cols-2 gap-6"><section className="bg-white border rounded-3xl p-5"><h3 className="font-black mb-3">Existencias</h3>{items.length === 0 ? <p className="text-sm text-slate-400">Sin materiales registrados.</p> : items.map(i => <div key={i.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl mb-2"><div className="min-w-0"><p className="font-bold truncate">{i.nombre}</p><p className="text-xs text-slate-400">{i.sku || 'Sin código'} · Mínimo: {i.minimo} · {money(i.costo)}</p></div><div className="flex items-center gap-1 shrink-0"><p className={`font-black whitespace-nowrap ${cantidad(i.existencias) <= cantidad(i.minimo) ? 'text-amber-600' : 'text-emerald-600'}`}>{i.existencias} {i.unidad}</p><button onClick={() => editarItem(i)} aria-label={`Editar ${i.nombre}`} className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-primario hover:bg-primario-suave"><Pencil size={15} /></button><button onClick={() => eliminarItem(i)} aria-label={`Eliminar ${i.nombre}`} className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button></div></div>)}</section><section className="bg-white border rounded-3xl p-5"><h3 className="font-black mb-3">Últimos movimientos</h3>{movs.length === 0 ? <p className="text-sm text-slate-400">Sin movimientos registrados.</p> : movs.map(m => <div key={m.id} className="flex justify-between gap-3 p-3 bg-slate-50 rounded-xl mb-2"><p className="font-bold text-sm">{m.almacen_articulos?.nombre || 'Material'}<span className="block text-xs text-slate-400">{m.nota || m.tipo}</span></p><p className={m.tipo === 'salida' ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>{m.tipo === 'salida' ? '−' : '+'}{m.cantidad}</p></div>)}</section></div>
  </div>;
}
