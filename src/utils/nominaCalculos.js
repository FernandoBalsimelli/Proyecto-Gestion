/**
 * Cálculos de nómina bajo la Ley Federal del Trabajo de México
 * Tablas ISR y IMSS actualizadas 2024
 */

// ══════ UMA 2024 ══════
const UMA_DIARIO = 108.57;
const UMA_MENSUAL = UMA_DIARIO * 30.4;

// ══════ TABLA ISR MENSUAL 2024 ══════
const TABLA_ISR = [
  { limite_inf: 0.01,      limite_sup: 746.04,      cuota_fija: 0,        tasa: 1.92 },
  { limite_inf: 746.05,    limite_sup: 6332.05,     cuota_fija: 14.32,    tasa: 6.40 },
  { limite_inf: 6332.06,   limite_sup: 11128.01,    cuota_fija: 371.83,   tasa: 10.88 },
  { limite_inf: 11128.02,  limite_sup: 12935.82,    cuota_fija: 893.63,   tasa: 16.00 },
  { limite_inf: 12935.83,  limite_sup: 15487.71,    cuota_fija: 1182.88,  tasa: 17.92 },
  { limite_inf: 15487.72,  limite_sup: 31236.49,    cuota_fija: 1640.18,  tasa: 21.36 },
  { limite_inf: 31236.50,  limite_sup: 49233.00,    cuota_fija: 5004.12,  tasa: 23.52 },
  { limite_inf: 49233.01,  limite_sup: 93993.90,    cuota_fija: 9236.89,  tasa: 30.00 },
  { limite_inf: 93993.91,  limite_sup: 125325.20,   cuota_fija: 22665.17, tasa: 32.00 },
  { limite_inf: 125325.21, limite_sup: 375975.61,   cuota_fija: 32691.18, tasa: 34.00 },
  { limite_inf: 375975.62, limite_sup: 500000.00,   cuota_fija: 117912.32,tasa: 35.00 },
];

// ══════ SUBSIDIO AL EMPLEO MENSUAL ══════
const TABLA_SUBSIDIO = [
  { desde: 0.01,     hasta: 1768.96,  subsidio: 407.02 },
  { desde: 1768.97,  hasta: 2653.38,  subsidio: 406.83 },
  { desde: 2653.39,  hasta: 3472.84,  subsidio: 406.62 },
  { desde: 3472.85,  hasta: 3537.87,  subsidio: 392.77 },
  { desde: 3537.88,  hasta: 4446.15,  subsidio: 382.46 },
  { desde: 4446.16,  hasta: 4717.18,  subsidio: 354.23 },
  { desde: 4717.19,  hasta: 5335.42,  subsidio: 324.87 },
  { desde: 5335.43,  hasta: 6224.67,  subsidio: 294.63 },
  { desde: 6224.68,  hasta: 7113.90,  subsidio: 253.54 },
  { desde: 7113.91,  hasta: 7382.33,  subsidio: 217.61 },
  { desde: 7382.34,  hasta: Infinity, subsidio: 0 },
];

// ══════ CUOTAS IMSS OBRERA (% sobre SBC) ══════
const IMSS_OBRERA = {
  enfermedad_especie: 0.40,       // sobre excedente de 3 UMA
  invalidez_vida: 0.625,
  cesantia_vejez: 1.125,
  // Prestaciones en dinero y gastos médicos pensionados: 0.25% cada uno
  enfermedad_dinero: 0.25,
  gastos_medicos_pens: 0.375,
};

/**
 * Calcula el ISR mensual
 */
export function calcularISR(baseMensual) {
  if (baseMensual <= 0) return 0;
  
  const rango = TABLA_ISR.find(r => baseMensual >= r.limite_inf && baseMensual <= r.limite_sup);
  if (!rango) return 0;
  
  const excedente = baseMensual - rango.limite_inf;
  const isrBruto = rango.cuota_fija + (excedente * rango.tasa / 100);
  
  // Subsidio al empleo
  const sub = TABLA_SUBSIDIO.find(s => baseMensual >= s.desde && baseMensual <= s.hasta);
  const subsidio = sub ? sub.subsidio : 0;
  
  return Math.max(0, isrBruto - subsidio);
}

/**
 * Calcula cuota IMSS obrera
 * @param {number} salarioDiario - Salario base de cotización diario
 * @param {number} diasPeriodo - Días del periodo
 */
export function calcularIMSS(salarioDiario, diasPeriodo = 30) {
  if (salarioDiario <= 0) return 0;
  
  const sbc = salarioDiario; // Salario Base de Cotización
  const sbcMensual = sbc * diasPeriodo;
  
  // Excedente sobre 3 UMA para enfermedad en especie
  const excedente3UMA = Math.max(0, sbc - (3 * UMA_DIARIO));
  
  let cuota = 0;
  
  // Enfermedad y maternidad - prestaciones en especie (excedente)
  cuota += excedente3UMA * diasPeriodo * (IMSS_OBRERA.enfermedad_especie / 100);
  
  // Enfermedad y maternidad - prestaciones en dinero
  cuota += sbcMensual * (IMSS_OBRERA.enfermedad_dinero / 100);
  
  // Gastos médicos pensionados
  cuota += sbcMensual * (IMSS_OBRERA.gastos_medicos_pens / 100);
  
  // Invalidez y vida
  cuota += sbcMensual * (IMSS_OBRERA.invalidez_vida / 100);
  
  // Cesantía en edad avanzada y vejez
  cuota += sbcMensual * (IMSS_OBRERA.cesantia_vejez / 100);
  
  return Math.round(cuota * 100) / 100;
}

