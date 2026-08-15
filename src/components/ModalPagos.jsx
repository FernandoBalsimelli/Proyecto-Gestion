import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from './ui/UI.jsx';
import { abrirWhatsApp } from '../utils/exportar.js';
import {
  X, Plus, Trash2, Wallet, Calendar, CreditCard, StickyNote,
  CheckCircle2, MessageCircle, TrendingUp, Pencil,
} from 'lucide-react';
import {
  LIMITES, limpiarTexto, textoParaGuardar, entradaNumerica,
  bloquearTeclasNumericas, numeroSeguro, fechaLocalISO,
  esFechaValida, verificarPolitica,
} from '../utils/seguridad.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const formatoMX = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Depósito'];

export default function ModalPagos({ venta, telefonoCliente, onCerrar, onActualizado }) {
  const { negocioId, puede } = useNegocio();
  const { toast, confirmar } = useUI();

  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [metodo, setMetodo] = useState(venta?.metodo_pago || 'Efectivo');
  const [nota, setNota] = useState('');
  const [editPagoId, setEditPagoId] = useState(null);

  const total = num(venta?.monto);

  /* ─────────── Datos ─────────── */
  const cargar = useCallback(async () => {
    if (!venta?.id) return;
    setCargando(true);
    const { data, error } = await supabase
      .from('pagos').select('*')
      .eq('venta_id', venta.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast.error('No se pudieron cargar los abonos: ' + error.message);
    setPagos(data || []);
    setCargando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venta?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cerrar con Escape y bloquear el scroll de fondo
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onCerrar]);

  /* ─────────── Cálculos ─────────── */
  const cobrado = useMemo(() => pagos.reduce((a, p) => a + num(p.monto), 0), [pagos]);
  const saldo = Math.max(0, total - cobrado);
  const pct = total > 0 ? Math.min(100, (cobrado / total) * 100) : 0;
  const liquidado = saldo < 0.01;

  /* ─────────── Acciones ─────────── */
  const registrar = async (e) => {
    e?.preventDefault();
    if (guardando) return;

    const m = numeroSeguro(monto, { max: LIMITES.maxMonto });
    if (!(m > 0)) return toast.error('El monto debe ser mayor a cero.');
    if (!esFechaValida(fecha)) return toast.error('La fecha no es válida.');

    const saldoDisponible = saldo + num(pagos.find(p => p.id === editPagoId)?.monto);
    if (m > saldoDisponible + 0.01) {
      const ok = await confirmar({
        titulo: 'Monto mayor al saldo',
        mensaje: `El saldo pendiente es ${money(saldoDisponible)} y estás registrando ${money(m)}.\n\n¿Continuar de todas formas?`,
        okTexto: 'Sí, registrar',
      });
      if (!ok) return;
    }

    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    setGuardando(true);
    const datos = {
      monto: m,
      fecha,
      metodo,
      nota: textoParaGuardar(nota, LIMITES.nota) || null,
    };
    const { error } = editPagoId
      ? await supabase.from('pagos').update(datos).eq('id', editPagoId)
      : await (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          return supabase.from('pagos').insert([{
            negocio_id: negocioId, venta_id: venta.id, user_id: user?.id ?? null, ...datos,
          }]);
        })();
    setGuardando(false);

    if (error) return toast.error('No se pudo registrar: ' + error.message);
    setMonto(''); setNota(''); setMetodo(venta?.metodo_pago || 'Efectivo'); setFecha(fechaLocalISO()); setEditPagoId(null);
    toast.ok(editPagoId ? 'Abono actualizado.' : `Abono de ${money(m)} registrado.`);
    await cargar();
    onActualizado?.();
  };

  const editar = (p) => {
    setEditPagoId(p.id);
    setMonto(String(p.monto ?? ''));
    setFecha(p.fecha || fechaLocalISO());
    setMetodo(p.metodo || 'Efectivo');
    setNota(p.nota || '');
  };

  const cancelarEdicion = () => {
    setEditPagoId(null); setMonto(''); setFecha(fechaLocalISO());
    setMetodo(venta?.metodo_pago || 'Efectivo'); setNota('');
  };

  const eliminar = async (p) => {
    const ok = await confirmar({
      titulo: 'Eliminar abono',
      mensaje: `${money(p.monto)} del ${formatoMX(p.fecha)}`,
      okTexto: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('pagos').delete().eq('id', p.id);
    if (error) return toast.error('No se pudo eliminar: ' + error.message);
    toast.ok('Abono eliminado.');
    await cargar();
    onActualizado?.();
  };

  const enviarRecibo = () => {
    const lineas = pagos
      .slice().reverse().slice(0, 20)
      .map((p, i) => `${i + 1}. ${formatoMX(p.fecha)} — ${money(p.monto)} (${p.metodo})`)
      .join('\n');

    const msg =
      `Hola ${venta.cliente || ''} 👋\n\n` +
      `*Estado de cuenta*${venta.folio ? ` · Folio #${String(venta.folio).padStart(4, '0')}` : ''}\n\n` +
      `Total: ${money(total)}\n` +
      `Abonado: ${money(cobrado)}\n` +
      `*Saldo pendiente: ${money(saldo)}*\n\n` +
      (lineas ? `Abonos recibidos:\n${lineas}\n\n` : '') +
      (liquidado ? '✅ Cuenta liquidada. ¡Muchas gracias!' : 'Quedo atento a cualquier duda.');

    abrirWhatsApp(telefonoCliente, msg);
  };

  const input = 'w-full p-3 pl-9 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

  /* ─────────── Render ─────────── */
  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_.15s]"
      onClick={onCerrar} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-slate-50 w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col animate-[popIn_.2s]">

        {/* ── Encabezado ── */}
        <div className="p-5 sm:p-6 bg-white sm:rounded-t-3xl rounded-t-3xl border-b border-slate-200 shrink-0">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Control de pagos {venta.folio ? `· #${String(venta.folio).padStart(4, '0')}` : ''}
              </p>
              <h3 className="font-black text-slate-800 text-xl truncate">
                {venta.cliente || 'Público en General'}
              </h3>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-300 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { l: 'Total',   v: total,   c: 'text-slate-800' },
              { l: 'Abonado', v: cobrado, c: 'text-emerald-600' },
              { l: 'Saldo',   v: saldo,   c: saldo > 0 ? 'text-amber-600' : 'text-emerald-600' },
            ].map(x => (
              <div key={x.l} className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{x.l}</p>
                <p className={`font-black tabular-nums text-sm sm:text-base ${x.c}`}>{money(x.v)}</p>
              </div>
            ))}
          </div>

          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${liquidado ? 'bg-emerald-500' : 'bg-primario'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] font-black text-slate-400 uppercase">{pct.toFixed(0)}% cobrado</span>
            {liquidado && (
              <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                <CheckCircle2 size={12} /> Liquidado
              </span>
            )}
          </div>
        </div>

        {/* ── Cuerpo ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">

          {(!liquidado || editPagoId) && puede('registrar_pagos') && (
            <form onSubmit={registrar} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                  {editPagoId ? <Pencil size={16} /> : <Plus size={16} />} {editPagoId ? 'Editar abono' : 'Registrar abono'}
                </h4>
                <div className="flex gap-1.5">
                  {[[0.5, '50%'], [1, 'Liquidar']].map(([f, txt]) => (
                    <button key={txt} type="button"
                      onClick={() => setMonto((saldo * f).toFixed(2))}
                      className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-primario-suave text-primario-dark hover:bg-primario hover:text-white transition">
                      {txt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Monto</label>
                  <div className="relative mt-1">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    {/* type="text" + entradaNumerica: type="number" acepta
                        "1e9", "+" y "-", y eso llegaba tal cual a la base. */}
                    <input type="text" inputMode="decimal" value={monto}
                      onChange={(e) => setMonto(entradaNumerica(e.target.value, { maxEnteros: 8 }))}
                      onKeyDown={bloquearTeclasNumericas}
                      onFocus={(e) => e.target.select()}
                      placeholder="0.00" className={`${input} text-right font-black`} autoFocus />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Fecha</label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Método</label>
                <div className="relative mt-1">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                  <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={input}>
                    {METODOS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">
                  Nota <span className="text-slate-300">(opcional)</span>
                </label>
                <div className="relative mt-1">
                  <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input value={nota} maxLength={LIMITES.nota}
                    onChange={(e) => setNota(limpiarTexto(e.target.value, LIMITES.nota))}
                    placeholder="Ej. Anticipo para materiales" className={`${input} font-medium`} />
                </div>
              </div>

              <button type="submit" disabled={guardando}
                className="w-full bg-primario text-white p-3.5 rounded-2xl font-bold hover:bg-primario-dark transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus size={18} /> {guardando ? 'Guardando...' : editPagoId ? 'Actualizar abono' : 'Registrar abono'}
              </button>
              {editPagoId && (
                <button type="button" onClick={cancelarEdicion}
                  className="w-full p-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition">
                  Cancelar edición
                </button>
              )}
            </form>
          )}

          {liquidado && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 text-center">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
              <p className="font-black text-emerald-800">Cuenta liquidada</p>
              <p className="text-emerald-700 text-sm font-medium mt-1">
                Se cobró el total de {money(total)}.
              </p>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Historial de abonos ({pagos.length})
              </p>
              {pagos.length > 0 && (
                <button onClick={enviarRecibo}
                  className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  <MessageCircle size={12} /> Enviar estado
                </button>
              )}
            </div>

            {cargando ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse" />)}
              </div>
            ) : pagos.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
                <TrendingUp size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="font-bold text-slate-500 text-sm">Aún no hay abonos</p>
                <p className="text-slate-400 text-xs mt-1">Registra el primer anticipo arriba.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagos.map(p => (
                  <div key={p.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center gap-3 hover:shadow-sm transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl shrink-0">
                        <Wallet size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 tabular-nums">{money(p.monto)}</p>
                        <p className="text-[11px] font-bold text-slate-400 truncate">
                          {formatoMX(p.fecha)} · {p.metodo}{p.nota ? ` · ${p.nota}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                    {puede('registrar_pagos') && (
                      <button onClick={() => editar(p)} aria-label="Editar abono"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-primario hover:bg-primario-suave rounded-xl transition">
                        <Pencil size={16} />
                      </button>
                    )}
                    {puede('eliminar_registros') && (
                      /* Visible también en pantallas táctiles. */
                      <button onClick={() => eliminar(p)} aria-label="Eliminar abono"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition shrink-0">
                        <Trash2 size={16} />
                      </button>
                    )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200 sm:rounded-b-3xl shrink-0">
          <button onClick={onCerrar}
            className="w-full py-3 rounded-2xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
