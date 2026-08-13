import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserPlus, Search, Edit2, Trash2, Save, Mail, Smartphone,
  MapPin, AlertTriangle, X,
} from 'lucide-react';
import { supabase } from '../supabaseClient.js';
import { useNegocio } from '../context/NegocioContext.jsx';
import { useUI } from '../components/ui/UI.jsx';
import {
  LIMITES, EMAIL_RE, telefonoMX, formatearTelefono, soloDigitos,
  limpiarTexto, textoParaGuardar, normalizar, verificarPolitica,
} from '../utils/seguridad.js';

const VACIO = { nombre: '', alias: '', telefono: '', correo: '', direccion: '' };

const MsgError = ({ msg }) =>
  msg ? (
    <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-start gap-1">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      {msg}
    </p>
  ) : null;

/** Contador de caracteres: solo aparece cuando el usuario se acerca al tope. */
const Contador = ({ valor, limite }) => {
  const usado = (valor || '').length;
  if (usado < limite * 0.8) return null;
  return (
    <p className={`text-[10px] font-bold mt-1 ml-1 text-right ${usado >= limite ? 'text-rose-500' : 'text-slate-400'}`}>
      {usado}/{limite}
    </p>
  );
};

export default function Clientes({ session }) {
  const { toast, confirmar } = useUI();
  const { negocioId, puede } = useNegocio();

  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [formData, setFormData] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const telRef = useRef(null);

  /* ─────────── Datos ─────────── */
  const fetchClientes = async () => {
    if (!negocioId) return;
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, alias, telefono, correo, direccion')
      .eq('negocio_id', negocioId)
      .order('nombre')
      .limit(2000);                               // tope duro: evita traer la tabla entera
    if (error) toast.error('No se pudieron cargar los clientes: ' + error.message);
    else setClientes(data || []);
  };

  useEffect(() => { fetchClientes(); /* eslint-disable-next-line */ }, [negocioId]);

  /* ─────────── Validación ─────────── */
  const duplicado = useMemo(() => {
    const n = normalizar(formData.nombre);
    return n.length >= 3 && clientes.some(c => normalizar(c.nombre) === n && c.id !== editandoId);
  }, [formData.nombre, clientes, editandoId]);

  const setCampo = (name, valor) => {
    setFormData(p => ({ ...p, [name]: valor }));
    setErrores(p => ({ ...p, [name]: undefined, general: undefined }));
  };

  const manejarCambio = (e) => {
    const { name, value } = e.target;
    const limite = LIMITES[name] ?? 240;
    const limpio =
      name === 'correo'
        ? limpiarTexto(value.toLowerCase(), limite)
        : limpiarTexto(value, limite, { multilinea: name === 'direccion' });
    setCampo(name, limpio);
  };

  /**
   * TELÉFONO — la corrección clave.
   * El input es type="text": los type="number"/"tel" del navegador dejan pasar
   * "e", "+" y "-". Aquí el valor mostrado siempre se deriva de los dígitos
   * reales, así que teclear, pegar "+52 (614) 123-45-67" o autocompletar
   * terminan igual: 10 dígitos limpios.
   */
  const manejarTelefono = (e) => {
    const soloNums = telefonoMX(e.target.value);
    setCampo('telefono', soloNums);
  };

  const validar = () => {
    const e = {};
    const nombre = formData.nombre.trim();
    const tel = telefonoMX(formData.telefono);
    const mail = formData.correo.trim();

    if (nombre.length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres.';
    if (nombre.length > LIMITES.nombre) e.nombre = `Máximo ${LIMITES.nombre} caracteres.`;
    if (tel && tel.length !== 10) e.telefono = 'El teléfono debe tener 10 dígitos.';
    if (tel.length === 10 && clientes.some(c => telefonoMX(c.telefono) === tel && c.id !== editandoId))
      e.telefono = 'Ese teléfono ya pertenece a otro cliente.';
    if (mail && !EMAIL_RE.test(mail)) e.correo = 'Correo no válido.';
    if (mail.length > LIMITES.correo) e.correo = `Máximo ${LIMITES.correo} caracteres.`;
    if (duplicado && formData.alias.trim().length < 2)
      e.alias = 'Ya hay otro cliente con ese nombre. Agrega una referencia para diferenciarlos.';

    setErrores(e);
    return !Object.keys(e).length;
  };

  /* ─────────── Guardar ─────────── */
  const guardarCliente = async (ev) => {
    ev.preventDefault();
    if (!validar() || !negocioId || cargando) return;

    const bloqueo = verificarPolitica('escritura');
    if (bloqueo) return toast.warn(bloqueo);

    setCargando(true);
    const payload = {
      nombre: textoParaGuardar(formData.nombre, LIMITES.nombre),
      alias: textoParaGuardar(formData.alias, LIMITES.alias) || null,
      telefono: telefonoMX(formData.telefono) || null,
      correo: textoParaGuardar(formData.correo, LIMITES.correo).toLowerCase() || null,
      direccion: textoParaGuardar(formData.direccion, LIMITES.direccion, { multilinea: true }) || null,
    };

    const { error } = editandoId
      ? await supabase.from('clientes').update(payload).eq('id', editandoId)
      : await supabase.from('clientes').insert([{
          negocio_id: negocioId,
          user_id: session?.user?.id || null,
          ...payload,
        }]);

    setCargando(false);
    if (error) {
      return toast.error(
        error.code === '23505'
          ? 'Ese teléfono ya pertenece a otro cliente.'
          : 'No se pudo guardar: ' + error.message
      );
    }

    toast.ok(editandoId ? 'Cliente actualizado.' : 'Cliente registrado.');
    setFormData(VACIO);
    setEditandoId(null);
    setErrores({});
    fetchClientes();
  };

  const editar = (c) => {
    setEditandoId(c.id);
    setFormData({
      nombre: c.nombre || '',
      alias: c.alias || '',
      telefono: telefonoMX(c.telefono),
      correo: c.correo || '',
      direccion: c.direccion || '',
    });
    setErrores({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminar = async (c) => {
    const ok = await confirmar({
      titulo: 'Eliminar cliente',
      mensaje: `"${c.nombre}" se eliminará permanentemente.`,
      okTexto: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('clientes').delete().eq('id', c.id);
    if (error) return toast.error('No se pudo eliminar: ' + error.message);
    toast.ok('Cliente eliminado.');
    if (editandoId === c.id) { setEditandoId(null); setFormData(VACIO); }
    fetchClientes();
  };

  /* ─────────── Filtro ─────────── */
  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    const digits = soloDigitos(busqueda);
    if (!q) return clientes;
    return clientes.filter(c =>
      normalizar(c.nombre).includes(q) ||
      normalizar(c.alias).includes(q) ||
      (digits.length >= 3 && soloDigitos(c.telefono).includes(digits))
    );
  }, [clientes, busqueda]);

  const cls = (campo) =>
    `w-full p-3 rounded-xl border font-bold outline-none transition ${
      errores[campo] ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-100 focus:bg-white'
    }`;

  /* ─────────── Render ─────────── */
  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase">
          Directorio de clientes
        </h2>
        <span className="text-xs font-black text-slate-400 uppercase shrink-0">
          {clientes.length} registrados
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ══ Formulario ══ */}
        <form onSubmit={guardarCliente} noValidate
          className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 lg:sticky lg:top-8 space-y-4 h-fit">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <UserPlus size={20} className="text-primario" />
            {editandoId ? 'Actualizar cliente' : 'Nuevo cliente'}
          </h3>

          {errores.general && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl">
              {errores.general}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre completo *</label>
            <input name="nombre" maxLength={LIMITES.nombre} value={formData.nombre}
              onChange={manejarCambio} className={cls('nombre')} placeholder="Ej. Juan Pérez" />
            <MsgError msg={errores.nombre} />
            <Contador valor={formData.nombre} limite={LIMITES.nombre} />
          </div>

          {duplicado && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] font-bold text-amber-700">
              Ya existe un cliente con este nombre. Agrega una referencia para distinguirlos.
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Referencia / alias</label>
            <input name="alias" maxLength={LIMITES.alias} value={formData.alias}
              onChange={manejarCambio} className={cls('alias')} placeholder="Ej. Taller Centro" />
            <MsgError msg={errores.alias} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono (opcional)</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              {/*
                type="text" + inputMode="numeric" = teclado numérico en celular
                SIN los caracteres "e", "+", "-" que permite type="number"/"tel".
                maxLength va sobre el texto FORMATEADO (12), no sobre los dígitos:
                con maxLength={10} el usuario solo alcanzaba a escribir 8 dígitos.
              */}
              <input
                ref={telRef}
                name="telefono"
                type="text"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={12}
                value={formatearTelefono(formData.telefono)}
                onChange={manejarTelefono}
                className={`${cls('telefono')} pl-9 tabular-nums`}
                placeholder="614 123 4567"
              />
            </div>
            <MsgError msg={errores.telefono} />
            <p className="text-[10px] font-bold text-slate-400 mt-1 ml-1">
              10 dígitos. Puedes pegar con lada o guiones, se limpia solo.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Correo (opcional)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input name="correo" type="email" maxLength={LIMITES.correo} value={formData.correo}
                onChange={manejarCambio} className={`${cls('correo')} pl-9`} placeholder="correo@ejemplo.com" />
            </div>
            <MsgError msg={errores.correo} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección de servicio (opcional)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <textarea name="direccion" maxLength={LIMITES.direccion} value={formData.direccion}
                onChange={manejarCambio} rows="3"
                className={`${cls('direccion')} pl-9 resize-none`} placeholder="Calle, número y colonia" />
            </div>
            <Contador valor={formData.direccion} limite={LIMITES.direccion} />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={cargando}
              className="flex-1 bg-primario text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-primario-dark transition">
              <Save size={18} />
              {cargando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Registrar'}
            </button>
            {editandoId && (
              <button type="button"
                onClick={() => { setEditandoId(null); setFormData(VACIO); setErrores({}); }}
                title="Cancelar edición"
                className="bg-slate-100 text-slate-500 px-4 rounded-2xl hover:bg-slate-200 transition">
                <X size={18} />
              </button>
            )}
          </div>
        </form>

        {/* ══ Listado ══ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input maxLength={LIMITES.busqueda} value={busqueda}
              onChange={e => setBusqueda(limpiarTexto(e.target.value, LIMITES.busqueda))}
              placeholder="Buscar por nombre, alias o teléfono..."
              className="w-full bg-white border border-slate-200 p-4 pl-12 pr-10 rounded-2xl font-bold text-slate-700 outline-none shadow-sm focus:border-primario transition" />
            {busqueda && (
              <button onClick={() => setBusqueda('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtrados.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <p className="font-bold text-slate-500">
                  {clientes.length === 0 ? 'Aún no hay clientes' : 'Sin resultados'}
                </p>
                <p className="text-sm mt-1">
                  {clientes.length === 0
                    ? 'Registra el primero con el formulario de la izquierda.'
                    : 'Prueba con otro nombre o teléfono.'}
                </p>
              </div>
            ) : filtrados.map(c => (
              <div key={c.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-800 text-lg truncate">{c.nombre}</h4>
                    {c.alias && (
                      <span className="inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {c.alias}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => editar(c)} title="Editar"
                      className="min-w-[40px] min-h-[40px] p-2 text-primario hover:bg-primario-suave rounded-xl transition">
                      <Edit2 size={16} />
                    </button>
                    {puede('eliminar_registros') && (
                      <button onClick={() => eliminar(c)} title="Eliminar"
                        className="min-w-[40px] min-h-[40px] p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-500 font-medium">
                  {c.telefono && (
                    <a href={`tel:+52${telefonoMX(c.telefono)}`} className="flex items-center gap-2 hover:text-primario">
                      <Smartphone size={14} /> {formatearTelefono(c.telefono)}
                    </a>
                  )}
                  {c.correo && (
                    <a href={`mailto:${encodeURIComponent(c.correo)}`} className="flex items-center gap-2 truncate hover:text-primario">
                      <Mail size={14} /> <span className="truncate">{c.correo}</span>
                    </a>
                  )}
                  {c.direccion && (
                    <p className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{c.direccion}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}