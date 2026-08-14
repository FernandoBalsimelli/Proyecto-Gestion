import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import { calcularNomina } from '../utils/nominaCalculos.js';
import { generarReciboPDF } from '../utils/nominaPdf.js';
import {
  Users, Plus, Save, Trash2, FileDown, Clock, AlertTriangle,
  Briefcase, Shield, Pencil, UserPlus, CalendarDays, Calculator,
} from 'lucide-react';
import {
  LIMITES, limpiarTexto, textoParaGuardar, limpiarAlfanumerico,
  entradaNumerica, bloquearTeclasNumericas, numeroSeguro,
  fechaLocalISO, obtenerLunesLocal, sumarDiasLocal, esFechaValida,
  verificarPolitica,
} from '../utils/seguridad.js';

const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const formatoMX = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const etiquetaPeriodo = (tipo) => ({ semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[tipo] || 'Nómina');
const fechasEntre = (inicio, fin) => {
  if (!esFechaValida(inicio) || !esFechaValida(fin) || fin < inicio) return [];
  const fechas = [];
  for (let actual = inicio; actual <= fin; actual = sumarDiasLocal(actual, 1)) fechas.push(actual);
  return fechas;
};

const TIPOS_ASISTENCIA = [
  { id: 'trabajado',         label: 'Trabajado',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'falta',             label: 'Falta',       color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { id: 'falta_justificada', label: 'Falta just.', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'descanso',          label: 'Descanso',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { id: 'vacacion',          label: 'Vacación',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'incapacidad',       label: 'Incapacidad', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

const TABS = [
  { id: 'empleados',  label: 'Empleados',  icon: Users },
  { id: 'asistencia', label: 'Asistencia', icon: CalendarDays },
  { id: 'nomina',     label: 'Nómina',     icon: Calculator },
  { id: 'pagos',      label: 'Pagos',      icon: Save },
];

const inputCls = 'w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
export default function Nomina({ session }) {
  const { negocioId } = useNegocio();
  const { toast, confirmar } = useUI();

  const [tab, setTab] = useState('empleados');
  const [empleados, setEmpleados] = useState([]);
  const [config, setConfig] = useState({});

  const cargarEmpleados = useCallback(async () => {
    if (!negocioId) return;
    const { data, error } = await supabase.from('empleados').select('*')
      .eq('negocio_id', negocioId).eq('activo', true).order('nombre').limit(300);
    if (error) toast.error('No se pudieron cargar los empleados: ' + error.message);
    setEmpleados(data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  const cargarConfig = useCallback(async () => {
    if (!negocioId) return;
    const { data } = await supabase.from('configuracion')
      .select('nombre, direccion, telefono, logo')
      .eq('negocio_id', negocioId).maybeSingle();
    if (data) setConfig(data);
  }, [negocioId]);

  useEffect(() => { cargarEmpleados(); cargarConfig(); }, [cargarEmpleados, cargarConfig]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
          <Briefcase className="text-primario" /> Nómina y empleados
        </h2>
        <p className="text-slate-500 font-medium text-sm">
          {empleados.length} empleado(s) activo(s)
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wide transition ${
                on ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'empleados' && (
        <TabEmpleados negocioId={negocioId} empleados={empleados}
          onRecargar={cargarEmpleados} toast={toast} confirmar={confirmar} />
      )}
      {tab === 'asistencia' && (
        <TabAsistencia negocioId={negocioId} empleados={empleados} toast={toast} />
      )}
      {tab === 'nomina' && (
        <TabNomina negocioId={negocioId} empleados={empleados} config={config}
          toast={toast} confirmar={confirmar} session={session} />
      )}
      {tab === 'pagos' && (
        <TabPagos negocioId={negocioId} empleados={empleados} toast={toast} confirmar={confirmar} session={session} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: EMPLEADOS
   ══════════════════════════════════════════════════════════════ */
function TabEmpleados({ negocioId, empleados, onRecargar, toast, confirmar }) {
  const FORM_VACIO = {
    nombre: '', puesto: '', fecha_ingreso: fechaLocalISO(), salario_diario: '',
    tipo_jornada: 'completa', es_asegurado: false, nss: '', curp: '', rfc: '',
    infonavit_credito: false, infonavit_descuento: '', infonavit_tipo: 'porcentaje',
    dias_vacaciones: 12,
  };

  const [form, setForm] = useState(FORM_VACIO);
  const [editId, setEditId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;

    const nombre = textoParaGuardar(form.nombre, LIMITES.nombre);
    const salario = numeroSeguro(form.salario_diario, { max: 999999 });

    if (nombre.length < 3) return toast.error('El nombre debe tener al menos 3 caracteres.');
    if (salario <= 0) return toast.error('El salario diario debe ser mayor a cero.');
    if (!esFechaValida(form.fecha_ingreso)) return toast.error('La fecha de ingreso no es válida.');

    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    setGuardando(true);
    const payload = {
      nombre,
      puesto: textoParaGuardar(form.puesto, LIMITES.puesto) || null,
      fecha_ingreso: form.fecha_ingreso,
      salario_diario: salario,
      tipo_jornada: ['completa', 'media', 'por_hora'].includes(form.tipo_jornada) ? form.tipo_jornada : 'completa',
      es_asegurado: !!form.es_asegurado,
      nss: form.nss ? form.nss.slice(0, LIMITES.nss) : null,
      curp: limpiarAlfanumerico(form.curp, LIMITES.curp) || null,
      rfc: limpiarAlfanumerico(form.rfc, LIMITES.rfc) || null,
      infonavit_credito: !!form.infonavit_credito,
      infonavit_descuento: numeroSeguro(form.infonavit_descuento, { max: 999999 }),
      infonavit_tipo: ['porcentaje', 'fijo', 'vsm'].includes(form.infonavit_tipo) ? form.infonavit_tipo : 'porcentaje',
      dias_vacaciones: Math.min(60, Math.max(6, Math.round(num(form.dias_vacaciones)) || 12)),
    };

    const { error } = editId
      ? await supabase.from('empleados').update(payload).eq('id', editId)
      : await supabase.from('empleados').insert([{ negocio_id: negocioId, ...payload }]);

    setGuardando(false);
    if (error) return toast.error('No se pudo guardar: ' + error.message);

    toast.ok(editId ? 'Empleado actualizado.' : 'Empleado registrado.');
    setForm(FORM_VACIO);
    setEditId(null);
    setMostrarForm(false);
    onRecargar();
  };

  const editar = (emp) => {
    setEditId(emp.id);
    setForm({
      nombre: emp.nombre || '',
      puesto: emp.puesto || '',
      fecha_ingreso: emp.fecha_ingreso || fechaLocalISO(),
      salario_diario: String(emp.salario_diario ?? ''),
      tipo_jornada: emp.tipo_jornada || 'completa',
      es_asegurado: !!emp.es_asegurado,
      nss: emp.nss || '',
      curp: emp.curp || '',
      rfc: emp.rfc || '',
      infonavit_credito: !!emp.infonavit_credito,
      infonavit_descuento: String(emp.infonavit_descuento ?? ''),
      infonavit_tipo: emp.infonavit_tipo || 'porcentaje',
      dias_vacaciones: emp.dias_vacaciones || 12,
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminar = async (emp) => {
    const ok = await confirmar({
      titulo: 'Dar de baja',
      mensaje: `"${emp.nombre}" se marcará como inactivo. Sus recibos y asistencias se conservan.`,
      okTexto: 'Dar de baja', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('empleados').update({ activo: false }).eq('id', emp.id);
    if (error) return toast.error('No se pudo dar de baja: ' + error.message);
    toast.ok('Empleado dado de baja.');
    onRecargar();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => { setMostrarForm(!mostrarForm); setEditId(null); setForm(FORM_VACIO); }}
          className={`px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase flex items-center gap-2 transition ${
            mostrarForm ? 'bg-slate-200 text-slate-600' : 'bg-primario text-white shadow-lg'}`}>
          <UserPlus size={14} /> {mostrarForm ? 'Cerrar' : 'Nuevo empleado'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={guardar} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
            {editId ? <Pencil size={16} /> : <Plus size={16} />}
            {editId ? 'Editar empleado' : 'Nuevo empleado'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre completo *</label>
              <input value={form.nombre} maxLength={LIMITES.nombre}
                onChange={(e) => setForm({ ...form, nombre: limpiarTexto(e.target.value, LIMITES.nombre) })}
                className={inputCls} placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Puesto</label>
              <input value={form.puesto} maxLength={LIMITES.puesto}
                onChange={(e) => setForm({ ...form, puesto: limpiarTexto(e.target.value, LIMITES.puesto) })}
                className={inputCls} placeholder="Electricista" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha de ingreso</label>
              <input type="date" value={form.fecha_ingreso}
                onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
                className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Salario diario *</label>
              <input type="text" inputMode="decimal" value={form.salario_diario}
                onChange={(e) => setForm({ ...form, salario_diario: entradaNumerica(e.target.value, { maxEnteros: 6 }) })}
                onKeyDown={bloquearTeclasNumericas}
                className={inputCls} placeholder="500.00" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de jornada</label>
              <select value={form.tipo_jornada}
                onChange={(e) => setForm({ ...form, tipo_jornada: e.target.value })}
                className={inputCls}>
                <option value="completa">Jornada completa</option>
                <option value="media">Media jornada</option>
                <option value="por_hora">Por hora</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Días de vacaciones al año</label>
              <input type="text" inputMode="numeric" value={form.dias_vacaciones}
                onChange={(e) => setForm({ ...form, dias_vacaciones: entradaNumerica(e.target.value, { decimales: false, maxEnteros: 2 }) })}
                onKeyDown={bloquearTeclasNumericas}
                className={inputCls} placeholder="12" />
            </div>
          </div>

          {/* Seguro social */}
          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input type="checkbox" checked={form.es_asegurado}
                onChange={(e) => setForm({ ...form, es_asegurado: e.target.checked })}
                className="w-5 h-5 rounded accent-[color:var(--color-primario)]" />
              <div>
                <span className="font-bold text-slate-700">Empleado asegurado (IMSS)</span>
                <p className="text-[11px] text-slate-400 font-medium">
                  Se calcularán cuotas IMSS e ISR automáticamente
                </p>
              </div>
            </label>

            {form.es_asegurado && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <div>
                  <label className="text-[10px] font-black text-blue-600 uppercase ml-1">NSS</label>
                  <input value={form.nss} maxLength={LIMITES.nss} inputMode="numeric"
                    onChange={(e) => setForm({ ...form, nss: e.target.value.replace(/\D/g, '').slice(0, LIMITES.nss) })}
                    className={inputCls} placeholder="12345678901" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-600 uppercase ml-1">CURP</label>
                  <input value={form.curp} maxLength={LIMITES.curp}
                    onChange={(e) => setForm({ ...form, curp: limpiarAlfanumerico(e.target.value, LIMITES.curp) })}
                    className={inputCls} placeholder="PEJU850101HCHRZN09" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-600 uppercase ml-1">RFC</label>
                  <input value={form.rfc} maxLength={LIMITES.rfc}
                    onChange={(e) => setForm({ ...form, rfc: limpiarAlfanumerico(e.target.value, LIMITES.rfc) })}
                    className={inputCls} placeholder="PEJU850101XX1" />
                </div>
              </div>
            )}
          </div>

          {/* Infonavit */}
          {form.es_asegurado && (
            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" checked={form.infonavit_credito}
                  onChange={(e) => setForm({ ...form, infonavit_credito: e.target.checked })}
                  className="w-5 h-5 rounded accent-[color:var(--color-primario)]" />
                <div>
                  <span className="font-bold text-slate-700">Tiene crédito Infonavit</span>
                  <p className="text-[11px] text-slate-400 font-medium">Se descontará de su nómina</p>
                </div>
              </label>

              {form.infonavit_credito && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <div>
                    <label className="text-[10px] font-black text-amber-700 uppercase ml-1">Tipo de descuento</label>
                    <select value={form.infonavit_tipo}
                      onChange={(e) => setForm({ ...form, infonavit_tipo: e.target.value })}
                      className={inputCls}>
                      <option value="porcentaje">% del salario</option>
                      <option value="fijo">Cuota fija ($)</option>
                      <option value="vsm">Veces salario mínimo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-amber-700 uppercase ml-1">Valor</label>
                    <input type="text" inputMode="decimal" value={form.infonavit_descuento}
                      onChange={(e) => setForm({ ...form, infonavit_descuento: entradaNumerica(e.target.value, { maxEnteros: 6 }) })}
                      onKeyDown={bloquearTeclasNumericas}
                      className={inputCls}
                      placeholder={form.infonavit_tipo === 'porcentaje' ? '20' : '1500'} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={guardando}
              className="flex-1 bg-primario text-white p-3.5 rounded-2xl font-bold hover:bg-primario-dark transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={16} /> {guardando ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar'}
            </button>
            <button type="button" onClick={() => { setMostrarForm(false); setEditId(null); setForm(FORM_VACIO); }}
              className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {empleados.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <Users size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="font-bold text-slate-500">No hay empleados registrados</p>
            <p className="text-slate-400 text-sm mt-1">Agrega tu primer empleado con el botón de arriba.</p>
          </div>
        ) : empleados.map(emp => (
          <div key={emp.id}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`p-3 rounded-2xl shrink-0 ${
                emp.es_asegurado ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                {emp.es_asegurado ? <Shield size={20} /> : <Users size={20} />}
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-slate-800 truncate">{emp.nombre}</h4>
                <p className="text-[11px] font-bold text-slate-400">
                  {emp.puesto || 'Sin puesto'} · {money(emp.salario_diario)}/día
                  {emp.es_asegurado && ' · IMSS'}
                  {emp.infonavit_credito && ' · Infonavit'}
                </p>
                <p className="text-[10px] text-slate-300 font-bold">
                  Ingreso: {formatoMX(emp.fecha_ingreso)}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => editar(emp)} aria-label="Editar empleado"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-primario hover:bg-primario-suave rounded-xl transition">
                <Pencil size={16} />
              </button>
              <button onClick={() => eliminar(emp)} aria-label="Dar de baja"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: ASISTENCIA
   ══════════════════════════════════════════════════════════════ */
function TabAsistencia({ negocioId, empleados, toast }) {
  // Siempre arranca en LUNES, calculado con fechas locales.
  const [semana, setSemana] = useState(() => fechaLocalISO(obtenerLunesLocal()));
  const [registros, setRegistros] = useState({});
  const [guardando, setGuardando] = useState(false);

  /* Antes el bucle iba de i = -1 a 5, así que la "semana del lunes"
     empezaba en el domingo anterior y el séptimo día nunca aparecía.
     Y usaba toISOString(), que convierte a UTC: en México eso resta un
     día según la hora. Ahora: 7 días exactos, todos en hora local. */
  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => sumarDiasLocal(semana, i)),
    [semana]
  );

  const cargar = useCallback(async () => {
    if (!negocioId || !dias.length) return;
    const { data, error } = await supabase.from('asistencia').select('*')
      .eq('negocio_id', negocioId)
      .gte('fecha', dias[0]).lte('fecha', dias[6])
      .limit(1000);
    if (error) toast.error('No se pudo cargar la asistencia: ' + error.message);

    const mapa = {};
    (data || []).forEach(r => { mapa[`${r.empleado_id}_${r.fecha}`] = r; });
    setRegistros(mapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, dias]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarSemana = (dir) => setSemana(s => sumarDiasLocal(s, dir * 7));

  const setTipo = (empId, fecha, tipo) => {
    const key = `${empId}_${fecha}`;
    setRegistros(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), empleado_id: empId, fecha, tipo, negocio_id: negocioId },
    }));
  };

  const setHoras = (empId, fecha, campo, valor) => {
    const key = `${empId}_${fecha}`;
    // Tope legal: 9 horas extra por semana antes de pasar a triple.
    const horas = Math.min(9, Math.max(0, num(valor)));
    setRegistros(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { tipo: 'trabajado' }),
        empleado_id: empId, fecha, [campo]: horas, negocio_id: negocioId,
      },
    }));
  };

  /**
   * Guardado en LOTE.
   * Antes se hacía un `await supabase.upsert()` por celda dentro de un for:
   * con 8 empleados × 7 días son 56 peticiones seguidas. Eso es provocarse
   * uno mismo el "too many requests". Ahora es un solo viaje.
   */
  const guardarTodo = async () => {
    if (guardando) return;

    const filas = Object.values(registros)
      .filter(r => r.empleado_id && r.fecha && r.tipo)
      .map(r => ({
        negocio_id: negocioId,
        empleado_id: r.empleado_id,
        fecha: r.fecha,
        tipo: r.tipo,
        horas_extra_doble: Math.min(9, Math.max(0, num(r.horas_extra_doble))),
        horas_extra_triple: Math.min(9, Math.max(0, num(r.horas_extra_triple))),
        nota: r.nota ? textoParaGuardar(r.nota, LIMITES.nota) : null,
      }));

    if (!filas.length) return toast.warn('No hay nada que guardar.');

    setGuardando(true);
    const { error } = await supabase.from('asistencia')
      .upsert(filas, { onConflict: 'empleado_id,fecha' });
    setGuardando(false);

    if (error) return toast.error('No se pudo guardar: ' + error.message);
    toast.ok(`Asistencia guardada (${filas.length} registro(s)).`);
    cargar();
  };

  const nombreDia = (fecha) =>
    new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
    });

  const esDomingo = (fecha) => new Date(`${fecha}T12:00:00`).getDay() === 0;

  return (
    <div className="space-y-4">
      {/* Navegador de semana */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <button onClick={() => cambiarSemana(-1)}
          className="px-4 min-h-[44px] bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200 transition">
          ← Anterior
        </button>
        <div className="text-center min-w-0">
          <p className="font-black text-slate-800 text-sm uppercase">
            {nombreDia(dias[0])} — {nombreDia(dias[6])}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1"><input type="date" value={semana}
            onChange={(e) => e.target.value && setSemana(fechaLocalISO(obtenerLunesLocal(new Date(`${e.target.value}T12:00:00`))))}
            aria-label="Elegir una semana" className="w-[132px] p-1 text-[10px] font-bold bg-slate-50 rounded-lg border border-slate-200" />
            <button onClick={() => setSemana(fechaLocalISO(obtenerLunesLocal()))}
              className="text-[10px] font-black uppercase text-primario hover:underline">Esta semana</button></div>
        </div>
        <button onClick={() => cambiarSemana(1)}
          className="px-4 min-h-[44px] bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200 transition">
          Siguiente →
        </button>
      </div>

      {empleados.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <CalendarDays size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="font-bold text-slate-500">Registra empleados primero</p>
        </div>
      ) : (
        <div className="space-y-4">
          {empleados.map(emp => (
            <div key={emp.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primario-suave text-primario p-2 rounded-xl shrink-0">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-slate-800 truncate">{emp.nombre}</h4>
                  <p className="text-[10px] font-bold text-slate-400">
                    {emp.puesto || 'Sin puesto'} · {money(emp.salario_diario)}/día
                  </p>
                </div>
              </div>

              <div className="grid grid-flow-col auto-cols-[minmax(148px,1fr)] overflow-x-auto pb-2 md:grid-flow-row md:grid-cols-4 lg:grid-cols-7 md:auto-cols-auto gap-2 snap-x">
                {dias.map(fecha => {
                  const key = `${emp.id}_${fecha}`;
                  const reg = registros[key] || {};
                  const tipo = reg.tipo || (esDomingo(fecha) ? 'descanso' : '');
                  const tipoInfo = TIPOS_ASISTENCIA.find(t => t.id === tipo);

                  return (
                    <div key={fecha}
                      className={`p-3 rounded-xl border snap-start ${
                        esDomingo(fecha) ? 'bg-slate-50 border-slate-200' : 'border-slate-100'}`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                        {nombreDia(fecha)}
                      </p>
                      <select value={tipo}
                        onChange={(e) => setTipo(emp.id, fecha, e.target.value)}
                        aria-label={`Asistencia de ${emp.nombre} el ${fecha}`}
                        className={`w-full p-1.5 rounded-lg text-[10px] font-black border outline-none ${
                          tipoInfo?.color || 'bg-white text-slate-500 border-slate-200'}`}>
                        <option value="">Sin marcar</option>
                        {TIPOS_ASISTENCIA.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>

                      {tipo === 'trabajado' && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-slate-400 shrink-0" />
                            <input type="text" inputMode="decimal"
                              value={reg.horas_extra_doble || ''}
                              onChange={(e) => setHoras(emp.id, fecha, 'horas_extra_doble',
                                entradaNumerica(e.target.value, { maxEnteros: 1 }))}
                              onKeyDown={bloquearTeclasNumericas}
                              placeholder="0" aria-label="Horas extra dobles"
                              className="w-full p-1 text-[10px] font-bold bg-slate-50 rounded border border-slate-100 outline-none" />
                            <span className="text-[8px] font-black text-slate-400 shrink-0">x2</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-amber-400 shrink-0" />
                            <input type="text" inputMode="decimal"
                              value={reg.horas_extra_triple || ''}
                              onChange={(e) => setHoras(emp.id, fecha, 'horas_extra_triple',
                                entradaNumerica(e.target.value, { maxEnteros: 1 }))}
                              onKeyDown={bloquearTeclasNumericas}
                              placeholder="0" aria-label="Horas extra triples"
                              className="w-full p-1 text-[10px] font-bold bg-slate-50 rounded border border-slate-100 outline-none" />
                            <span className="text-[8px] font-black text-amber-500 shrink-0">x3</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumen de la semana */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {(() => {
                  let trab = 0, faltas = 0, hd = 0, ht = 0;
                  dias.forEach(f => {
                    const r = registros[`${emp.id}_${f}`];
                    if (r?.tipo === 'trabajado') {
                      trab++; hd += num(r.horas_extra_doble); ht += num(r.horas_extra_triple);
                    }
                    if (r?.tipo === 'falta') faltas++;
                  });
                  return (
                    <>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        {trab} trabajados
                      </span>
                      {faltas > 0 && (
                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                          {faltas} falta(s)
                        </span>
                      )}
                      {hd > 0 && (
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                          {hd}h extra x2
                        </span>
                      )}
                      {ht > 0 && (
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                          {ht}h extra x3
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {empleados.length > 0 && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-200 -mx-4 md:-mx-8 px-4 md:px-8 py-4 z-30">
          <button onClick={guardarTodo} disabled={guardando}
            className="w-full md:w-auto bg-primario text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-primario-dark transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={18} /> {guardando ? 'Guardando...' : 'Guardar asistencia'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: PAGOS A EMPLEADOS
   Cada pago se guarda en empleado_pagos. La migración crea el gasto de
   categoría Nómina en la misma operación desde Postgres, no desde la UI.
   ══════════════════════════════════════════════════════════════ */
function TabPagos({ negocioId, empleados, toast, confirmar, session }) {
  const [pagos, setPagos] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [periodoId, setPeriodoId] = useState('');
  const [recibosPeriodo, setRecibosPeriodo] = useState([]);
  const [asistenciasPeriodo, setAsistenciasPeriodo] = useState([]);
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false);
  const [pagandoNominaId, setPagandoNominaId] = useState(null);
  const [detalleEmpleadoId, setDetalleEmpleadoId] = useState(null);
  const [pagoEditando, setPagoEditando] = useState(null);
  const [editForm, setEditForm] = useState({ monto: '', fecha_inicio: '', fecha_fin: '', nota: '' });
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    empleado_id: '', tipo: 'anticipo', fecha_inicio: fechaLocalISO(),
    fecha_fin: fechaLocalISO(), monto: '', nota: '',
  });

  const cargar = useCallback(async () => {
    if (!negocioId) return;
    const [p, per] = await Promise.all([
      supabase.from('empleado_pagos').select('*')
        .eq('negocio_id', negocioId).order('fecha_inicio', { ascending: false }).limit(1000),
      supabase.from('nomina_periodos').select('id, fecha_inicio, fecha_fin, tipo, created_at')
        .eq('negocio_id', negocioId).order('fecha_inicio', { ascending: false }).limit(200),
    ]);
    if (p.error) return toast.error('No se pudieron cargar los pagos: ' + p.error.message);
    if (per.error) return toast.error('No se pudieron cargar los periodos: ' + per.error.message);
    setPagos(p.data || []);
    setPeriodos(per.data || []);
    setPeriodoId(actual => actual || per.data?.[0]?.id || '');
  }, [negocioId, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarRecibosPeriodo = useCallback(async () => {
    if (!periodoId) { setRecibosPeriodo([]); setAsistenciasPeriodo([]); return; }
    const periodo = periodos.find(p => String(p.id) === String(periodoId));
    if (!periodo) return;
    setCargandoPeriodo(true);
    const [r, a] = await Promise.all([
      supabase.from('nomina_recibos').select('*').eq('periodo_id', periodoId).limit(500),
      supabase.from('asistencia').select('empleado_id, fecha, tipo')
        .eq('negocio_id', negocioId).gte('fecha', periodo.fecha_inicio).lte('fecha', periodo.fecha_fin).limit(5000),
    ]);
    setCargandoPeriodo(false);
    if (r.error) return toast.error('No se pudo cargar el cálculo de nómina: ' + r.error.message);
    if (a.error) return toast.error('No se pudo cargar la asistencia: ' + a.error.message);
    setRecibosPeriodo(r.data || []);
    setAsistenciasPeriodo(a.data || []);
  }, [periodoId, periodos, negocioId, toast]);

  useEffect(() => { cargarRecibosPeriodo(); }, [cargarRecibosPeriodo]);

  const dias = useMemo(() => {
    if (!esFechaValida(form.fecha_inicio) || !esFechaValida(form.fecha_fin) || form.fecha_fin < form.fecha_inicio) return 0;
    return Math.round((new Date(`${form.fecha_fin}T12:00:00`) - new Date(`${form.fecha_inicio}T12:00:00`)) / 86400000) + 1;
  }, [form.fecha_inicio, form.fecha_fin]);

  const nombre = (id) => empleados.find(e => String(e.id) === String(id))?.nombre || 'Empleado';
  const resumen = useMemo(() => empleados.map(e => {
    const propios = pagos.filter(p => String(p.empleado_id) === String(e.id));
    return { empleado: e, pagos: propios.length, dias: propios.reduce((a, p) => a + num(p.dias_pagados), 0), monto: propios.reduce((a, p) => a + num(p.monto), 0) };
  }), [empleados, pagos]);

  const periodoSeleccionado = periodos.find(p => String(p.id) === String(periodoId));
  // Un adelanto manual también cuenta para el periodo cuando su rango de
  // fechas coincide. Así no se vuelve a pagar ese día ni ese importe.
  const pagosDelPeriodo = useMemo(() => pagos.filter(p => {
    if (String(p.periodo_id || '') === String(periodoId || '')) return true;
    if (!periodoSeleccionado || p.periodo_id) return false;
    return p.fecha_inicio <= periodoSeleccionado.fecha_fin && p.fecha_fin >= periodoSeleccionado.fecha_inicio;
  }), [pagos, periodoId, periodoSeleccionado]);
  const pendientesNomina = useMemo(() => recibosPeriodo.map(r => {
    const previos = pagosDelPeriodo.filter(p => String(p.empleado_id) === String(r.empleado_id));
    const registros = asistenciasPeriodo.filter(a => String(a.empleado_id) === String(r.empleado_id));
    const fechasTrabajadas = [...new Set(registros.filter(a => a.tipo === 'trabajado').map(a => a.fecha))].sort();
    const incidencias = registros.filter(a => a.tipo !== 'trabajado').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const fechasConRegistro = new Set(registros.map(a => a.fecha));
    const fechasSinCaptura = (periodoSeleccionado ? fechasEntre(periodoSeleccionado.fecha_inicio, periodoSeleccionado.fecha_fin) : [])
      .filter(f => !fechasConRegistro.has(f));

    // Los pagos nuevos guardan fechas exactas. Para pagos creados antes de
    // esta mejora solo existe un contador; se señala como estimación para no
    // presentar una fecha inventada como si fuera un dato comprobado.
    const fechasPagadasExactas = new Set(previos.flatMap(p => Array.isArray(p.fechas_cubiertas) ? p.fechas_cubiertas : []));
    const sinDetalle = previos.filter(p => !Array.isArray(p.fechas_cubiertas) || p.fechas_cubiertas.length === 0);
    const porAsignarDeLegado = sinDetalle.reduce((a, p) => a + num(p.dias_pagados), 0);
    const aunSinCubrir = fechasTrabajadas.filter(f => !fechasPagadasExactas.has(f));
    const fechasEstimadasPagadas = aunSinCubrir.slice(0, Math.min(aunSinCubrir.length, porAsignarDeLegado));
    const fechasPendientes = aunSinCubrir.slice(fechasEstimadasPagadas.length);
    const diasPagados = fechasTrabajadas.length - fechasPendientes.length;
    const montoPagado = previos.reduce((a, p) => a + num(p.monto), 0);
    const diasTrabajados = fechasTrabajadas.length;
    return {
      recibo: r,
      empleado: empleados.find(e => String(e.id) === String(r.empleado_id)),
      diasTrabajados,
      diasPagados,
      diasPendientes: fechasPendientes.length,
      montoPagado,
      montoPendiente: Math.max(0, num(r.neto_pagar) - montoPagado),
      fechasTrabajadas,
      fechasPagadas: fechasTrabajadas.filter(f => fechasPagadasExactas.has(f)),
      fechasEstimadasPagadas,
      fechasPendientes,
      incidencias,
      fechasSinCaptura,
      pagosSinDetalle: sinDetalle.length,
    };
  }), [recibosPeriodo, pagosDelPeriodo, empleados, asistenciasPeriodo, periodoSeleccionado]);

  const guardar = async (e) => {
    e.preventDefault();
    const monto = numeroSeguro(form.monto, { max: LIMITES.maxMonto });
    if (!form.empleado_id) return toast.error('Selecciona un empleado.');
    if (!dias) return toast.error('El rango de días no es válido.');
    if (!(monto > 0)) return toast.error('Escribe un monto mayor a cero.');
    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    setGuardando(true);
    const { error } = await supabase.from('empleado_pagos').insert([{
      negocio_id: negocioId, empleado_id: form.empleado_id, user_id: session.user.id,
      tipo: ['anticipo', 'nomina', 'ajuste'].includes(form.tipo) ? form.tipo : 'anticipo',
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin, dias_pagados: dias,
      fechas_cubiertas: fechasEntre(form.fecha_inicio, form.fecha_fin),
      monto, nota: textoParaGuardar(form.nota, LIMITES.nota) || null,
    }]);
    setGuardando(false);
    if (error) return toast.error('No se pudo registrar el pago: ' + error.message);
    toast.ok('Pago registrado y egreso de nómina creado automáticamente.');
    setForm({ empleado_id: '', tipo: 'anticipo', fecha_inicio: fechaLocalISO(), fecha_fin: fechaLocalISO(), monto: '', nota: '' });
    cargar();
  };

  const pagarNomina = async (item) => {
    if (!periodoSeleccionado || pagandoNominaId) return;
    if (!item.empleado) return toast.error('No se encontró el empleado de este recibo.');
    if (!(item.diasPendientes > 0)) return toast.warn('Este empleado no tiene días pendientes por cubrir en el periodo.');
    if (!(item.montoPendiente > 0)) return toast.warn('No hay importe pendiente para este empleado.');

    const ok = await confirmar({
      titulo: 'Confirmar pago de nómina',
      mensaje: `${item.empleado.nombre}\n\nPeriodo: ${formatoMX(periodoSeleccionado.fecha_inicio)} al ${formatoMX(periodoSeleccionado.fecha_fin)}\nDías a cubrir: ${item.diasPendientes}\nImporte: ${money(item.montoPendiente)}\n\nSe creará también el gasto de nómina automáticamente.`,
      okTexto: 'Pagar y registrar',
    });
    if (!ok) return;

    setPagandoNominaId(item.recibo.id);
    const { error } = await supabase.from('empleado_pagos').insert([{
      negocio_id: negocioId, empleado_id: item.empleado.id, user_id: session.user.id,
      periodo_id: periodoSeleccionado.id, tipo: 'nomina',
      fecha_inicio: periodoSeleccionado.fecha_inicio, fecha_fin: periodoSeleccionado.fecha_fin,
      dias_pagados: item.diasPendientes, monto: item.montoPendiente,
      fechas_cubiertas: item.fechasPendientes,
      nota: `Pago automático de nómina · ${periodoSeleccionado.tipo || 'periodo'}`,
    }]);
    setPagandoNominaId(null);
    if (error) {
      if (error.code === '23505') return toast.warn('Este empleado ya tiene un pago registrado para este periodo.');
      return toast.error('No se pudo registrar el pago: ' + error.message);
    }
    toast.ok('Pago registrado, días marcados como cubiertos y gasto creado.');
    cargar();
  };

  const abrirEdicionPago = (pago) => {
    setPagoEditando(pago);
    setEditForm({
      monto: String(pago.monto ?? ''),
      fecha_inicio: pago.fecha_inicio || fechaLocalISO(),
      fecha_fin: pago.fecha_fin || fechaLocalISO(),
      nota: pago.nota || '',
    });
  };

  const guardarEdicionPago = async (e) => {
    e.preventDefault();
    if (!pagoEditando || guardando) return;
    const monto = numeroSeguro(editForm.monto, { max: LIMITES.maxMonto });
    if (!(monto > 0)) return toast.error('El monto debe ser mayor a cero.');
    if (!esFechaValida(editForm.fecha_inicio) || !esFechaValida(editForm.fecha_fin) || editForm.fecha_fin < editForm.fecha_inicio) {
      return toast.error('El rango de fechas no es válido.');
    }
    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);
    setGuardando(true);
    const datos = {
      monto, nota: textoParaGuardar(editForm.nota, LIMITES.nota) || null,
      ...(pagoEditando.periodo_id ? {} : {
        fecha_inicio: editForm.fecha_inicio,
        fecha_fin: editForm.fecha_fin,
        fechas_cubiertas: fechasEntre(editForm.fecha_inicio, editForm.fecha_fin),
      }),
    };
    const { error } = await supabase.from('empleado_pagos').update(datos).eq('id', pagoEditando.id);
    setGuardando(false);
    if (error) return toast.error('No se pudo actualizar el pago: ' + error.message);
    toast.ok('Pago y gasto de nómina actualizados.');
    setPagoEditando(null);
    cargar();
  };

  const eliminarPago = async (pago) => {
    const ok = await confirmar({
      titulo: 'Eliminar pago de empleado',
      mensaje: `${nombre(pago.empleado_id)} · ${money(pago.monto)}\n\nTambién se eliminará el gasto de nómina asociado y se recalculará la utilidad.`,
      okTexto: 'Eliminar pago', peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('empleado_pagos').delete().eq('id', pago.id);
    if (error) return toast.error('No se pudo eliminar el pago: ' + error.message);
    toast.ok('Pago y gasto asociado eliminados.');
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="font-black flex items-center gap-2"><Calculator size={18} /> Pagar nómina calculada</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">Selecciona un periodo guardado: usa las asistencias y el cálculo exacto de nómina, sin capturar días ni montos a mano.</p>
          </div>
          <select value={periodoId} onChange={e => setPeriodoId(e.target.value)}
            className="w-full md:w-auto p-3 rounded-xl bg-white text-slate-700 font-bold outline-none">
            <option value="">Selecciona un periodo</option>
            {periodos.map(p => <option key={p.id} value={p.id}>
              {formatoMX(p.fecha_inicio)} al {formatoMX(p.fecha_fin)} · {etiquetaPeriodo(p.tipo)}
            </option>)}
          </select>
        </div>

        {!periodos.length ? (
          <p className="text-sm text-slate-300 bg-white/10 p-4 rounded-2xl">Primero calcula y guarda la nómina en la pestaña “Nómina”. Después aparecerá aquí lista para pagar.</p>
        ) : cargandoPeriodo ? (
          <p className="text-sm text-slate-300">Cargando cálculo del periodo…</p>
        ) : !recibosPeriodo.length ? (
          <p className="text-sm text-amber-300 bg-amber-500/10 p-4 rounded-2xl">Este periodo no tiene recibos de nómina. Vuelve a calcularlo antes de pagar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendientesNomina.map(item => {
              const sinDias = item.diasTrabajados <= 0;
              const cubierto = !sinDias && item.diasPendientes <= 0;
              const verDetalle = detalleEmpleadoId === item.recibo.id;
              return <div key={item.recibo.id} className="bg-white/10 border border-white/10 p-4 rounded-2xl">
                <p className="font-black truncate">{item.empleado?.nombre || 'Empleado eliminado'}</p>
                <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Asistencia calculada: {item.diasTrabajados} día(s)</p>
                <p className="text-xs text-slate-300 mt-1">Cubiertos: {item.diasPagados} · Pendientes: {item.diasPendientes}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Cálculo de nómina: {money(item.recibo.neto_pagar)}</p>
                <p className="text-lg font-black text-emerald-300">Pendiente por pagar: {money(item.montoPendiente)}</p>
                <button type="button" onClick={() => setDetalleEmpleadoId(verDetalle ? null : item.recibo.id)}
                  className="mt-2 text-[10px] font-black uppercase text-blue-300 hover:text-white underline">
                  {verDetalle ? 'Ocultar desglose' : 'Ver fechas y motivos'}
                </button>
                {verDetalle && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-[10px] font-bold">
                    <p className="text-emerald-200">Trabajados: {item.fechasTrabajadas.map(formatoMX).join(', ') || 'Ninguno'}</p>
                    {item.fechasPagadas.length > 0 && <p className="text-blue-200">Pagados: {item.fechasPagadas.map(formatoMX).join(', ')}</p>}
                    {item.fechasEstimadasPagadas.length > 0 && <p className="text-amber-200">Pagados estimados: {item.fechasEstimadasPagadas.map(formatoMX).join(', ')} · pago anterior sin detalle de fechas.</p>}
                    {item.fechasPendientes.length > 0 && <p className="text-rose-200">Pendientes por pagar: {item.fechasPendientes.map(formatoMX).join(', ')}</p>}
                    {item.incidencias.length > 0 && <p className="text-amber-200">Incidencias: {item.incidencias.map(a => `${formatoMX(a.fecha)} (${a.tipo.replace('_', ' ')})`).join(', ')}</p>}
                    {item.fechasSinCaptura.length > 0 && <p className="text-slate-300">Sin asistencia capturada: {item.fechasSinCaptura.map(formatoMX).join(', ')}</p>}
                  </div>
                )}
                {sinDias ? <p className="text-xs font-bold text-amber-300 mt-2">Sin días trabajados: no hay pago por registrar.</p>
                  : cubierto ? <p className="text-xs font-bold text-emerald-300 mt-2">Periodo ya cubierto.</p>
                  : <button onClick={() => pagarNomina(item)} disabled={!!pagandoNominaId || !item.empleado}
                    className="mt-3 w-full py-2.5 rounded-xl bg-primario text-white text-xs font-black uppercase hover:bg-primario-dark disabled:opacity-50">
                    {pagandoNominaId === item.recibo.id ? 'Registrando...' : 'Pagar automáticamente'}
                  </button>}
              </div>;
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <Save size={18} /> Registrar pago o adelanto
        </h3>
        <p className="text-xs font-medium text-slate-500 mb-4">El importe se registra como gasto de nómina automáticamente y reduce la utilidad del periodo.</p>
        <form onSubmit={guardar} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <select value={form.empleado_id} onChange={e => setForm(p => ({ ...p, empleado_id: e.target.value }))} className={inputCls}>
            <option value="">Selecciona empleado</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} · {money(e.salario_diario)}/día</option>)}
          </select>
          <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className={inputCls}>
            <option value="anticipo">Adelanto</option>
            <option value="nomina">Pago de nómina</option>
            <option value="ajuste">Ajuste / otro pago</option>
          </select>
          <input type="text" inputMode="decimal" placeholder="Monto pagado" value={form.monto}
            onChange={e => setForm(p => ({ ...p, monto: entradaNumerica(e.target.value, { maxEnteros: 8 }) }))}
            onKeyDown={bloquearTeclasNumericas} className={inputCls} />
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Primer día cubierto</label>
            <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className={inputCls} /></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Último día cubierto</label>
            <input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} className={inputCls} /></div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Días a registrar</label>
            <div className="p-3 bg-slate-100 rounded-xl font-black text-slate-700">{dias || 0} día(s)</div></div>
          <input value={form.nota} maxLength={LIMITES.nota} onChange={e => setForm(p => ({ ...p, nota: limpiarTexto(e.target.value, LIMITES.nota) }))}
            placeholder="Nota opcional" className={`${inputCls} md:col-span-2`} />
          <button type="submit" disabled={guardando} className="bg-primario text-white rounded-xl font-bold min-h-[48px] hover:bg-primario-dark disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar pago'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {resumen.map(r => (
          <div key={r.empleado.id} className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="font-black text-slate-800 truncate">{r.empleado.nombre}</p>
            <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Días ya pagados: {r.dias}</p>
            <p className="text-lg font-black text-primario">{money(r.monto)}</p>
            <p className="text-[10px] font-bold text-slate-400">{r.pagos} movimiento(s) registrado(s)</p>
          </div>
        ))}
      </div>

      {pagoEditando && (
        <form onSubmit={guardarEdicionPago} className="bg-amber-50 p-5 rounded-3xl border border-amber-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-amber-900 flex items-center gap-2"><Pencil size={17} /> Editar pago de {nombre(pagoEditando.empleado_id)}</h3>
              <p className="text-[11px] font-bold text-amber-700 mt-1">Al guardar, se actualiza automáticamente el gasto de nómina asociado.</p>
            </div>
            <button type="button" onClick={() => setPagoEditando(null)} className="text-[11px] font-black uppercase text-amber-800 hover:underline">Cancelar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-[10px] font-black text-amber-700 uppercase ml-1">Monto</label>
              <input type="text" inputMode="decimal" value={editForm.monto}
                onChange={e => setEditForm(p => ({ ...p, monto: entradaNumerica(e.target.value, { maxEnteros: 8 }) }))}
                onKeyDown={bloquearTeclasNumericas} className={inputCls} /></div>
            <div><label className="text-[10px] font-black text-amber-700 uppercase ml-1">Inicio</label>
              <input type="date" disabled={!!pagoEditando.periodo_id} value={editForm.fecha_inicio} onChange={e => setEditForm(p => ({ ...p, fecha_inicio: e.target.value }))} className={`${inputCls} disabled:opacity-60`} /></div>
            <div><label className="text-[10px] font-black text-amber-700 uppercase ml-1">Fin</label>
              <input type="date" disabled={!!pagoEditando.periodo_id} value={editForm.fecha_fin} onChange={e => setEditForm(p => ({ ...p, fecha_fin: e.target.value }))} className={`${inputCls} disabled:opacity-60`} /></div>
          </div>
          <div><label className="text-[10px] font-black text-amber-700 uppercase ml-1">Nota</label>
            <input value={editForm.nota} maxLength={LIMITES.nota} onChange={e => setEditForm(p => ({ ...p, nota: limpiarTexto(e.target.value, LIMITES.nota) }))} className={inputCls} /></div>
          {Array.isArray(pagoEditando.fechas_cubiertas) && pagoEditando.fechas_cubiertas.length > 0 && (
            <p className="text-[11px] font-bold text-amber-700">Fechas cubiertas por este pago: {pagoEditando.fechas_cubiertas.map(formatoMX).join(', ')}. Para cambiar días cubiertos, elimina el pago y regístralo nuevamente desde el periodo.</p>
          )}
          {pagoEditando.periodo_id && <p className="text-[11px] font-bold text-amber-700">Es un pago automático de un periodo cerrado: se pueden corregir importe y nota; para cambiar sus días o fechas, elimínalo y vuelve a generarlo desde el periodo.</p>}
          <button type="submit" disabled={guardando} className="w-full bg-amber-700 text-white p-3 rounded-2xl font-bold hover:bg-amber-800 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar corrección'}
          </button>
        </form>
      )}

      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-700 mb-3">Historial de pagos</h3>
        {pagos.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">Aún no hay pagos registrados.</p> : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {pagos.map(p => <div key={p.id} className="flex justify-between gap-3 p-3 bg-slate-50 rounded-2xl">
              <div><p className="font-bold text-sm text-slate-800">{nombre(p.empleado_id)} · {p.tipo === 'anticipo' ? 'Adelanto' : p.tipo === 'nomina' ? 'Nómina' : 'Ajuste'}</p>
                <p className="text-[10px] font-bold text-slate-400">{formatoMX(p.fecha_inicio)} al {formatoMX(p.fecha_fin)} · {p.dias_pagados} día(s){p.nota ? ` · ${p.nota}` : ''}</p></div>
              <div className="flex items-center gap-1 shrink-0">
                <p className="font-black text-rose-600">−{money(p.monto)}</p>
                <button type="button" onClick={() => abrirEdicionPago(p)} title="Editar pago"
                  className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-primario hover:bg-primario-suave flex items-center justify-center">
                  <Pencil size={15} />
                </button>
                <button type="button" onClick={() => eliminarPago(p)} title="Eliminar pago"
                  className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAB: NÓMINA
   ══════════════════════════════════════════════════════════════ */
function TabNomina({ negocioId, empleados, config, toast, confirmar, session }) {
  const [tipoPeriodo, setTipoPeriodo] = useState('semanal');
  const [fechaInicio, setFechaInicio] = useState(() => fechaLocalISO(obtenerLunesLocal()));
  const [fechaFin, setFechaFin] = useState(() => sumarDiasLocal(fechaLocalISO(obtenerLunesLocal()), 6));

  const [recibos, setRecibos] = useState([]);
  const [bonos, setBonos] = useState({});
  const [otrasDed, setOtrasDed] = useState({});
  const [calculado, setCalculado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [periodoGuardadoId, setPeriodoGuardadoId] = useState(null);
  const [pagandoReciboId, setPagandoReciboId] = useState(null);

  const diasPeriodo = useMemo(() => {
    if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) return 7;
    const diff = (new Date(`${fechaFin}T12:00:00`) - new Date(`${fechaInicio}T12:00:00`)) / 86400000;
    return Math.max(1, Math.round(diff) + 1);
  }, [fechaInicio, fechaFin]);

  /* Preajuste de fechas según el tipo de periodo, siempre con hora local. */
  useEffect(() => {
    const hoy = new Date();

    if (tipoPeriodo === 'semanal') {
      const lunes = fechaLocalISO(obtenerLunesLocal());
      setFechaInicio(lunes);
      setFechaFin(sumarDiasLocal(lunes, 6));
    } else if (tipoPeriodo === 'quincenal') {
      const anio = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      if (hoy.getDate() <= 15) {
        setFechaInicio(`${anio}-${mes}-01`);
        setFechaFin(`${anio}-${mes}-15`);
      } else {
        const ultimo = new Date(anio, hoy.getMonth() + 1, 0).getDate();
        setFechaInicio(`${anio}-${mes}-16`);
        setFechaFin(`${anio}-${mes}-${String(ultimo).padStart(2, '0')}`);
      }
    } else {
      const anio = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const ultimo = new Date(anio, hoy.getMonth() + 1, 0).getDate();
      setFechaInicio(`${anio}-${mes}-01`);
      setFechaFin(`${anio}-${mes}-${String(ultimo).padStart(2, '0')}`);
    }

    setCalculado(false);
    setRecibos([]);
    setPeriodoGuardadoId(null);
  }, [tipoPeriodo]);

  const calcular = async () => {
    if (calculando) return;
    if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) return toast.error('Define fechas válidas.');
    if (fechaFin < fechaInicio) return toast.error('La fecha final no puede ser anterior a la inicial.');
    if (!empleados.length) return toast.error('No hay empleados registrados.');

    setCalculando(true);
    const { data: asist, error } = await supabase.from('asistencia').select('*')
      .eq('negocio_id', negocioId)
      .gte('fecha', fechaInicio).lte('fecha', fechaFin)
      .limit(5000);
    setCalculando(false);

    if (error) return toast.error('No se pudo leer la asistencia: ' + error.message);

    const porEmpleado = {};
    (asist || []).forEach(r => {
      (porEmpleado[r.empleado_id] ||= []).push(r);
    });

    const result = empleados.map(emp => {
      const regs = porEmpleado[emp.id] || [];
      const diasTrabajados   = regs.filter(r => r.tipo === 'trabajado').length;
      const diasFalta        = regs.filter(r => r.tipo === 'falta').length;
      const diasIncapacidad  = regs.filter(r => r.tipo === 'incapacidad').length;
      const horasExtraDoble  = regs.reduce((a, r) => a + num(r.horas_extra_doble), 0);
      const horasExtraTriple = regs.reduce((a, r) => a + num(r.horas_extra_triple), 0);

      const calculo = calcularNomina({
        salarioDiario: num(emp.salario_diario),
        diasTrabajados,
        diasFalta,
        horasExtraDoble,
        horasExtraTriple,
        bonos: numeroSeguro(bonos[emp.id]?.monto, { max: LIMITES.maxMonto }),
        esAsegurado: emp.es_asegurado,
        infonavitCredito: emp.infonavit_credito,
        infonavitTipo: emp.infonavit_tipo,
        infonavitDescuento: num(emp.infonavit_descuento),
        otrasDeducciones: numeroSeguro(otrasDed[emp.id]?.monto, { max: LIMITES.maxMonto }),
        diasPeriodo,
      });

      return {
        empleado: emp,
        ...calculo,
        fechasTrabajadas: [...new Set(regs.filter(r => r.tipo === 'trabajado').map(r => r.fecha))].sort(),
        diasIncapacidad,
        bonoDescripcion: textoParaGuardar(bonos[emp.id]?.desc || '', LIMITES.nota),
        otrasDeduccionesDesc: textoParaGuardar(otrasDed[emp.id]?.desc || '', LIMITES.nota),
      };
    });

    setRecibos(result);
    setPeriodoGuardadoId(null);
    setCalculado(true);
  };

  const guardarPeriodo = async () => {
    if (!recibos.length || guardando) return;

    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    setGuardando(true);

    // Un periodo duplicado produciría recibos y pagos duplicados. Se bloquea
    // antes de insertar, conservando el historial ya existente intacto.
    const { data: existente, error: existenteErr } = await supabase.from('nomina_periodos')
      .select('id').eq('negocio_id', negocioId)
      .eq('fecha_inicio', fechaInicio).eq('fecha_fin', fechaFin).maybeSingle();
    if (existenteErr) {
      setGuardando(false);
      return toast.error('No se pudo validar el periodo: ' + existenteErr.message);
    }
    if (existente) {
      setGuardando(false);
      setPeriodoGuardadoId(existente.id);
      toast.warn('Este periodo ya está guardado; puedes pagar un empleado desde este cálculo.');
      return existente.id;
    }

    const { data: per, error: perErr } = await supabase.from('nomina_periodos')
      .insert([{
        negocio_id: negocioId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo: tipoPeriodo,
      }])
      .select('id').single();

    if (perErr) {
      setGuardando(false);
      return toast.error('No se pudo crear el periodo: ' + perErr.message);
    }

    const payloads = recibos.map(r => ({
      negocio_id: negocioId,
      periodo_id: per.id,
      empleado_id: r.empleado.id,
      dias_trabajados: r.diasTrabajados,
      dias_falta: r.diasFalta,
      dias_incapacidad: r.diasIncapacidad,
      horas_extra_doble: r.horasExtraDoble,
      horas_extra_triple: r.horasExtraTriple,
      salario_base: r.salarioBase,
      pago_horas_extra: r.pagoHorasExtra,
      septimo_dia: r.septimoDia,
      bonos: r.bonos,
      bono_descripcion: r.bonoDescripcion || null,
      total_percepciones: r.totalPercepciones,
      deduccion_imss: r.deduccionIMSS,
      deduccion_isr: r.deduccionISR,
      deduccion_infonavit: r.deduccionInfonavit,
      otras_deducciones: r.otrasDeducciones,
      otras_deducciones_desc: r.otrasDeduccionesDesc || null,
      total_deducciones: r.totalDeducciones,
      neto_pagar: r.netoPagar,
    }));

    const { error } = await supabase.from('nomina_recibos').insert(payloads);
    setGuardando(false);

    if (error) {
      // Si fallan los recibos, el periodo huérfano solo estorba.
      await supabase.from('nomina_periodos').delete().eq('id', per.id);
      return toast.error('No se pudieron guardar los recibos: ' + error.message);
    }
    toast.ok('Nómina guardada correctamente.');
    setPeriodoGuardadoId(per.id);
    return per.id;
  };

  const imprimirRecibo = (recibo) => {
    generarReciboPDF({
      config: {
        nombre: config.nombre || '',
        direccion: config.direccion || '',
        telefono: config.telefono || '',
        logo: config.logo || null,
        rfc: '',
      },
      empleado: recibo.empleado,
      recibo: {
        dias_trabajados: recibo.diasTrabajados,
        dias_falta: recibo.diasFalta,
        horas_extra_doble: recibo.horasExtraDoble,
        horas_extra_triple: recibo.horasExtraTriple,
        salario_base: recibo.salarioBase,
        septimo_dia: recibo.septimoDia,
        pago_horas_extra: recibo.pagoHorasExtra,
        bonos: recibo.bonos,
        bono_descripcion: recibo.bonoDescripcion || 'Bonos',
        total_percepciones: recibo.totalPercepciones,
        deduccion_imss: recibo.deduccionIMSS,
        deduccion_isr: recibo.deduccionISR,
        deduccion_infonavit: recibo.deduccionInfonavit,
        otras_deducciones: recibo.otrasDeducciones,
        otras_deducciones_desc: recibo.otrasDeduccionesDesc,
        total_deducciones: recibo.totalDeducciones,
        neto_pagar: recibo.netoPagar,
      },
      periodo: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo: tipoPeriodo },
    });
  };

  /** Pago desde el cálculo: primero persiste el periodo para que recibo,
      pago y gasto queden enlazados; luego descuenta adelantos coincidentes. */
  const pagarDesdeCalculo = async (r) => {
    if (pagandoReciboId) return;
    if (!(r.diasTrabajados > 0) || !(r.netoPagar > 0)) {
      return toast.warn('Este empleado no tiene días trabajados o importe por pagar en este periodo.');
    }

    let periodoId = periodoGuardadoId;
    if (!periodoId) {
      const okGuardar = await confirmar({
        titulo: 'Guardar y pagar nómina',
        mensaje: 'Para pagar desde el cálculo primero se guardará el periodo completo de nómina. Después se registrará el pago de este empleado.',
        okTexto: 'Guardar y continuar',
      });
      if (!okGuardar) return;
      periodoId = await guardarPeriodo();
      if (!periodoId) return;
    }

    setPagandoReciboId(r.empleado.id);
    const { data: anteriores, error: consultaError } = await supabase.from('empleado_pagos').select('*')
      .eq('negocio_id', negocioId).eq('empleado_id', r.empleado.id).limit(500);
    if (consultaError) { setPagandoReciboId(null); return toast.error('No se pudieron validar pagos previos: ' + consultaError.message); }

    const aplicables = (anteriores || []).filter(p =>
      String(p.periodo_id || '') === String(periodoId)
      || (!p.periodo_id && p.fecha_inicio <= fechaFin && p.fecha_fin >= fechaInicio)
    );
    const fechasExactas = new Set(aplicables.flatMap(p => Array.isArray(p.fechas_cubiertas) ? p.fechas_cubiertas : []));
    const sinDetalle = aplicables.filter(p => !Array.isArray(p.fechas_cubiertas) || p.fechas_cubiertas.length === 0)
      .reduce((a, p) => a + num(p.dias_pagados), 0);
    const sinPagar = (r.fechasTrabajadas || []).filter(f => !fechasExactas.has(f)).slice(Math.max(0, sinDetalle));
    const yaPagado = aplicables.reduce((a, p) => a + num(p.monto), 0);
    const montoPendiente = Math.max(0, r.netoPagar - yaPagado);

    if (!sinPagar.length || !(montoPendiente > 0)) {
      setPagandoReciboId(null);
      return toast.warn('Este recibo ya está cubierto por un pago o adelanto registrado.');
    }
    const ok = await confirmar({
      titulo: 'Confirmar pago del empleado',
      mensaje: `${r.empleado.nombre}\n\nDías: ${sinPagar.map(formatoMX).join(', ')}\nImporte pendiente: ${money(montoPendiente)}\n\nSe actualizará automáticamente la utilidad como gasto de nómina.`,
      okTexto: 'Pagar empleado',
    });
    if (!ok) { setPagandoReciboId(null); return; }

    const { error } = await supabase.from('empleado_pagos').insert([{
      negocio_id: negocioId, empleado_id: r.empleado.id, user_id: session.user.id,
      periodo_id: periodoId, tipo: 'nomina', fecha_inicio: fechaInicio, fecha_fin: fechaFin,
      dias_pagados: sinPagar.length, fechas_cubiertas: sinPagar, monto: montoPendiente,
      nota: `Pago desde cálculo de nómina · ${tipoPeriodo}`,
    }]);
    setPagandoReciboId(null);
    if (error) {
      if (error.code === '23505') return toast.warn('Ya existe un pago automático para este empleado y periodo.');
      return toast.error('No se pudo registrar el pago: ' + error.message);
    }
    toast.ok('Pago del empleado y gasto de nómina registrados.');
  };

  const totalNomina = recibos.reduce((a, r) => a + r.netoPagar, 0);
  const seleccionarSemana = (valor) => {
    if (!valor) return;
    const lunes = fechaLocalISO(obtenerLunesLocal(new Date(`${valor}T12:00:00`)));
    setFechaInicio(lunes); setFechaFin(sumarDiasLocal(lunes, 6));
    setCalculado(false); setRecibos([]); setPeriodoGuardadoId(null);
  };

  return (
    <div className="space-y-6">
      {/* Configuración del periodo */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calculator size={18} /> Calcular nómina
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de periodo</label>
            <select value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value)} className={inputCls}>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha inicio</label>
            <input type="date" value={fechaInicio}
              onChange={(e) => tipoPeriodo === 'semanal' ? seleccionarSemana(e.target.value) : (setFechaInicio(e.target.value), setCalculado(false))}
              className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha fin</label>
            <input type="date" value={fechaFin} disabled={tipoPeriodo === 'semanal'}
              onChange={(e) => { setFechaFin(e.target.value); setCalculado(false); }}
              className={`${inputCls} disabled:opacity-60`} />
          </div>
          <div className="flex items-end">
            <button onClick={calcular} disabled={calculando}
              className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 disabled:opacity-50">
              <Calculator size={16} /> {calculando ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>

        {tipoPeriodo === 'semanal' && <p className="text-[11px] font-bold text-primario bg-primario-suave p-3 rounded-xl">Semana seleccionada: lunes a domingo. Cambia la fecha de inicio para elegir otra semana; la fecha final se ajusta automáticamente.</p>}

        <p className="text-[11px] font-bold text-slate-400">
          Periodo de {diasPeriodo} día(s): {formatoMX(fechaInicio)} al {formatoMX(fechaFin)}
        </p>

        {/* Bonos y deducciones extra */}
        {empleados.length > 0 && !calculado && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Bonos y deducciones extras (opcional)
            </p>
            <div className="space-y-2">
              {empleados.map(emp => (
                <div key={emp.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center bg-slate-50 p-3 rounded-2xl">
                  <span className="font-bold text-slate-700 text-sm truncate">{emp.nombre}</span>

                  <input type="text" inputMode="decimal" placeholder="Bono $"
                    value={bonos[emp.id]?.monto || ''}
                    onChange={(e) => setBonos(prev => ({
                      ...prev,
                      [emp.id]: { ...prev[emp.id], monto: entradaNumerica(e.target.value, { maxEnteros: 7 }) },
                    }))}
                    onKeyDown={bloquearTeclasNumericas}
                    className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-bold outline-none" />

                  <input placeholder="Concepto del bono" maxLength={LIMITES.nota}
                    value={bonos[emp.id]?.desc || ''}
                    onChange={(e) => setBonos(prev => ({
                      ...prev,
                      [emp.id]: { ...prev[emp.id], desc: limpiarTexto(e.target.value, LIMITES.nota) },
                    }))}
                    className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-medium outline-none" />

                  <input type="text" inputMode="decimal" placeholder="Deducción $"
                    value={otrasDed[emp.id]?.monto || ''}
                    onChange={(e) => setOtrasDed(prev => ({
                      ...prev,
                      [emp.id]: { ...prev[emp.id], monto: entradaNumerica(e.target.value, { maxEnteros: 7 }) },
                    }))}
                    onKeyDown={bloquearTeclasNumericas}
                    className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-bold outline-none" />

                  <input placeholder="Concepto de la deducción" maxLength={LIMITES.nota}
                    value={otrasDed[emp.id]?.desc || ''}
                    onChange={(e) => setOtrasDed(prev => ({
                      ...prev,
                      [emp.id]: { ...prev[emp.id], desc: limpiarTexto(e.target.value, LIMITES.nota) },
                    }))}
                    className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-medium outline-none" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resultados */}
      {calculado && recibos.length > 0 && (
        <>
          <div className="bg-slate-900 p-6 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Nómina total del periodo
              </p>
              <p className="text-3xl font-black tracking-tighter">{money(totalNomina)}</p>
              <p className="text-slate-400 text-xs font-bold mt-1">
                {recibos.length} empleado(s) · {formatoMX(fechaInicio)} al {formatoMX(fechaFin)}
              </p>
            </div>
            <button onClick={guardarPeriodo} disabled={guardando}
              className="bg-primario text-white px-6 py-3 rounded-2xl font-bold hover:bg-primario-dark transition flex items-center gap-2 disabled:opacity-50 shadow-lg">
              <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar nómina'}
            </button>
          </div>

          <div className="space-y-4">
            {recibos.map(r => {
              const emp = r.empleado;
              return (
                <div key={emp.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-2xl shrink-0 ${
                        emp.es_asegurado ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Users size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-800 truncate">{emp.nombre}</h4>
                        <p className="text-[10px] font-bold text-slate-400">
                          {emp.puesto || 'Sin puesto'} · {money(emp.salario_diario)}/día
                          {emp.es_asegurado && ' · IMSS'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Neto a pagar</p>
                        <p className="text-xl font-black text-primario tabular-nums">{money(r.netoPagar)}</p>
                      </div>
                      <button onClick={() => pagarDesdeCalculo(r)} disabled={!!pagandoReciboId || r.diasTrabajados <= 0 || r.netoPagar <= 0}
                        className="min-h-[48px] px-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase hover:bg-emerald-700 disabled:opacity-50 transition"
                        title="Guardar nómina y pagar a este empleado">
                        {pagandoReciboId === emp.id ? 'Pagando...' : 'Pagar'}
                      </button>
                      <button onClick={() => imprimirRecibo(r)}
                        className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition"
                        aria-label="Descargar recibo PDF" title="Descargar recibo PDF">
                        <FileDown size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase">Percepciones</p>
                      <p className="font-black text-emerald-800 tabular-nums">{money(r.totalPercepciones)}</p>
                      <div className="text-[10px] text-emerald-700 font-medium mt-1 space-y-0.5">
                        <p>Base: {money(r.salarioBase)} ({r.diasTrabajados}d)</p>
                        <p>7.º día: {money(r.septimoDia)}</p>
                        {r.pagoHorasExtra > 0 && <p>H. extra: {money(r.pagoHorasExtra)}</p>}
                        {r.bonos > 0 && <p>Bonos: {money(r.bonos)}</p>}
                      </div>
                    </div>

                    <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                      <p className="text-[9px] font-black text-rose-600 uppercase">Deducciones</p>
                      <p className="font-black text-rose-800 tabular-nums">{money(r.totalDeducciones)}</p>
                      <div className="text-[10px] text-rose-700 font-medium mt-1 space-y-0.5">
                        {r.deduccionIMSS > 0 && <p>IMSS: {money(r.deduccionIMSS)}</p>}
                        {r.deduccionISR > 0 && <p>ISR: {money(r.deduccionISR)}</p>}
                        {r.deduccionInfonavit > 0 && <p>Infonavit: {money(r.deduccionInfonavit)}</p>}
                        {r.otrasDeducciones > 0 && <p>Otras: {money(r.otrasDeducciones)}</p>}
                        {r.totalDeducciones === 0 && <p>Sin deducciones</p>}
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                      <p className="text-[9px] font-black text-blue-600 uppercase">Asistencia</p>
                      <div className="text-[10px] text-blue-700 font-bold mt-1 space-y-0.5">
                        <p>Trabajados: {r.diasTrabajados}</p>
                        {r.diasFalta > 0 && <p className="text-rose-600">Faltas: {r.diasFalta}</p>}
                        {r.diasIncapacidad > 0 && <p>Incapacidad: {r.diasIncapacidad}</p>}
                      </div>
                    </div>

                    <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase">Horas extra</p>
                      <div className="text-[10px] text-amber-700 font-bold mt-1 space-y-0.5">
                        {r.horasExtraDoble > 0 && <p>Dobles: {r.horasExtraDoble}h</p>}
                        {r.horasExtraTriple > 0 && <p>Triples: {r.horasExtraTriple}h</p>}
                        {r.horasExtraDoble === 0 && r.horasExtraTriple === 0 && <p>Sin horas extra</p>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {calculado && recibos.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-slate-200 mb-3" />
          <p className="font-bold text-slate-500">No hay empleados activos para calcular</p>
        </div>
      )}
    </div>
  );
}
