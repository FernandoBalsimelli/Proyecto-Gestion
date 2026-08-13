import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import { hoyLocal, formatoMX } from '../utils/fecha.js';
import { calcularNomina } from '../utils/nominaCalculos.js';
import { generarReciboPDF } from '../utils/nominaPdf.js';
import {
    Users, Plus, Save, Trash2, FileDown, Clock, AlertTriangle,
    Briefcase, Shield, Pencil, UserPlus, CalendarDays, Calculator,
} from 'lucide-react';
import { fechaLocalISO, obtenerLunesLocal, sumarDiasLocal } from '../utils/seguridad.js';
import { LIMITES, limpiarTexto, limpiarAlfanumerico, numeroSeguro } from '../utils/seguridad.js';


const obtenerLunes = () => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    const diferencia = (hoy.getDay() + 6) % 7;
    lunes.setDate(hoy.getDate() - diferencia);
    lunes.setHours(12, 0, 0, 0);
    return lunes;
};
const money = (n) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const num = (v) => Number(v) || 0;
const TIPOS_ASISTENCIA = [
    { id: 'trabajado', label: 'Trabajado', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'falta', label: 'Falta', color: 'bg-rose-100 text-rose-700' },
    { id: 'falta_justificada', label: 'Falta just.', color: 'bg-amber-100 text-amber-700' },
    { id: 'descanso', label: 'Descanso', color: 'bg-slate-100 text-slate-600' },
    { id: 'vacacion', label: 'Vacación', color: 'bg-blue-100 text-blue-700' },
    { id: 'incapacidad', label: 'Incapacidad', color: 'bg-purple-100 text-purple-700' },
];

const TABS = [
    { id: 'empleados', label: 'Empleados', icon: Users },
    { id: 'asistencia', label: 'Asistencia', icon: CalendarDays },
    { id: 'nomina', label: 'Nomina', icon: Calculator },
];

