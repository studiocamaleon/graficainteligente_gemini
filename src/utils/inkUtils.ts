export interface InkDisplayConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  colors: string[];
}

export type TintaType = 'K' | 'CMYK' | 'CMYK+W' | 'CMYK+V' | 'CMYK+W+V';

export function getInkDisplay(tipo: string): InkDisplayConfig {
  switch (tipo) {
    case 'K':
      return {
        label: 'K (Escala de Grises)',
        color: 'text-gray-900',
        bgColor: 'bg-gradient-to-r from-gray-50 to-gray-100',
        borderColor: 'border-gray-300',
        colors: ['#374151'],
      };
    case 'CMYK':
      return {
        label: 'CMYK (Full Color)',
        color: 'text-gray-900',
        bgColor: 'bg-gradient-to-r from-cyan-100 via-pink-100 via-yellow-100 to-gray-100',
        borderColor: 'border-cyan-300',
        colors: ['#06b6d4', '#ec4899', '#fbbf24', '#374151'],
      };
    case 'CMYK+W':
      return {
        label: 'CMYK + W (Color + Blanco)',
        color: 'text-gray-900',
        bgColor: 'bg-gradient-to-r from-cyan-100 via-pink-100 via-yellow-100 via-gray-100 to-white',
        borderColor: 'border-blue-300',
        colors: ['#06b6d4', '#ec4899', '#fbbf24', '#374151', '#ffffff'],
      };
    case 'CMYK+V':
      return {
        label: 'CMYK + V (Color + Barniz)',
        color: 'text-gray-900',
        bgColor: 'bg-gradient-to-r from-cyan-100 via-pink-100 via-yellow-100 via-gray-100 to-gray-200',
        borderColor: 'border-gray-400',
        colors: ['#06b6d4', '#ec4899', '#fbbf24', '#374151', 'VARNISH'],
      };
    case 'CMYK+W+V':
      return {
        label: 'CMYK + W + V (Completo)',
        color: 'text-gray-900',
        bgColor: 'bg-gradient-to-r from-cyan-100 via-pink-100 via-yellow-100 via-gray-100 via-white to-gray-200',
        borderColor: 'border-blue-400',
        colors: ['#06b6d4', '#ec4899', '#fbbf24', '#374151', '#ffffff', 'VARNISH'],
      };
    default:
      return {
        label: tipo,
        color: 'text-gray-900',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        colors: ['#6b7280'],
      };
  }
}

export function getInkColors(tipo: string): string[] {
  const config = getInkDisplay(tipo);
  return config.colors;
}

export function getInkLabel(tipo: string): string {
  const config = getInkDisplay(tipo);
  return config.label;
}
