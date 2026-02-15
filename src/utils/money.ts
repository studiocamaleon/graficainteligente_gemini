export function toMoney(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function roundMoney(value: unknown): number {
  const n = toMoney(value);
  // Avoid floating point artifacts by rounding to 2 decimals in a stable way.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clampZeroMoney(value: unknown, tolerance = 0.01): number {
  const n = roundMoney(value);
  return Math.abs(n) <= tolerance ? 0 : n;
}

