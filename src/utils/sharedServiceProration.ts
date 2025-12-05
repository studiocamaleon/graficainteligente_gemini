import type { MetodoProrrateo } from '../hooks/useServiciosAcabadosCompartidos';

export interface ItemForProration {
  id: string;
  precio_unitario: number;
  cantidad: number;
  precio_total: number;
}

export interface ProrationResult {
  itemId: string;
  montoProrrateado: number;
  porcentaje: number;
}

export interface CalculateProrationParams {
  items: ItemForProration[];
  costoTotal: number;
  metodo: MetodoProrrateo;
  prorrateoManual?: Record<string, number>;
}

export function calculateSharedServiceProration({
  items,
  costoTotal,
  metodo,
  prorrateoManual
}: CalculateProrationParams): Record<string, number> {
  if (items.length === 0) {
    return {};
  }

  if (costoTotal <= 0) {
    return items.reduce((acc, item) => {
      acc[item.id] = 0;
      return acc;
    }, {} as Record<string, number>);
  }

  switch (metodo) {
    case 'proporcional':
      return calculateProportionalProration(items, costoTotal);

    case 'uniforme':
      return calculateUniformProration(items, costoTotal);

    case 'manual':
      if (!prorrateoManual) {
        console.warn('Método manual seleccionado pero no se proporcionó prorrateoManual, usando proporcional');
        return calculateProportionalProration(items, costoTotal);
      }
      return validateAndNormalizeManualProration(items, costoTotal, prorrateoManual);

    default:
      console.warn(`Método de prorrateo desconocido: ${metodo}, usando proporcional`);
      return calculateProportionalProration(items, costoTotal);
  }
}

function calculateProportionalProration(
  items: ItemForProration[],
  costoTotal: number
): Record<string, number> {
  const totalOrden = items.reduce((sum, item) => sum + item.precio_total, 0);

  if (totalOrden === 0) {
    return calculateUniformProration(items, costoTotal);
  }

  const prorrateos: Record<string, number> = {};
  let sumaAcumulada = 0;

  items.forEach((item, index) => {
    if (index === items.length - 1) {
      prorrateos[item.id] = parseFloat((costoTotal - sumaAcumulada).toFixed(2));
    } else {
      const proporcion = item.precio_total / totalOrden;
      const montoProrrateado = parseFloat((costoTotal * proporcion).toFixed(2));
      prorrateos[item.id] = montoProrrateado;
      sumaAcumulada += montoProrrateado;
    }
  });

  return prorrateos;
}

function calculateUniformProration(
  items: ItemForProration[],
  costoTotal: number
): Record<string, number> {
  const costoPorItem = costoTotal / items.length;
  const costoRedondeado = parseFloat(costoPorItem.toFixed(2));

  const prorrateos: Record<string, number> = {};
  let sumaAcumulada = 0;

  items.forEach((item, index) => {
    if (index === items.length - 1) {
      prorrateos[item.id] = parseFloat((costoTotal - sumaAcumulada).toFixed(2));
    } else {
      prorrateos[item.id] = costoRedondeado;
      sumaAcumulada += costoRedondeado;
    }
  });

  return prorrateos;
}

function validateAndNormalizeManualProration(
  items: ItemForProration[],
  costoTotal: number,
  prorrateoManual: Record<string, number>
): Record<string, number> {
  const prorrateos: Record<string, number> = {};

  items.forEach(item => {
    const monto = prorrateoManual[item.id];
    if (typeof monto === 'number' && monto >= 0) {
      prorrateos[item.id] = parseFloat(monto.toFixed(2));
    } else {
      prorrateos[item.id] = 0;
    }
  });

  const sumaTotal = Object.values(prorrateos).reduce((sum, val) => sum + val, 0);
  const diferencia = Math.abs(sumaTotal - costoTotal);

  if (diferencia > 0.01) {
    console.warn(
      `La suma del prorrateo manual (${sumaTotal}) no coincide con el costo total (${costoTotal}). ` +
      `Diferencia: ${diferencia}`
    );
  }

  return prorrateos;
}

export function getProrationDetails(
  items: ItemForProration[],
  prorrateos: Record<string, number>
): ProrationResult[] {
  const total = Object.values(prorrateos).reduce((sum, val) => sum + val, 0);

  return items.map(item => {
    const montoProrrateado = prorrateos[item.id] || 0;
    const porcentaje = total > 0 ? (montoProrrateado / total) * 100 : 0;

    return {
      itemId: item.id,
      montoProrrateado,
      porcentaje: parseFloat(porcentaje.toFixed(2))
    };
  });
}

export function recalculateProration(
  items: ItemForProration[],
  currentProration: Record<string, number>,
  costoTotal: number,
  metodo: MetodoProrrateo
): Record<string, number> {
  const currentItemIds = new Set(items.map(i => i.id));

  const validProration: Record<string, number> = {};
  Object.entries(currentProration).forEach(([itemId, monto]) => {
    if (currentItemIds.has(itemId)) {
      validProration[itemId] = monto;
    }
  });

  const itemsWithProration = items.filter(item => item.id in validProration);
  const itemsWithoutProration = items.filter(item => !(item.id in validProration));

  if (itemsWithoutProration.length === 0) {
    return validProration;
  }

  const sumaActual = Object.values(validProration).reduce((sum, val) => sum + val, 0);
  const costoRestante = Math.max(0, costoTotal - sumaActual);

  const nuevoProrrateo = calculateSharedServiceProration({
    items: itemsWithoutProration,
    costoTotal: costoRestante,
    metodo,
  });

  return {
    ...validProration,
    ...nuevoProrrateo
  };
}

export function formatProrationForDisplay(
  monto: number,
  porcentaje: number
): string {
  return `$${monto.toFixed(2)} (${porcentaje.toFixed(1)}%)`;
}
