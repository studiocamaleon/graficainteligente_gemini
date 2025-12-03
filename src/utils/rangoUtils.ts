export const INFINITE_RANGE_VALUE = 9999999.99;

export function normalizeRangoMax(max: number | null | undefined): number {
  if (max === null || max === undefined || max >= 999999) {
    return INFINITE_RANGE_VALUE;
  }
  return max;
}

export function normalizeRangoMin(min: number | null | undefined): number {
  if (min === null || min === undefined) {
    return 0;
  }
  return min;
}

export function isInfiniteRango(max: number): boolean {
  return max >= 999999;
}

export function formatRangoValue(min: number, max: number, unidadLabel: string): string {
  if (isInfiniteRango(max)) {
    return `${min}+ ${unidadLabel}`;
  }

  if (min === max) {
    return `${min} ${unidadLabel}`;
  }

  return `${min}-${max} ${unidadLabel}`;
}

export interface RangoDetalle {
  min: number;
  max: number | null;
}

export function findRangoForQuantity(
  cantidad: number,
  rangos: RangoDetalle[]
): RangoDetalle | null {
  const rangosOrdenados = [...rangos].sort((a, b) => a.min - b.min);

  for (let i = 0; i < rangosOrdenados.length; i++) {
    const rango = rangosOrdenados[i];
    const esUltimoRango = i === rangosOrdenados.length - 1;

    if (rango.max === null) {
      if (cantidad >= rango.min) return rango;
    }
    else if (esUltimoRango) {
      if (cantidad >= rango.min && cantidad <= rango.max) return rango;
    }
    else {
      if (cantidad >= rango.min && cantidad < rango.max) return rango;
    }
  }

  return null;
}
