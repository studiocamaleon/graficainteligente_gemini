import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type IconName = string;

interface IconSuggestion {
  icon: IconName;
  color: string;
}

const iconKeywordMap: Record<string, IconName> = {
  'señalética': 'SignpostBig',
  'señaletica': 'SignpostBig',
  'señal': 'SignpostBig',
  'cartel': 'SquareMenu',
  'banner': 'Flag',
  'poster': 'FileImage',

  'impresión': 'Printer',
  'impresion': 'Printer',
  'imprenta': 'Printer',
  'impreso': 'Printer',
  'print': 'Printer',

  'diseño': 'Palette',
  'diseño gráfico': 'Paintbrush',
  'gráfico': 'Image',
  'grafico': 'Image',
  'creatividad': 'Lightbulb',
  'creativo': 'Lightbulb',

  'papelería': 'FileText',
  'papeleria': 'FileText',
  'papel': 'FileText',
  'tarjeta': 'CreditCard',
  'tarjetas': 'CreditCard',
  'business card': 'CreditCard',

  'publicidad': 'Megaphone',
  'marketing': 'TrendingUp',
  'propaganda': 'Radio',
  'promoción': 'Gift',
  'promocion': 'Gift',

  'empaque': 'Package',
  'embalaje': 'PackageOpen',
  'caja': 'Box',
  'packaging': 'Package',

  'etiqueta': 'Tag',
  'sticker': 'Sticker',
  'adhesivo': 'Sticker',
  'calcomanía': 'Sticker',
  'calcomania': 'Sticker',

  'folleto': 'BookOpen',
  'brochure': 'BookOpen',
  'catálogo': 'Book',
  'catalogo': 'Book',
  'revista': 'BookMarked',

  'vinilo': 'Film',
  'vinyl': 'Film',
  'ploteo': 'Layers',
  'corte': 'Scissors',

  'digital': 'Monitor',
  'web': 'Globe',
  'online': 'Wifi',
  'social': 'Share2',
  'redes': 'Network',

  'textil': 'Shirt',
  'tela': 'Shirt',
  'ropa': 'Shirt',
  'prenda': 'Shirt',

  'foto': 'Camera',
  'fotografía': 'Camera',
  'fotografia': 'Camera',
  'imagen': 'ImageIcon',

  'evento': 'Calendar',
  'conferencia': 'Users',
  'exposición': 'LayoutGrid',
  'exposicion': 'LayoutGrid',

  'arquitectónico': 'Building',
  'arquitectonico': 'Building',
  'plano': 'MapPin',
  'blueprint': 'FileSearch',

  'regalo': 'Gift',
  'corporativo': 'Briefcase',
  'empresarial': 'Building2',

  'vehículo': 'Car',
  'vehiculo': 'Car',
  'auto': 'Car',
  'flota': 'Truck',
};

const colorPalette = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#A855F7', // purple
];

function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateColorFromString(str: string): string {
  const hash = stringToHash(str);
  return colorPalette[hash % colorPalette.length];
}

export function suggestIconForCategory(categoryName: string): IconSuggestion {
  const normalizedName = categoryName.toLowerCase().trim();

  for (const [keyword, icon] of Object.entries(iconKeywordMap)) {
    if (normalizedName.includes(keyword)) {
      return {
        icon,
        color: generateColorFromString(categoryName),
      };
    }
  }

  return {
    icon: 'Tag',
    color: generateColorFromString(categoryName),
  };
}

export const popularIcons: IconName[] = [
  'Tag',
  'Printer',
  'Palette',
  'FileText',
  'Megaphone',
  'Package',
  'Sticker',
  'BookOpen',
  'Image',
  'Camera',
  'SignpostBig',
  'Flag',
  'Box',
  'Layers',
  'Shirt',
  'Gift',
  'Calendar',
  'Building',
  'Car',
  'Monitor',
  'Globe',
  'CreditCard',
  'Scissors',
  'Paintbrush',
  'Film',
];

export function getIconComponent(iconName: IconName): LucideIcon | null {
  const IconComponent = (LucideIcons as any)[iconName];
  if (IconComponent && typeof IconComponent === 'function') {
    return IconComponent as LucideIcon;
  }
  return null;
}

export function isValidIconName(iconName: string): boolean {
  const component = (LucideIcons as any)[iconName];
  // Lucide icons are React forwardRef objects, not functions
  return component && typeof component === 'object' && component.$$typeof && iconName !== 'createLucideIcon';
}
