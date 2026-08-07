export const PLANTILLAS = {
  clasico: {
    nombre: 'Clásico',
    desc: 'Tu diseño actual — encabezado con logo y tabla a rayas',
    color: '#16415e',
    tabla: 'striped',
    headerFill: true,
    bandaSuperior: false,
  },
  minimal: {
    nombre: 'Minimalista',
    desc: 'Sin rellenos, líneas finas, mucho espacio',
    color: '#1e293b',
    tabla: 'plain',
    headerFill: false,
    bandaSuperior: false,
  },
  corporativo: {
    nombre: 'Corporativo',
    desc: 'Banda de color superior, tabla con cuadrícula',
    color: '#0f766e',
    tabla: 'grid',
    headerFill: true,
    bandaSuperior: true,
  },
  moderno: {
    nombre: 'Moderno',
    desc: 'Bloque de color en el título y totales destacados',
    color: '#4f46e5',
    tabla: 'striped',
    headerFill: true,
    bandaSuperior: false,
    tituloEnCaja: true,
  },
};

export const hexToRgb = (hex) => {
  const n = parseInt((hex || '#16415e').replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};