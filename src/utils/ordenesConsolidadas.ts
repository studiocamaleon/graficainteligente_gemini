/**
 * Utilidades para gestionar órdenes de trabajo con órdenes de copiado asociadas
 * Incluye cálculos de totales consolidados y distribución de pagos
 */

export interface TotalesConsolidados {
  subtotalItems: number;
  subtotalOrdenesCopiado: number;
  subtotalTotal: number;
  descuentos: number;
  subtotalConDescuentos: number;
  iva: number;
  totalFinal: number;
}

export interface OrdenCopiado {
  id: string;
  numero_orden: string;
  estado: string;
  total: number;
}

export interface Pago {
  id: string;
  monto: number;
  fecha_pago: string;
}

/**
 * Calcula los totales consolidados de una orden de trabajo incluyendo su orden de copiado
 * @param subtotalOT Subtotal de la orden de trabajo (solo items propios)
 * @param descuentosOT Descuentos aplicados en la OT
 * @param totalOC Total de la orden de copiado asociada (0 si no hay)
 * @param aplicarIVA Si debe aplicarse IVA (21%)
 * @returns Objeto con todos los totales calculados
 */
export function calcularTotalesConsolidados(
  subtotalOT: number,
  descuentosOT: number,
  totalOC: number,
  aplicarIVA: boolean = false
): TotalesConsolidados {
  const subtotalTotal = Number((subtotalOT + totalOC).toFixed(2));
  const subtotalConDescuentos = Number((subtotalTotal - descuentosOT).toFixed(2));
  const iva = aplicarIVA ? Number((subtotalConDescuentos * 0.21).toFixed(2)) : 0;
  const totalFinal = Number((subtotalConDescuentos + iva).toFixed(2));

  return {
    subtotalItems: Number(subtotalOT.toFixed(2)),
    subtotalOrdenesCopiado: Number(totalOC.toFixed(2)),
    subtotalTotal,
    descuentos: Number(descuentosOT.toFixed(2)),
    subtotalConDescuentos,
    iva,
    totalFinal,
  };
}

/**
 * Calcula el saldo pendiente de una orden considerando los pagos realizados
 * @param totales Totales consolidados de la orden
 * @param pagos Array de pagos realizados
 * @returns Saldo pendiente
 */
export function calcularSaldoPendiente(
  totales: TotalesConsolidados,
  pagos: Pago[]
): number {
  const totalPagado = Number(pagos.reduce((sum, pago) => sum + Number(pago.monto), 0).toFixed(2));
  return Math.max(0, Number((totales.totalFinal - totalPagado).toFixed(2)));
}

/**
 * Calcula el total pagado de un array de pagos
 * @param pagos Array de pagos
 * @returns Total pagado
 */
export function calcularTotalPagado(pagos: Pago[]): number {
  return Number(pagos.reduce((sum, pago) => sum + Number(pago.monto), 0).toFixed(2));
}

/**
 * Distribuye los pagos proporcionalmente entre la OT y la OC según sus totales
 * Útil al desvincular una OC de una OT
 * @param totalOT Total de la orden de trabajo (sin OC)
 * @param totalOC Total de la orden de copiado
 * @param pagos Pagos realizados sobre el total consolidado
 * @returns Objeto con pagos distribuidos para OT y OC
 */
export function distribuirPagosProporcional(
  totalOT: number,
  totalOC: number,
  pagos: Pago[]
): {
  pagosOT: Array<Pago & { montoOriginal: number }>;
  pagosOC: Array<Pago & { montoOriginal: number }>;
  totalPagadoOT: number;
  totalPagadoOC: number;
} {
  const totalConsolidado = totalOT + totalOC;

  if (totalConsolidado === 0) {
    return {
      pagosOT: [],
      pagosOC: [],
      totalPagadoOT: 0,
      totalPagadoOC: 0,
    };
  }

  // Calcular proporciones
  const proporcionOT = totalOT / totalConsolidado;
  const proporcionOC = totalOC / totalConsolidado;

  let totalPagadoOT = 0;
  let totalPagadoOC = 0;

  const pagosOT = pagos.map(pago => {
    const montoProporcional = Number(pago.monto) * proporcionOT;
    totalPagadoOT += montoProporcional;
    return {
      ...pago,
      monto: montoProporcional,
      montoOriginal: Number(pago.monto),
    };
  });

  const pagosOC = pagos.map(pago => {
    const montoProporcional = Number(pago.monto) * proporcionOC;
    totalPagadoOC += montoProporcional;
    return {
      ...pago,
      monto: montoProporcional,
      montoOriginal: Number(pago.monto),
    };
  });

  return {
    pagosOT,
    pagosOC,
    totalPagadoOT,
    totalPagadoOC,
  };
}

/**
 * Valida si una orden de copiado puede ser desvinculada de una orden de trabajo
 * @param ordenCopiado Orden de copiado a validar
 * @param tieneItemsEnProduccion Si la OC tiene items en producción
 * @returns Objeto con resultado de validación y mensaje
 */
export function validarDesvinculacion(
  ordenCopiado: OrdenCopiado | null,
  tieneItemsEnProduccion: boolean = false
): {
  valido: boolean;
  mensaje?: string;
} {
  if (!ordenCopiado) {
    return {
      valido: false,
      mensaje: 'No hay orden de copiado asociada',
    };
  }

  if (ordenCopiado.estado === 'cancelada') {
    return {
      valido: false,
      mensaje: 'No se puede desvincular una orden cancelada',
    };
  }

  if (tieneItemsEnProduccion) {
    return {
      valido: false,
      mensaje: 'No se puede desvincular mientras hay items en producción',
    };
  }

  return {
    valido: true,
  };
}

/**
 * Formatea un número como moneda
 * @param monto Monto a formatear
 * @param decimales Número de decimales (default: 2)
 * @returns String formateado como moneda
 */
export function formatearMoneda(monto: number, decimales: number = 2): string {
  return `$${Number(monto).toFixed(decimales)}`;
}

/**
 * Calcula el porcentaje que representa un monto del total
 * @param monto Monto parcial
 * @param total Total
 * @returns Porcentaje (0-100)
 */
export function calcularPorcentaje(monto: number, total: number): number {
  if (total === 0) return 0;
  return (monto / total) * 100;
}
