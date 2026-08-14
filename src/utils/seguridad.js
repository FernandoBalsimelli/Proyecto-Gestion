/* ══════════════════════════════════════════════════════════════
   seguridad.js — Límites, sanitización y control de abuso
   Fuente única de verdad para TODOS los límites de texto de la app.
   Los mismos números están replicados como CHECK constraints en
   sql/03_limites_db.sql para que la base también se defienda.
   ══════════════════════════════════════════════════════════════ */

export const LIMITES = {
  // ── Personas / clientes ──
  nombre: 120,
  alias: 80,
  correo: 160,
  telefono: 10,          // dígitos, no caracteres mostrados
  direccion: 240,

  // ── Empresa / configuración ──
  nombreNegocio: 100,
  especialidad: 80,
  sitioWeb: 120,
  banco: 60,
  cuentaNombre: 120,
  cuentaNumero: 40,
  tituloDocumento: 40,
  condiciones: 1000,

  // ── Documentos / cotizaciones ──
  descripcionConcepto: 300,
  descripcion: 500,
  nota: 300,
  proveedor: 120,
  categoria: 40,
  unidad: 20,

  // ── Agenda ──
  agendaTitulo: 120,
  agendaDescripcion: 600,

  // ── CRM y operación ──
  oportunidadNombre: 120,
  oportunidadContacto: 100,
  oportunidadNotas: 1500,
  tareaTitulo: 120,
  tareaDetalle: 1500,
  metaNombre: 100,
  notaInternaTitulo: 120,
  notaInternaContenido: 3000,
  gastoRecurrente: 180,
  checklistTipo: 50,
  checklistItem: 160,

  // ── PDF ──
  pdfPrefijo: 12,
  pdfEtiqueta: 24,
  pdfPie: 150,
  pdfNota: 110,

  // ── Empleados / nómina ──
  puesto: 80,
  rfc: 13,
  curp: 18,
  nss: 11,

  // ── Cuentas ──
  password: 128,
  busqueda: 80,

  // ── Topes de colección (no de texto) ──
  maxConceptos: 60,
  maxImagenBytes: 800_000,
  maxMonto: 99_999_999.99,
  maxCantidad: 999_999,
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/* ══════════════ Texto ══════════════ */

/** Quita caracteres de control invisibles que rompen PDFs y CSV. */
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g;

/** Recorta a un límite duro. Nunca devuelve null/undefined. */
export const limitar = (valor = '', limite = 500) =>
  String(valor ?? '').slice(0, limite);

/**
 * Limpieza estándar para cualquier input de texto libre.
 * - Elimina caracteres de control y zero-width (usados para inflar campos).
 * - Colapsa saltos de línea múltiples y espacios repetidos.
 * - Recorta al límite.
 */
export const limpiarTexto = (valor = '', limite = 500, { multilinea = false } = {}) => {
  let v = String(valor ?? '').replace(CONTROL_RE, '');
  v = multilinea
    ? v.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{3,}/g, '  ')
    : v.replace(/\s{2,}/g, ' ');
  return v.slice(0, limite);
};

/** Igual que limpiarTexto pero además hace trim. Úsalo justo antes de guardar. */
export const textoParaGuardar = (valor = '', limite = 500, opts) =>
  limpiarTexto(valor, limite, opts).trim();

/** Normaliza para búsquedas: sin acentos, minúsculas, espacios colapsados. */
export const normalizar = (valor = '') =>
  String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

/* ══════════════ Números y teléfono ══════════════ */

export const soloDigitos = (valor = '') => String(valor ?? '').replace(/[^0-9]/g, '');

/**
 * Deja SOLO los 10 dígitos de un teléfono mexicano.
 * Funciona igual escribiendo, pegando "+52 (614) 123-45-67" o autocompletando.
 */
export const telefonoMX = (valor = '') => {
  let d = soloDigitos(valor);
  if (d.length > 10 && d.startsWith('52')) d = d.slice(2);   // lada país pegada
  if (d.length > 10 && d.startsWith('1')) d = d.slice(1);    // +1 / formato viejo
  return d.slice(0, LIMITES.telefono);
};

/** '6141234567' -> '614 123 4567' (solo para mostrar) */
export const formatearTelefono = (valor = '') => {
  const d = telefonoMX(valor);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
};

/**
 * Convierte cualquier input a número seguro.
 * Bloquea 'e', 'E', '+', '-', Infinity y NaN — los tres culpables de que
 * un <input type="number"> deje pasar basura como "1e99".
 */
export const numeroSeguro = (valor, { min = 0, max = Number.MAX_SAFE_INTEGER, decimales = 2 } = {}) => {
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor ?? '').replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return min > 0 ? min : 0;
  const acotado = Math.min(max, Math.max(min, n));
  const f = 10 ** decimales;
  return Math.round(acotado * f) / f;
};

