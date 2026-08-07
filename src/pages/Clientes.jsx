import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Search, Edit2, Trash2, Save, Mail, Smartphone,
  MapPin, AlertTriangle, X, Tag
} from 'lucide-react';
import { supabase } from '../supabaseClient.js';

/* ─────────── Helpers de validación ─────────── */

const soloDigitos = (v) => (v || '').replace(/\D/g, '');

// 614 123 4567  (visual, no se guarda así)
const formatearTel = (v) => {
  const d = soloDigitos(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

// "José  Pérez " -> "jose perez"  (para comparar nombres)
const normalizar = (v) =>
  (v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const FORM_VACIO = { nombre: '', alias: '', telefono: '', correo: '', direccion: '' };

/* ─────────── Componente ─────────── */

export default function Clientes({ session }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [formData, setFormData] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});

  /* ---------- Carga ---------- */
  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('user_id', session.user.id)          // defensa extra además del RLS
      .order('nombre', { ascending: true });

    if (error) console.error('Error al cargar clientes:', error.message);
    else setClientes(data || []);
  };

  useEffect(() => { fetchClientes(); }, [session.user.id]);

  /* ---------- Detección de nombre repetido (en vivo) ---------- */
  const nombreDuplicado = useMemo(() => {
    const n = normalizar(formData.nombre);
    if (n.length < 3) return false;
    return clientes.some(c => normalizar(c.nombre) === n && c.id !== editandoId);
  }, [formData.nombre, clientes, editandoId]);

  /* ---------- Cambios de campo ---------- */
  const manejarCambio = (e) => {
    const { name, value } = e.target;
    // El teléfono sólo acepta dígitos, máximo 10
    const limpio = name === 'telefono' ? soloDigitos(value).slice(0, 10) : value;
    setFormData(prev => ({ ...prev, [name]: limpio }));
    setErrores(prev => ({ ...prev, [name]: undefined, general: undefined }));
  };

  /* ---------- Validación ---------- */
  const validar = () => {
    const e = {};
    const nombre = formData.nombre.trim();
    const tel = soloDigitos(formData.telefono);
    const mail = formData.correo.trim();

    if (nombre.length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres.';

    // Teléfono: OPCIONAL, pero si lo escribes debe ser válido
    if (tel.length > 0) {
      if (tel.length !== 10) e.telefono = 'El teléfono debe tener 10 dígitos (lada + número).';
      else {
        const rep = clientes.find(c => soloDigitos(c.telefono) === tel && c.id !== editandoId);
        if (rep) e.telefono = `Ese teléfono ya está registrado a nombre de "${rep.nombre}".`;
      }
    }

    // Correo: OPCIONAL, pero si lo escribes debe ser válido
    if (mail.length > 0 && !EMAIL_RE.test(mail)) {
      e.correo = 'Correo no válido. Ejemplo: nombre@dominio.com';
    }

    // Alias obligatorio SÓLO si el nombre ya existe
    if (nombreDuplicado && formData.alias.trim().length < 2) {
      e.alias = 'Ya existe un cliente con ese nombre. Escribe una referencia para diferenciarlo.';
    }

    setErrores(e);
    return Object.keys(e).length === 0;
  };

  /* ---------- Guardar ---------- */
  const guardarCliente = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;

    setCargando(true);
    const payload = {
      nombre: formData.nombre.trim(),
      alias: formData.alias.trim() || null,
      telefono: soloDigitos(formData.telefono) || null,
      correo: formData.correo.trim().toLowerCase() || null,
      direccion: formData.direccion.trim() || null,
    };

    try {
      const { error } = editandoId
        ? await supabase.from('clientes').update(payload).eq('id', editandoId)
        : await supabase.from('clientes').insert([{ user_id: session.user.id, ...payload }]);

      if (error) {
        // 23505 = violación de índice único (teléfono repetido)
        if (error.code === '23505') {
          setErrores({ telefono: 'Ese teléfono ya pertenece a otro cliente.' });
        } else {
          setErrores({ general: error.message });
        }
        return;
      }

      await fetchClientes();
      resetForm();
    } finally {
      setCargando(false);
    }
  };

  const resetForm = () => {
    setFormData(FORM_VACIO);
    setEditandoId(null);
    setErrores({});
  };

  const iniciarEdicion = (c) => {
    setEditandoId(c.id);
    setErrores({});
    setFormData({
      nombre: c.nombre || '',
      alias: c.alias || '',
      telefono: soloDigitos(c.telefono) || '',
      correo: c.correo || '',
      direccion: c.direccion || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarCliente = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    else fetchClientes();
  };

  /* ---------- Filtro ---------- */
  const clientesFiltrados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return clientes;
    return clientes.filter(c =>
      normalizar(c.nombre).includes(q) ||
      normalizar(c.alias).includes(q) ||
      soloDigitos(c.telefono).includes(soloDigitos(busqueda))
    );
  }, [clientes, busqueda]);

  // Marca visualmente los nombres que se repiten en la lista
  const conteoNombres = useMemo(() => {
    const m = {};
    clientes.forEach(c => { const n = normalizar(c.nombre); m[n] = (m[n] || 0) + 1; });
    return m;
  }, [clientes]);

  const folioDe = (c) =>
    c.folio != null ? `#${String(c.folio).padStart(4, '0')}` : `#${String(c.id).slice(-4)}`;

  const inputBase =
    'w-full p-3 rounded-xl border font-bold outline-none transition focus:bg-white focus:ring-2';
  const cls = (campo) =>
    `${inputBase} ${errores[campo]
      ? 'bg-red-50 border-red-300 focus:ring-red-500/20'
      : 'bg-slate-50 border-slate-100 focus:ring-blue-500/10'}`;

  const MsgError = ({ campo }) =>
    errores[campo] ? (
      <p className="text-[11px] font-bold text-red-600 mt-1 ml-1 flex items-start gap-1">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {errores[campo]}
      </p>
    ) : null;

  /* ---------- Render ---------- */
  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">
          Directorio de Clientes
        </h2>
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
          {clientes.length} registrados
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ══ FORMULARIO ══ */}
        <div className="lg:col-span-1">
          <form
            onSubmit={guardarCliente}
            noValidate
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 lg:sticky lg:top-8 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-2">
              {editandoId
                ? <Edit2 size={20} className="text-blue-600" />
                : <UserPlus size={20} className="text-blue-600" />}
              {editandoId ? 'Actualizar Cliente' : 'Nuevo Cliente'}
            </h3>

            {errores.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl">
                {errores.general}
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                Nombre Completo *
              </label>
              <input
                name="nombre"
                value={formData.nombre}
                onChange={manejarCambio}
                className={cls('nombre')}
                placeholder="Ej. Juan Pérez"
                autoComplete="off"
              />
              <MsgError campo="nombre" />
            </div>

            {/* Aviso + Alias */}
            {nombreDuplicado && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-amber-700 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Ya tienes un cliente con este nombre. Agrega una referencia para
                  distinguirlos.
                </p>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                Referencia / Alias {nombreDuplicado && <span className="text-amber-600">*</span>}
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  name="alias"
                  value={formData.alias}
                  onChange={manejarCambio}
                  className={`${cls('alias')} pl-9`}
                  placeholder="Ej. Taller Centro, vecino, Col. Obrera"
                  autoComplete="off"
                />
              </div>
              <MsgError campo="alias" />
            </div>

            {/* Teléfono */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                Teléfono <span className="text-slate-300">(opcional)</span>
              </label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  name="telefono"
                  type="tel"
                  inputMode="numeric"
                  value={formatearTel(formData.telefono)}
                  onChange={manejarCambio}
                  className={`${cls('telefono')} pl-9`}
                  placeholder="614 123 4567"
                  autoComplete="off"
                />
              </div>
              <MsgError campo="telefono" />
              {!errores.telefono && formData.telefono.length > 0 && formData.telefono.length < 10 && (
                <p className="text-[11px] font-bold text-slate-400 mt-1 ml-1">
                  {10 - formData.telefono.length} dígitos restantes
                </p>
              )}
            </div>

            {/* Correo */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                Email <span className="text-slate-300">(opcional)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  name="correo"
                  type="email"
                  value={formData.correo}
                  onChange={manejarCambio}
                  className={`${cls('correo')} pl-9`}
                  placeholder="correo@ejemplo.com"
                  autoComplete="off"
                />
              </div>
              <MsgError campo="correo" />
            </div>

            {/* Dirección */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                Dirección de Servicio <span className="text-slate-300">(opcional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <textarea
                  name="direccion"
                  value={formData.direccion}
                  onChange={manejarCambio}
                  rows="3"
                  className={`${cls('direccion')} pl-9 resize-none`}
                  placeholder="Calle y colonia"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={cargando}
                className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg disabled:opacity-50"
              >
                <Save size={18} />
                {cargando ? 'Guardando...' : editandoId ? 'Guardar Cambios' : 'Registrar'}
              </button>
              {editandoId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-100 text-slate-500 px-4 rounded-2xl font-bold hover:bg-slate-200 transition"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ══ LISTA ══ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, alias o teléfono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-white border border-slate-200 p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientesFiltrados.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400 font-medium bg-white rounded-3xl border border-dashed border-slate-200">
                No se encontraron clientes.
              </div>
            ) : (
              clientesFiltrados.map((c) => {
                const repetido = conteoNombres[normalizar(c.nombre)] > 1;
                return (
                  <div
                    key={c.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition group"
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black text-slate-300 tracking-widest">
                            {folioDe(c)}
                          </span>
                          <h4 className="font-black text-slate-800 text-lg leading-tight truncate">
                            {c.nombre}
                          </h4>
                        </div>
                        {c.alias && (
                          <span
                            className={`inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              repetido
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {c.alias}
                          </span>
                        )}
                        {repetido && !c.alias && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-600">
                            <AlertTriangle size={10} /> Sin referencia
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                        <button
                          onClick={() => iniciarEdicion(c)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => eliminarCliente(c.id, c.nombre)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-500 font-medium">
                      {c.telefono && (
                        <a
                          href={`tel:+52${soloDigitos(c.telefono)}`}
                          className="flex items-center gap-2 hover:text-blue-600 transition w-fit"
                        >
                          <Smartphone size={14} /> {formatearTel(c.telefono)}
                        </a>
                      )}
                      {c.correo && (
                        <a
                          href={`mailto:${c.correo}`}
                          className="flex items-center gap-2 hover:text-blue-600 transition truncate w-fit max-w-full"
                        >
                          <Mail size={14} className="shrink-0" />
                          <span className="truncate">{c.correo}</span>
                        </a>
                      )}
                      {c.direccion && (
                        <p className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                          <MapPin size={14} className="mt-0.5 shrink-0" /> {c.direccion}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}