const inputCls = 'w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-primario/10 transition';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   COMPONENTE PRINCIPAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function Nomina({ session }) {


    const { negocioId, puede } = useNegocio();
    const { toast, confirmar } = useUI();

    const [tab, setTab] = useState('empleados');
    const [empleados, setEmpleados] = useState([]);
    const [config, setConfig] = useState({});

    const cargarEmpleados = async () => {
        if (!negocioId) return;
        const { data } = await supabase.from('empleados').select('*')
            .eq('negocio_id', negocioId).eq('activo', true).order('nombre');
        setEmpleados(data || []);
    };

    const cargarConfig = async () => {
        if (!negocioId) return;
        const { data } = await supabase.from('configuracion').select('*')
            .eq('negocio_id', negocioId).maybeSingle();
        if (data) setConfig(data);
    };

    useEffect(() => { cargarEmpleados(); cargarConfig(); }, [negocioId]);


    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <Briefcase className="text-primario" /> Nomina y Empleados
                </h2>
                <p className="text-slate-500 font-medium text-sm">
                    {empleados.length} empleado(s) activo(s)
                </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const on = tab === t.id;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wide transition ${on ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
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
        </div>
    );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TAB: EMPLEADOS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function TabEmpleados({ negocioId, empleados, onRecargar, toast, confirmar }) {
    const FORM_VACIO = {
        nombre: '', puesto: '', fecha_ingreso: hoyLocal(), salario_diario: '',
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
        if (!form.nombre.trim()) return toast.error('El nombre es obligatorio.');
        if (num(form.salario_diario) <= 0) return toast.error('El salario diario debe ser mayor a cero.');

        setGuardando(true);
        const payload = {
            nombre: form.nombre.trim(),
            puesto: form.puesto.trim() || null,
            fecha_ingreso: form.fecha_ingreso,
            salario_diario: num(form.salario_diario),
            tipo_jornada: form.tipo_jornada,
            es_asegurado: form.es_asegurado,
            nss: form.nss.trim() || null,
            curp: form.curp.trim().toUpperCase() || null,
            rfc: form.rfc.trim().toUpperCase() || null,
            infonavit_credito: form.infonavit_credito,
            infonavit_descuento: num(form.infonavit_descuento),
            infonavit_tipo: form.infonavit_tipo,
            dias_vacaciones: num(form.dias_vacaciones) || 12,
        };

        const { error } = editId
            ? await supabase.from('empleados').update(payload).eq('id', editId)
            : await supabase.from('empleados').insert([{ negocio_id: negocioId, ...payload }]);

        setGuardando(false);
        if (error) return toast.error(error.message);
        toast.ok(editId ? 'Empleado actualizado.' : 'Empleado registrado.');
        setForm(FORM_VACIO);
        setEditId(null);
        setMostrarForm(false);
        onRecargar();
    };

    const editar = (emp) => {
        setEditId(emp.id);
        setForm({
            nombre: emp.nombre,
            puesto: emp.puesto || '',
            fecha_ingreso: emp.fecha_ingreso,
            salario_diario: emp.salario_diario,
            tipo_jornada: emp.tipo_jornada || 'completa',
            es_asegurado: emp.es_asegurado,
            nss: emp.nss || '',
            curp: emp.curp || '',
            rfc: emp.rfc || '',
            infonavit_credito: emp.infonavit_credito,
            infonavit_descuento: emp.infonavit_descuento || '',
            infonavit_tipo: emp.infonavit_tipo || 'porcentaje',
            dias_vacaciones: emp.dias_vacaciones || 12,
        });
        setMostrarForm(true);
    };

    const eliminar = async (emp) => {
        const ok = await confirmar({
            titulo: 'Dar de baja',
            mensaje: `"${emp.nombre}" se marcara como inactivo.`,
            okTexto: 'Dar de baja',
            peligro: true,
        });
        if (!ok) return;
        await supabase.from('empleados').update({ activo: false }).eq('id', emp.id);
        toast.ok('Empleado dado de baja.');
        onRecargar();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={() => { setMostrarForm(!mostrarForm); setEditId(null); setForm(FORM_VACIO); }}
                    className={`px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase flex items-center gap-2 transition ${mostrarForm ? 'bg-slate-200 text-slate-600' : 'bg-primario text-white shadow-lg'}`}>
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
                            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: limpiarTexto(e.target.value, LIMITES.nombre) })}
                                maxLength={LIMITES.nombre}
                                className={inputCls} placeholder="Juan Perez" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Puesto</label>
                            <input value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })}
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
                            <input type="number" step="any" min="0" value={form.salario_diario}
                                onChange={(e) => setForm({ ...form, salario_diario: e.target.value })}
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
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Di­as vacaciones/año</label>
                            <input type="number" min="6" value={form.dias_vacaciones}
                                onChange={(e) => setForm({ ...form, dias_vacaciones: e.target.value })}
                                className={inputCls} />
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
                                <p className="text-[11px] text-slate-400 font-medium">Se calcularan cuotas IMSS e ISR automaticamente</p>
                            </div>
                        </label>

                        {form.es_asegurado && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <div>
                                    <label className="text-[10px] font-black text-blue-600 uppercase ml-1">NSS</label>
                                    <input value={form.nss}
                                        onChange={(e) => setForm({ ...form, nss: e.target.value.replace(/\D/g, '').slice(0, LIMITES.nss) })}
                                        className={inputCls} placeholder="12345678901" maxLength={11} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-blue-600 uppercase ml-1">CURP</label>
                                    <input value={form.curp}
                                        onChange={(e) => setForm({ ...form, curp: limpiarAlfanumerico(e.target.value, LIMITES.curp) })}
                                        className={inputCls} placeholder="PEJU850101HCHRZN09" maxLength={18} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-blue-600 uppercase ml-1">RFC</label>
                                    <input value={form.rfc}
                                        onChange={(e) => setForm({ ...form, rfc:  limpiarAlfanumerico(e.target.value, LIMITES.rfc) })}
                                        className={inputCls} placeholder="PEJU850101XX1" maxLength={13} />
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
                                    <span className="font-bold text-slate-700">Tiene credito Infonavit</span>
                                    <p className="text-[11px] text-slate-400 font-medium">Se descontara¡ de su nomina</p>
                                </div>
                            </label>

                            {form.infonavit_credito && (
                                <div className="grid grid-cols-2 gap-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                    <div>
                                        <label className="text-[10px] font-black text-amber-700 uppercase ml-1">Tipo descuento</label>
                                        <select value={form.infonavit_tipo}
                                            onChange={(e) => setForm({ ...form, infonavit_tipo: e.target.value })}
                                            className={inputCls}>
                                            <option value="porcentaje">% del salario</option>
                                            <option value="fijo">Cuota fija ($)</option>
                                            <option value="vsm">Veces salario mi­nimo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-amber-700 uppercase ml-1">Valor</label>
                                        <input type="number" step="any" min="0" value={form.infonavit_descuento}
                                            onChange={(e) => setForm({ ...form, infonavit_descuento: e.target.value })}
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
                        <button type="button" onClick={() => { setMostrarForm(false); setEditId(null); }}
                            className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {/* Lista de empleados */}
            <div className="space-y-3">
                {empleados.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                        <Users size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="font-bold text-slate-500">No hay empleados registrados</p>
                        <p className="text-slate-400 text-sm mt-1">Agrega tu primer empleado arriba.</p>
                    </div>
                ) : empleados.map(emp => (
                    <div key={emp.id}
                        className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className={`p-3 rounded-2xl shrink-0 ${emp.es_asegurado ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                {emp.es_asegurado ? <Shield size={20} /> : <Users size={20} />}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-black text-slate-800 truncate">{emp.nombre}</h4>
                                <p className="text-[11px] font-bold text-slate-400">
                                    {emp.puesto || 'Sin puesto'} {money(emp.salario_diario)}/di­a
                                    {emp.es_asegurado && 'IMSS'}
                                    {emp.infonavit_credito && 'Infonavit'}
                                </p>
                                <p className="text-[10px] text-slate-300 font-bold">Ingreso: {formatoMX(emp.fecha_ingreso)}</p>
                            </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button onClick={() => editar(emp)}
                                className="p-2.5 text-primario hover:bg-primario-suave rounded-xl transition">
                                <Pencil size={16} />
                            </button>
                            <button onClick={() => eliminar(emp)}
                                className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TAB: ASISTENCIA
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function TabAsistencia({ negocioId, empleados, toast }) {
    const [semana, setSemana] = useState(() => fechaLocalISO(obtenerLunesLocal()));
    const [registros, setRegistros] = useState({});
    const [guardando, setGuardando] = useState(false);

    const dias = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 7; i++) arr.push(sumarDiasLocal(semana, i));
        return arr;
    }, [semana]);

    const cargar = async () => {
        if (!negocioId || !dias.length) return;
        const { data } = await supabase.from('asistencia').select('*')
            .eq('negocio_id', negocioId)
            .gte('fecha', dias[0]).lte('fecha', dias[6]);

        const mapa = {};
        (data || []).forEach(r => { mapa[`${r.empleado_id}_${r.fecha}`] = r; });
        setRegistros(mapa);
    };

    useEffect(() => { cargar(); }, [negocioId, semana]);

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
        setRegistros(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { tipo: 'trabajado' }),
                empleado_id: empId, fecha, [campo]: num(valor), negocio_id: negocioId,
            },
        }));
    };

    const guardarTodo = async () => {
        setGuardando(true);
        const filas = Object.values(registros)
            .filter(r => r.empleado_id && r.fecha && r.tipo)
            .map(r => ({
                negocio_id: negocioId,
                empleado_id: r.empleado_id,
                fecha: r.fecha,
                tipo: r.tipo,
                horas_extra_doble: Math.min(9, Math.max(0, Number(r.horas_extra_doble) || 0)),
                horas_extra_triple: Math.min(9, Math.max(0, Number(r.horas_extra_triple) || 0)),
                nota: r.nota ? String(r.nota).slice(0, 300) : null,
            }));

        if (!filas.length) { setGuardando(false); return toast.warn('No hay nada que guardar.'); }

        const { error } = await supabase.from('asistencia')
            .upsert(filas, { onConflict: 'empleado_id,fecha' });

        setGuardando(false);
        if (error) return toast.error('No se pudo guardar: ' + error.message);
        toast.ok('Asistencia guardada correctamente.');
    };

    const nombreDia = (fecha) => {
        const d = new Date(fecha + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const esDomingo = (fecha) => new Date(fecha + 'T12:00:00').getDay() === 0;

    return (
        <div className="space-y-4">
            {/* Navegador de semana */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <button onClick={() => cambiarSemana(-1)}
                    className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200 transition">
                    Anterior
                </button>
                <div className="text-center">
                    <p className="font-black text-slate-800 text-sm uppercase">
                        Semana del {nombreDia(dias[0])} al {nombreDia(dias[6])}
                    </p>
                </div>
                <button onClick={() => cambiarSemana(1)}
                    className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-sm hover:bg-slate-200 transition">
                    Siguiente
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
                                <div>
                                    <h4 className="font-black text-slate-800">{emp.nombre}</h4>
                                    <p className="text-[10px] font-bold text-slate-400">
                                        {emp.puesto || 'Sin puesto'} {money(emp.salario_diario)}/di­a
                                    </p>
                                </div>
                            </div>

                            {/* Grid de di­as */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                {dias.map(fecha => {
                                    const key = `${emp.id}_${fecha}`;
                                    const reg = registros[key] || {};
                                    const tipo = reg.tipo || (esDomingo(fecha) ? 'descanso' : '');
                                    const tipoInfo = TIPOS_ASISTENCIA.find(t => t.id === tipo);

                                    return (
                                        <div key={fecha}
                                            className={`p-3 rounded-xl border ${esDomingo(fecha) ? 'bg-slate-50 border-slate-200' : 'border-slate-100'}`}>
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                                {nombreDia(fecha)}
                                            </p>
                                            <select value={tipo}
                                                onChange={(e) => setTipo(emp.id, fecha, e.target.value)}
                                                className={`w-full p-1.5 rounded-lg text-[10px] font-black border outline-none ${tipoInfo?.color || 'bg-white text-slate-500 border-slate-200'}`}>
                                                <option value="">Sin marcar</option>
                                                {TIPOS_ASISTENCIA.map(t => (
                                                    <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                            </select>

                                            {tipo === 'trabajado' && (
                                                <div className="mt-2 space-y-1">
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={10} className="text-slate-400" />
                                                        <input type="number" min="0" max="9" step="0.5"
                                                            value={reg.horas_extra_doble || ''}
                                                            onChange={(e) => setHoras(emp.id, fecha, 'horas_extra_doble', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full p-1 text-[10px] font-bold bg-slate-50 rounded border border-slate-100 outline-none" />
                                                        <span className="text-[8px] font-black text-slate-400 shrink-0">x2</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={10} className="text-amber-400" />
                                                        <input type="number" min="0" max="9" step="0.5"
                                                            value={reg.horas_extra_triple || ''}
                                                            onChange={(e) => setHoras(emp.id, fecha, 'horas_extra_triple', e.target.value)}
                                                            placeholder="0"
                                                            className="w-full p-1 text-[10px] font-bold bg-slate-50 rounded border border-slate-100 outline-none" />
                                                        <span className="text-[8px] font-black text-amber-500 shrink-0">x3</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Resumen rapido de la semana */}
                            <div className="flex gap-3 mt-3 flex-wrap">
                                {(() => {
                                    let trab = 0, faltas = 0, hd = 0, ht = 0;
                                    dias.forEach(f => {
                                        const r = registros[`${emp.id}_${f}`];
                                        if (r?.tipo === 'trabajado') { trab++; hd += num(r.horas_extra_doble); ht += num(r.horas_extra_triple); }
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TAB: NÃ“MINA (Calcular y generar recibos)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function TabNomina({ negocioId, empleados, config, toast, confirmar, session }) {

    const [tipoPeriodo, setTipoPeriodo] = useState('semanal');
    const [fechaInicio, setFechaInicio] = useState(() =>
        fechaLocalISO(obtenerLunes())
    );

    const [fechaFin, setFechaFin] = useState(() => {
        const domingo = obtenerLunes();
        domingo.setDate(domingo.getDate() + 6);
        return fechaLocalISO(domingo);
    });
    const [recibos, setRecibos] = useState([]);
    const [bonos, setBonos] = useState({});
    const [otrasDed, setOtrasDed] = useState({});
    const [calculado, setCalculado] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const diasPeriodo = useMemo(() => {
        if (!fechaInicio || !fechaFin) return 7;
        const diff = (new Date(fechaFin) - new Date(fechaInicio)) / 86400000;
        return Math.max(1, Math.round(diff) + 1);
    }, [fechaInicio, fechaFin]);

    // Preset de fechas segun tipo de periodo
    useEffect(() => {
        const hoy = new Date();
        if (tipoPeriodo === 'semanal') {
            const lunes = obtenerLunes();
            const domingo = new Date(lunes);
            domingo.setDate(lunes.getDate() + 6);

            setFechaInicio(fechaLocalISO(lunes));
            setFechaFin(fechaLocalISO(domingo));
        } else if (tipoPeriodo === 'quincenal') {
            const dia = hoy.getDate();
            const mes = String(hoy.getMonth() + 1).padStart(2, '0');
            const anio = hoy.getFullYear();
            if (dia <= 15) {
                setFechaInicio(`${anio}-${mes}-01`);
                setFechaFin(`${anio}-${mes}-15`);
            } else {
                const ultimo = new Date(anio, hoy.getMonth() + 1, 0).getDate();
                setFechaInicio(`${anio}-${mes}-16`);
                setFechaFin(`${anio}-${mes}-${ultimo}`);
            }
        } else {
            const mes = String(hoy.getMonth() + 1).padStart(2, '0');
            const anio = hoy.getFullYear();
            const ultimo = new Date(anio, hoy.getMonth() + 1, 0).getDate();
            setFechaInicio(`${anio}-${mes}-01`);
            setFechaFin(`${anio}-${mes}-${ultimo}`);
        }
        setCalculado(false);
        setRecibos([]);
    }, [tipoPeriodo]);

    const calcular = async () => {
        if (!fechaInicio || !fechaFin) return toast.error('Define las fechas del periodo.');
        if (!empleados.length) return toast.error('No hay empleados registrados.');

        const { data: asist } = await supabase.from('asistencia').select('*')
            .eq('negocio_id', negocioId)
            .gte('fecha', fechaInicio).lte('fecha', fechaFin);

        const porEmpleado = {};
        (asist || []).forEach(r => {
            if (!porEmpleado[r.empleado_id]) porEmpleado[r.empleado_id] = [];
            porEmpleado[r.empleado_id].push(r);
        });

        const result = empleados.map(emp => {
            const regs = porEmpleado[emp.id] || [];
            const diasTrabajados = regs.filter(r => r.tipo === 'trabajado').length;
            const diasFalta = regs.filter(r => r.tipo === 'falta').length;
            const diasIncapacidad = regs.filter(r => r.tipo === 'incapacidad').length;
            const horasExtraDoble = regs.reduce((a, r) => a + num(r.horas_extra_doble), 0);
            const horasExtraTriple = regs.reduce((a, r) => a + num(r.horas_extra_triple), 0);

            const bonoEmp = num(bonos[emp.id]?.monto);
            const otrasDedEmp = num(otrasDed[emp.id]?.monto);

            const calculo = calcularNomina({
                salario_diario: numeroSeguro(form.salario_diario, { max: 999999 }),
                diasTrabajados,
                diasFalta,
                horasExtraDoble,
                horasExtraTriple,
                bonos: bonoEmp,
                esAsegurado: emp.es_asegurado,
                infonavitCredito: emp.infonavit_credito,
                infonavitTipo: emp.infonavit_tipo,
                infonavitDescuento: num(emp.infonavit_descuento),
                otrasDeducciones: otrasDedEmp,
                diasPeriodo,
            });

            return {
                empleado: emp,
                ...calculo,
                diasIncapacidad,
                bonoDescripcion: bonos[emp.id]?.desc || '',
                otrasDeduccionesDesc: otrasDed[emp.id]?.desc || '',
            };
        });

        setRecibos(result);
        setCalculado(true);
    };

    const guardarPeriodo = async () => {
        if (!recibos.length) return;
        setGuardando(true);

        const { data: per, error: perErr } = await supabase.from('nomina_periodos')
            .insert([{
                negocio_id: negocioId,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                tipo: tipoPeriodo,
            }])
            .select('id').single();

        if (perErr) { setGuardando(false); return toast.error(perErr.message); }

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
        if (error) return toast.error(error.message);
        toast.ok('Nomina guardada correctamente.');
    };

    const imprimirRecibo = (recibo) => {
        const cfgPdf = {
            nombre: config.nombre || '',
            direccion: config.direccion || '',
            telefono: config.telefono || '',
            logo: config.logo || null,
            rfc: '',
        };

        generarReciboPDF({
            config: cfgPdf,
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

    const totalNomina = recibos.reduce((a, r) => a + r.netoPagar, 0);

    return (
        <div className="space-y-6">
            {/* Config del periodo */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Calculator size={18} /> Calcular nomina
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de periodo</label>
                        <select value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value)}
                            className={inputCls}>
                            <option value="semanal">Semanal</option>
                            <option value="quincenal">Quincenal</option>
                            <option value="mensual">Mensual</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha inicio</label>
                        <input type="date" value={fechaInicio}
                            onChange={(e) => { setFechaInicio(e.target.value); setCalculado(false); }}
                            className={inputCls} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha fin</label>
                        <input type="date" value={fechaFin}
                            onChange={(e) => { setFechaFin(e.target.value); setCalculado(false); }}
                            className={inputCls} />
                    </div>
                    <div className="flex items-end">
                        <button onClick={calcular}
                            className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2">
                            <Calculator size={16} /> Calcular
                        </button>
                    </div>
                </div>

                {/* Bonos y deducciones extra por empleado */}
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
                                    <input type="number" min="0" step="any" placeholder="Bono $"
                                        value={bonos[emp.id]?.monto || ''}
                                        onChange={(e) => setBonos(prev => ({
                                            ...prev, [emp.id]: { ...prev[emp.id], monto: e.target.value }
                                        }))}
                                        className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-bold outline-none" />
                                    <input placeholder="Concepto bono"
                                        value={bonos[emp.id]?.desc || ''}
                                        onChange={(e) => setBonos(prev => ({
                                            ...prev, [emp.id]: { ...prev[emp.id], desc: e.target.value }
                                        }))}
                                        className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-medium outline-none" />
                                    <input type="number" min="0" step="any" placeholder="Deduccion $"
                                        value={otrasDed[emp.id]?.monto || ''}
                                        onChange={(e) => setOtrasDed(prev => ({
                                            ...prev, [emp.id]: { ...prev[emp.id], monto: e.target.value }
                                        }))}
                                        className="p-2 bg-white rounded-lg border border-slate-100 text-sm font-bold outline-none" />
                                    <input placeholder="Concepto deduccion"
                                        value={otrasDed[emp.id]?.desc || ''}
                                        onChange={(e) => setOtrasDed(prev => ({
                                            ...prev, [emp.id]: { ...prev[emp.id], desc: e.target.value }
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
                    {/* Resumen total */}
                    <div className="bg-slate-900 p-6 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Nomina total del periodo
                            </p>
                            <p className="text-3xl font-black tracking-tighter">{money(totalNomina)}</p>
                            <p className="text-slate-400 text-xs font-bold mt-1">
                                {recibos.length} empleado(s){fechaInicio} al {fechaFin}
                            </p>
                        </div>
                        <button onClick={guardarPeriodo} disabled={guardando}
                            className="bg-primario text-white px-6 py-3 rounded-2xl font-bold hover:bg-primario-dark transition flex items-center gap-2 disabled:opacity-50 shadow-lg">
                            <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar nomina'}
                        </button>
                    </div>

                    {/* Recibos individuales */}
                    <div className="space-y-4">
                        {recibos.map(r => {
                            const emp = r.empleado;
                            return (
                                <div key={emp.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-2xl ${emp.es_asegurado ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                <Users size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800">{emp.nombre}</h4>
                                                <p className="text-[10px] font-bold text-slate-400">
                                                    {emp.puesto} {money(emp.salario_diario)}/di­a
                                                    {emp.es_asegurado && 'IMSS'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Neto a pagar</p>
                                                <p className="text-xl font-black text-primario">{money(r.netoPagar)}</p>
                                            </div>
                                            <button onClick={() => imprimirRecibo(r)}
                                                className="bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-900 transition"
                                                title="Descargar recibo PDF">
                                                <FileDown size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {/* Percepciones */}
                                        <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase">Percepciones</p>
                                            <p className="font-black text-emerald-800">{money(r.totalPercepciones)}</p>
                                            <div className="text-[10px] text-emerald-700 font-medium mt-1 space-y-0.5">
                                                <p>Base: {money(r.salarioBase)} ({r.diasTrabajados}d)</p>
                                                <p>7Â° di­a: {money(r.septimoDia)}</p>
                                                {r.pagoHorasExtra > 0 && <p>H. extra: {money(r.pagoHorasExtra)}</p>}
                                                {r.bonos > 0 && <p>Bonos: {money(r.bonos)}</p>}
                                            </div>
                                        </div>

                                        {/* Deducciones */}
                                        <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                                            <p className="text-[9px] font-black text-rose-600 uppercase">Deducciones</p>
                                            <p className="font-black text-rose-800">{money(r.totalDeducciones)}</p>
                                            <div className="text-[10px] text-rose-700 font-medium mt-1 space-y-0.5">
                                                {r.deduccionIMSS > 0 && <p>IMSS: {money(r.deduccionIMSS)}</p>}
                                                {r.deduccionISR > 0 && <p>ISR: {money(r.deduccionISR)}</p>}
                                                {r.deduccionInfonavit > 0 && <p>Infonavit: {money(r.deduccionInfonavit)}</p>}
                                                {r.otrasDeducciones > 0 && <p>Otras: {money(r.otrasDeducciones)}</p>}
                                                {r.totalDeducciones === 0 && <p>Sin deducciones</p>}
                                            </div>
                                        </div>

                                        {/* Asistencia */}
                                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-600 uppercase">Asistencia</p>
                                            <div className="text-[10px] text-blue-700 font-bold mt-1 space-y-0.5">
                                                <p>Trabajados: {r.diasTrabajados}</p>
                                                {r.diasFalta > 0 && <p className="text-rose-600">Faltas: {r.diasFalta}</p>}
                                                {r.diasIncapacidad > 0 && <p>Incapacidad: {r.diasIncapacidad}</p>}
                                            </div>
                                        </div>

                                        {/* Horas extra */}
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