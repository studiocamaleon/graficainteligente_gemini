import { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function MultiSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  error,
  required = false,
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = options.filter((option) => value.includes(option.value));

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue));
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div ref={containerRef} className="relative">
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            min-h-[42px] w-full px-3 py-2 border rounded-lg
            bg-white cursor-pointer transition-colors
            ${error ? 'border-red-300' : 'border-gray-300'}
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'hover:border-gray-400'}
            ${isOpen ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20' : ''}
          `}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                >
                  {option.label}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOption(option.value);
                      }}
                      className="hover:text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto max-h-48">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No se encontraron opciones</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      onClick={() => toggleOption(option.value)}
                      className={`
                        px-3 py-2 cursor-pointer transition-colors flex items-center justify-between
                        ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}
                      `}
                    >
                      <span className="text-sm">{option.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                  );
                })
              )}
            </div>

            {selectedOptions.length > 0 && (
              <div className="p-2 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Limpiar selección
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {selectedOptions.length > 0 && !error && (
        <p className="text-xs text-gray-500">
          {selectedOptions.length} categoría{selectedOptions.length !== 1 ? 's' : ''} seleccionada{selectedOptions.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