/**
 * Calcula Infonavit (descuento al trabajador si tiene crédito)
 */
export function calcularInfonavit(salarioDiario, diasPeriodo, tipo, valor) {
  if (!valor || valor <= 0) return 0;
  
  switch (tipo) {
    case 'porcentaje':
      return Math.round(salarioDiario * diasPeriodo * (valor / 100) * 100) / 100;
    case 'fijo':
      return valor;
    case 'vsm': // Veces Salario Mínimo
      return Math.round(valor * UMA_DIARIO * diasPeriodo / 30 * 100) / 100;
    default:
      return 0;
  }
}

/**
 * Calcula el séptimo día (descanso semanal proporcional)
 * Por cada 6 días trabajados se paga 1 de descanso
 */
export function calcularSeptimoDia(salarioDiario, diasTrabajados) {
  return Math.round((salarioDiario * diasTrabajados / 6) * 100) / 100;
}

/**
 * Calcula pago de horas extra
 * Primeras 9 hrs/semana = doble
 * Excedentes = triple
 */
export function calcularHorasExtra(salarioDiario, horasDoble, horasTriple) {
  const valorHora = salarioDiario / 8;
  const pagoDoble = horasDoble * valorHora * 2;
  const pagoTriple = horasTriple * valorHora * 3;
  return Math.round((pagoDoble + pagoTriple) * 100) / 100;
}

/**
 * Calcula nómina completa de un empleado para un periodo
 */
export function calcularNomina({
  salarioDiario,
  diasTrabajados,
  diasFalta = 0,
  horasExtraDoble = 0,
  horasExtraTriple = 0,
  bonos = 0,
  esAsegurado = false,
  infonavitCredito = false,
  infonavitTipo = 'porcentaje',
  infonavitDescuento = 0,
  otrasDeducciones = 0,
  diasPeriodo = 7, // semanal por defecto
}) {
  // PERCEPCIONES
  const salarioBase = salarioDiario * diasTrabajados;
  const septimoDia = calcularSeptimoDia(salarioDiario, diasTrabajados);
  const pagoHorasExtra = calcularHorasExtra(salarioDiario, horasExtraDoble, horasExtraTriple);
  
  const totalPercepciones = salarioBase + septimoDia + pagoHorasExtra + bonos;
  
  // DEDUCCIONES
  let deduccionIMSS = 0;
  let deduccionISR = 0;
  let deduccionInfonavit = 0;
  
  if (esAsegurado) {
    // Proporción mensual para cálculo
    const factorMensual = 30 / diasPeriodo;
    const baseMensualAprox = totalPercepciones * factorMensual;
    
    deduccionIMSS = calcularIMSS(salarioDiario, diasPeriodo);
    deduccionISR = Math.round(calcularISR(baseMensualAprox) / factorMensual * 100) / 100;
    
    if (infonavitCredito) {
      deduccionInfonavit = calcularInfonavit(salarioDiario, diasPeriodo, infonavitTipo, infonavitDescuento);
    }
  }
  
  const totalDeducciones = deduccionIMSS + deduccionISR + deduccionInfonavit + otrasDeducciones;
  const netoPagar = Math.round((totalPercepciones - totalDeducciones) * 100) / 100;
  
  return {
    // Percepciones
    salarioBase: Math.round(salarioBase * 100) / 100,
    septimoDia: Math.round(septimoDia * 100) / 100,
    pagoHorasExtra: Math.round(pagoHorasExtra * 100) / 100,
    bonos,
    totalPercepciones: Math.round(totalPercepciones * 100) / 100,
    // Deducciones
    deduccionIMSS,
    deduccionISR,
    deduccionInfonavit,
    otrasDeducciones,
    totalDeducciones: Math.round(totalDeducciones * 100) / 100,
    // Neto
    netoPagar: Math.max(0, netoPagar),
    // Info
    diasTrabajados,
    diasFalta,
    horasExtraDoble,
    horasExtraTriple,
  };
}

/**
 * Calcula aguinaldo (mínimo 15 días de salario)
 */
export function calcularAguinaldo(salarioDiario, diasTrabajadosAnio = 365, diasAguinaldo = 15) {
  const proporcional = (diasTrabajadosAnio / 365) * diasAguinaldo;
  return Math.round(salarioDiario * proporcional * 100) / 100;
}

/**
 * Calcula prima vacacional (25% del salario de vacaciones)
 */
export function calcularPrimaVacacional(salarioDiario, diasVacaciones = 12) {
  return Math.round(salarioDiario * diasVacaciones * 0.25 * 100) / 100;
}

export { UMA_DIARIO, UMA_MENSUAL };