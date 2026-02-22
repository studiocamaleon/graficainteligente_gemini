export function formatCurrencyARS(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return amount
    .toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00A0/g, ' ');
}
