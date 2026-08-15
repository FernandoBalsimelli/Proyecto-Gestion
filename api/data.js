import { createClient } from '@supabase/supabase-js';

const TABLAS_PERMITIDAS = new Set([
  'activos_negocio', 'agenda', 'almacen_articulos', 'almacen_movimientos',
  'almacen_proveedores', 'asistencia', 'checklists_operativas', 'clientes',
  'configuracion', 'empleado_pagos', 'empleados', 'gastos',
  'gastos_recurrentes', 'mantenimientos_activos', 'metas_negocio', 'miembros',
  'nomina_periodos', 'nomina_recibos', 'notas_negocio', 'oportunidades',
  'pagos', 'servicios', 'tareas_operativas', 'ventas',
]);
const OPERACIONES = new Set(['select', 'insert', 'update', 'upsert', 'delete']);
const METODOS_FILTRO = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not']);
const LIMITE_FILAS = 5000;

const responder = (res, status, body) => res.status(status).json(body);
const errorSeguro = (error) => ({ message: error?.message || 'No fue posible completar la solicitud.', code: error?.code || null, details: error?.details || null, hint: error?.hint || null });

function aplicarFiltros(query, filtros = []) {
  for (const filtro of filtros) {
    if (!filtro || !METODOS_FILTRO.has(filtro.metodo) || typeof filtro.campo !== 'string') continue;
    const valores = Array.isArray(filtro.valores) ? filtro.valores : [filtro.valor];
    query = query[filtro.metodo](filtro.campo, ...valores);
  }
  return query;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { error: { message: 'Método no permitido.' } });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return responder(res, 401, { error: { message: 'Sesión requerida.' } });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return responder(res, 500, { error: { message: 'Falta configurar Supabase en la API.' } });

  const { tabla, operacion, columnas = '*', payload, filtros = [], ordenes = [], limite, rango, opciones = {} } = req.body || {};
  if (!TABLAS_PERMITIDAS.has(tabla) || !OPERACIONES.has(operacion)) return responder(res, 400, { error: { message: 'Recurso no permitido.' } });
  if (!Array.isArray(filtros) || filtros.length > 30 || !Array.isArray(ordenes) || ordenes.length > 5) return responder(res, 400, { error: { message: 'La consulta excede los límites permitidos.' } });

  const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  let query = supabase.from(tabla);
  const seleccion = String(columnas).slice(0, 2000);
  const opcionesSelect = opciones.count || opciones.head ? { count: opciones.count, head: Boolean(opciones.head) } : undefined;
  if (operacion === 'select') query = query.select(seleccion, opcionesSelect);
  if (operacion === 'insert') query = query.insert(payload).select(String(opciones.retorno || columnas).slice(0, 2000));
  if (operacion === 'update') query = query.update(payload).select(String(opciones.retorno || columnas).slice(0, 2000));
  if (operacion === 'upsert') query = query.upsert(payload, { onConflict: opciones.onConflict, ignoreDuplicates: Boolean(opciones.ignoreDuplicates) }).select(String(opciones.retorno || columnas).slice(0, 2000));
  if (operacion === 'delete') query = query.delete().select(String(opciones.retorno || columnas).slice(0, 2000));
  query = aplicarFiltros(query, filtros);
  for (const orden of ordenes) if (orden?.campo && typeof orden.campo === 'string') query = query.order(orden.campo, { ascending: orden.ascending !== false, nullsFirst: orden.nullsFirst });
  if (Array.isArray(rango) && rango.length === 2) query = query.range(Math.max(0, rango[0]), Math.min(LIMITE_FILAS - 1, rango[1]));
  else query = query.limit(Math.min(Math.max(1, Number(limite) || LIMITE_FILAS), LIMITE_FILAS));
  if (opciones.uno === 'single') query = query.single();
  if (opciones.uno === 'maybeSingle') query = query.maybeSingle();
  const resultado = await query;
  if (resultado.error) return responder(res, 400, { data: null, count: resultado.count ?? null, error: errorSeguro(resultado.error) });
  return responder(res, 200, { data: resultado.data, count: resultado.count ?? null, error: null });
}
