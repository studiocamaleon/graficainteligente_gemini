export function normalizeText(input?: string | null): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeMedioKey(input?: string | null): string {
  const normalized = normalizeText(input);
  return normalized || 'sin-medio';
}

export function normalizeMedioLabel(input?: string | null): string {
  const value = (input || '').trim();
  return value || 'Sin medio';
}