/**
 * Sanea lo que el usuario TECLEA en un campo numérico, conservando el texto
 * a medio escribir ("12." mientras sigue escribiendo) pero sin permitir
 * notación científica ni signos.
 */
export const entradaNumerica = (valor = '', { decimales = true, maxEnteros = 9 } = {}) => {
  let v = String(valor ?? '').replace(/[^0-9.]/g, '');
  if (!decimales) return v.replace(/\./g, '').slice(0, maxEnteros);
  const partes = v.split('.');
  const enteros = partes.shift().slice(0, maxEnteros);
  return partes.length ? `${enteros}.${partes.join('').slice(0, 2)}` : enteros;
};

/** Handler listo para onKeyDown de inputs numéricos. */
export const bloquearTeclasNumericas = (e) => {
  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
};

/* ══════════════ Identificadores fiscales ══════════════ */

export const limpiarAlfanumerico = (valor = '', limite = 20) =>
  String(valor ?? '').toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, limite);

export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
export const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

/* ══════════════ Fechas locales (sin corrimiento UTC) ══════════════ */

export const fechaLocalISO = (fecha = new Date()) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

export const obtenerLunesLocal = (fecha = new Date()) => {
  const lunes = new Date(fecha);
  lunes.setHours(12, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
};

export const sumarDiasLocal = (fechaISO, cantidad) => {
  const fecha = new Date(`${fechaISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + cantidad);
  return fechaLocalISO(fecha);
};

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const esFechaValida = (iso) => {
  if (!FECHA_RE.test(String(iso || ''))) return false;
  const d = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(d.getTime()) && fechaLocalISO(d) === iso;
};

/* ══════════════ Control de abuso en el cliente ══════════════ */

/**
 * Ventana deslizante guardada en localStorage.
 * Primera línea de defensa contra "too many requests": evita que un botón
 * (login, recuperar, invitar) dispare decenas de peticiones en segundos.
 * NO sustituye el rate limit del servidor — ver sql/02_rate_limit.sql.
 */
export const puedeIntentar = (clave, maximo, ventanaMs) => {
  const ahora = Date.now();
  let registros = [];
  try {
    registros = JSON.parse(localStorage.getItem(clave) || '[]');
  } catch {
    registros = [];
  }
  registros = Array.isArray(registros) ? registros.filter(t => ahora - t < ventanaMs) : [];

  if (registros.length >= maximo) {
    return { permitido: false, esperaMs: ventanaMs - (ahora - registros[0]) };
  }
  registros.push(ahora);
  try { localStorage.setItem(clave, JSON.stringify(registros)); } catch { /* modo privado */ }
  return { permitido: true, esperaMs: 0 };
};

export const limpiarIntentos = (clave) => {
  try { localStorage.removeItem(clave); } catch { /* noop */ }
};

export const formatearEspera = (ms) => {
  const segundos = Math.max(1, Math.ceil(ms / 1000));
  return segundos < 60 ? `${segundos} segundos` : `${Math.ceil(segundos / 60)} minutos`;
};

/** Políticas por acción — un solo lugar para ajustarlas. */
export const POLITICAS = {
  login:            { clave: 'rl_login',    max: 6,  ventana: 5 * 60_000 },
  recuperar:        { clave: 'rl_recover',  max: 3,  ventana: 15 * 60_000 },
  cambiarPassword:  { clave: 'rl_pass',     max: 5,  ventana: 15 * 60_000 },
  crearCuenta:      { clave: 'rl_signup',   max: 5,  ventana: 30 * 60_000 },
  oauth:            { clave: 'rl_oauth',    max: 8,  ventana: 5 * 60_000 },
  escritura:        { clave: 'rl_write',    max: 60, ventana: 60_000 },
};

/** Envuelve una acción con su política. Devuelve null si está permitido, o el mensaje de espera. */
export const verificarPolitica = (nombre) => {
  const p = POLITICAS[nombre];
  if (!p) return null;
  const r = puedeIntentar(p.clave, p.max, p.ventana);
  return r.permitido ? null : `Demasiados intentos. Vuelve a intentarlo en ${formatearEspera(r.esperaMs)}.`;
};

/* ══════════════ Utilidades varias ══════════════ */

/** Antirrebote genérico para búsquedas y autoguardado. */
export function debounce(fn, ms = 350) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/** Valida una imagen antes de convertirla a base64. */
export const validarImagen = (file) => {
  const permitidos = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!file) return 'No se seleccionó ningún archivo.';
  if (!permitidos.includes(file.type)) return 'Formato no permitido. Usa PNG, JPG o WEBP.';
  if (file.type === 'image/svg+xml') return 'Los SVG no se permiten por seguridad. Usa PNG o JPG.';
  if (file.size > LIMITES.maxImagenBytes) return 'La imagen debe pesar menos de 800 KB. Comprímela primero.';
  return null;
};

/** Escapa texto que se inserta en un href (mailto/tel/wa.me). */
export const urlSegura = (url = '') => {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
};
