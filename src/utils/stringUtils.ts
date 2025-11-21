export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function stringsMatch(str1: string, str2: string): boolean {
  return normalizeString(str1) === normalizeString(str2);
}

export function formatCurrency(value: number): string {
  const roundedValue = Math.round(value * 100) / 100;

  const [integerPart, decimalPart] = roundedValue.toFixed(2).split('.');

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (decimalPart === '00') {
    return `$ ${formattedInteger}`;
  }

  return `$ ${formattedInteger},${decimalPart}`;
}

export function formatNumber(value: number, maxDecimals: number = 2): string {
  const rounded = Math.round(value * Math.pow(10, maxDecimals)) / Math.pow(10, maxDecimals);

  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }

  return rounded.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

export function formatMaterialName(
  materialNombre: string,
  varianteNombre: string,
  espesor?: number | number[],
  unidadEspesor?: string
): string {
  let formatted = `${materialNombre} - ${varianteNombre}`;

  if (espesor !== undefined && espesor !== null && unidadEspesor) {
    if (Array.isArray(espesor)) {
      if (espesor.length > 0) {
        formatted += ` - ${espesor.map(e => `${e}${unidadEspesor}`).join(', ')}`;
      }
    } else {
      formatted += ` - ${espesor}${unidadEspesor}`;
    }
  }

  return formatted;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return 'Fecha inválida';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
