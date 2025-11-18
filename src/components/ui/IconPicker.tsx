import { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import type { IconName } from '../../utils/iconSuggestions';
import { popularIcons, getIconComponent, isValidIconName } from '../../utils/iconSuggestions';

interface IconPickerProps {
  value: IconName;
  color: string;
  onIconChange: (icon: IconName) => void;
  onColorChange: (color: string) => void;
  suggestedIcon?: IconName;
  label?: string;
}

const predefinedColors = [
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

export function IconPicker({
  value,
  color,
  onIconChange,
  onColorChange,
  suggestedIcon,
  label = 'Icono y Color',
}: IconPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllIcons, setShowAllIcons] = useState(false);

  const allIconNames = useMemo(() => {
    const icons = Object.keys(LucideIcons).filter((key) => {
      const component = (LucideIcons as any)[key];
      // Lucide icons are React forwardRef objects, not functions
      return component &&
             typeof component === 'object' &&
             component.$$typeof &&
             key !== 'createLucideIcon' &&
             key !== 'default' &&
             !key.startsWith('_');
    });

    if (icons.length === 0) {
      console.error('No icons found in lucide-react. This should not happen.');
    } else {
      console.log(`Loaded ${icons.length} icons from lucide-react`);
    }

    return icons;
  }, []);

  const filteredIcons = useMemo(() => {
    if (!searchTerm) {
      return showAllIcons ? allIconNames : popularIcons;
    }

    const term = searchTerm.toLowerCase();
    return allIconNames.filter((iconName) =>
      iconName.toLowerCase().includes(term)
    );
  }, [searchTerm, showAllIcons, allIconNames]);

  const displayIcons = useMemo(() => {
    const icons = [...filteredIcons];

    if (suggestedIcon && !searchTerm && icons.includes(suggestedIcon)) {
      const index = icons.indexOf(suggestedIcon);
      icons.splice(index, 1);
      icons.unshift(suggestedIcon);
    }

    return icons.slice(0, showAllIcons ? 200 : 48);
  }, [filteredIcons, suggestedIcon, searchTerm, showAllIcons]);

  const SelectedIcon = getIconComponent(value);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>

        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div
            className="w-16 h-16 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: color }}
          >
            {SelectedIcon && <SelectedIcon className="w-8 h-8 text-white" />}
          </div>

          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Previsualización</p>
            <p className="text-xs text-gray-500">{value}</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-12 h-12 rounded cursor-pointer border-2 border-gray-300"
              title="Seleccionar color personalizado"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {predefinedColors.map((predefColor) => (
            <button
              key={predefColor}
              type="button"
              onClick={() => onColorChange(predefColor)}
              className={`w-8 h-8 rounded-lg transition-all ${
                color === predefColor
                  ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: predefColor }}
              title={predefColor}
            />
          ))}
        </div>
      </div>

      <div>
        <Input
          placeholder="Buscar icono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      <div className="border border-gray-200 rounded-lg p-3 bg-white max-h-80 overflow-y-auto">
        {suggestedIcon && !searchTerm && (
          <div className="mb-3 pb-3 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Sugerido</p>
            <div className="flex flex-wrap gap-2">
              <IconButton
                iconName={suggestedIcon}
                color={color}
                isSelected={value === suggestedIcon}
                onClick={() => onIconChange(suggestedIcon)}
                isHighlighted
              />
            </div>
          </div>
        )}

        <p className="text-xs font-medium text-gray-500 uppercase mb-2">
          {searchTerm ? 'Resultados' : showAllIcons ? 'Todos los iconos' : 'Iconos populares'}
        </p>

        <div className="grid grid-cols-8 gap-2">
          {displayIcons.map((iconName) => (
            <IconButton
              key={iconName}
              iconName={iconName}
              color={color}
              isSelected={value === iconName}
              onClick={() => onIconChange(iconName)}
            />
          ))}
        </div>

        {!searchTerm && !showAllIcons && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAllIcons(true)}
              className="w-full text-sm"
            >
              Ver todos los iconos ({allIconNames.length})
            </Button>
          </div>
        )}

        {displayIcons.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No se encontraron iconos</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface IconButtonProps {
  iconName: IconName;
  color: string;
  isSelected: boolean;
  onClick: () => void;
  isHighlighted?: boolean;
}

function IconButton({ iconName, color, isSelected, onClick, isHighlighted }: IconButtonProps) {
  const IconComponent = getIconComponent(iconName);

  if (!IconComponent) {
    console.warn(`Icon component not found for: ${iconName}`);
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative w-full aspect-square rounded-lg flex items-center justify-center
        transition-all group
        ${isSelected
          ? 'ring-2 ring-offset-2 scale-105'
          : 'hover:scale-105 border border-gray-200'
        }
        ${isHighlighted ? 'ring-2 ring-amber-400' : ''}
      `}
      style={{
        backgroundColor: isSelected ? color : '#F9FAFB',
        borderColor: isSelected ? color : undefined,
      }}
      title={iconName}
    >
      <IconComponent
        className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`}
      />

      {!isSelected && (
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-10 transition-opacity"
          style={{ backgroundColor: color }}
        />
      )}
    </button>
  );
}
