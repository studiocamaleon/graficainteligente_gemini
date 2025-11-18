import { Palette } from 'lucide-react';
import type { ColorPlotter } from '../../../types/database';

interface ColorPlotterSelectorProps {
  value: ColorPlotter;
  onChange: (color: ColorPlotter) => void;
  error?: string;
}

const COLORES: { value: ColorPlotter; label: string }[] = [
  { value: 'Blanco', label: 'Blanco' },
  { value: 'Negro', label: 'Negro' },
  { value: 'Color', label: 'Color' },
  { value: 'Esmerilado Gris', label: 'Esmerilado Gris' },
  { value: 'Esmerilado Blanco', label: 'Esmerilado Blanco' },
  { value: 'Otro', label: 'Otro' },
];

export function ColorPlotterSelector({ value, onChange, error }: ColorPlotterSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Color
          <span className="text-red-500 ml-1">*</span>
        </div>
      </label>
      <p className="text-sm text-gray-500 mb-3">
        Selecciona el tipo de color del producto
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {COLORES.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            className={`relative rounded-lg border p-4 text-left transition-all duration-200 ${
              value === color.value
                ? 'border-pink-600 bg-pink-50 ring-2 ring-pink-600'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-medium ${
                  value === color.value ? 'text-pink-900' : 'text-gray-900'
                }`}
              >
                {color.label}
              </span>
              {value === color.value && (
                <div className="w-5 h-5 bg-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
