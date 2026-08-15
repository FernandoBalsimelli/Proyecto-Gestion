// Cliente de datos para la API propia. Mantiene la sintaxis usada por las pantallas.
const BASE_API = import.meta.env.VITE_API_BASE_URL || '';

const normalizarError = (body, status) => body?.error || ({ message: status === 401 ? 'Tu sesión expiró. Inicia sesión de nuevo.' : 'No fue posible comunicarte con la API.', code: String(status), details: null, hint: null });

export function crearClienteDatos(obtenerToken) {
  async function solicitar(cuerpo) {
    const token = await obtenerToken();
    const respuesta = await fetch(`${BASE_API}/api/data`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(cuerpo) });
    let body;
    try { body = await respuesta.json(); } catch { body = null; }
    return respuesta.ok ? body : { data: null, count: null, error: normalizarError(body, respuesta.status) };
  }
  class Consulta {
    constructor(tabla) { this.tabla = tabla; this.operacion = 'select'; this.columnas = '*'; this.payload = undefined; this.filtros = []; this.ordenes = []; this.limite = undefined; this.rango = undefined; this.opciones = {}; }
    select(columnas = '*', opciones = {}) { if (this.operacion === 'select') { this.columnas = columnas; this.opciones = { ...this.opciones, ...opciones }; } else this.opciones.retorno = columnas; return this; }
    insert(payload) { this.operacion = 'insert'; this.payload = payload; return this; }
    update(payload) { this.operacion = 'update'; this.payload = payload; return this; }
    upsert(payload, opciones = {}) { this.operacion = 'upsert'; this.payload = payload; this.opciones = { ...this.opciones, ...opciones }; return this; }
    delete() { this.operacion = 'delete'; return this; }
    filtro(metodo, campo, ...valores) { this.filtros.push({ metodo, campo, valores }); return this; }
    eq(campo, valor) { return this.filtro('eq', campo, valor); } neq(campo, valor) { return this.filtro('neq', campo, valor); }
    gt(campo, valor) { return this.filtro('gt', campo, valor); } gte(campo, valor) { return this.filtro('gte', campo, valor); }
    lt(campo, valor) { return this.filtro('lt', campo, valor); } lte(campo, valor) { return this.filtro('lte', campo, valor); }
    in(campo, valores) { return this.filtro('in', campo, valores); } is(campo, valor) { return this.filtro('is', campo, valor); }
    not(campo, operador, valor) { return this.filtro('not', campo, operador, valor); }
    order(campo, opciones = {}) { this.ordenes.push({ campo, ...opciones }); return this; }
    limit(valor) { this.limite = valor; return this; } range(desde, hasta) { this.rango = [desde, hasta]; return this; }
    single() { this.opciones.uno = 'single'; return this; } maybeSingle() { this.opciones.uno = 'maybeSingle'; return this; }
    ejecutar() { return solicitar({ tabla: this.tabla, operacion: this.operacion, columnas: this.columnas, payload: this.payload, filtros: this.filtros, ordenes: this.ordenes, limite: this.limite, rango: this.rango, opciones: this.opciones }); }
    then(resolver, rechazar) { return this.ejecutar().then(resolver, rechazar); }
  }
  return { from: tabla => new Consulta(tabla) };
}
