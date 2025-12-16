import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Plus } from 'lucide-react';

interface SearchableSelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  onSearch?: (search: string) => void;
  loading?: boolean;
  allowCreate?: boolean;
  onCreateNew?: () => void;
  createLabel?: string;
  emptyMessage?: string;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  error,
  helperText,
  required,
  disabled,
  onSearch,
  loading,
  allowCreate,
  onCreateNew,
  createLabel = 'Crear nuevo',
  emptyMessage = 'No se encontraron resultados',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || '';

  const filteredOptions = onSearch
    ? options
    : options.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setDropdownPosition({
        top: rect.bottom + scrollTop,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside button (trigger)
      if (buttonRef.current && buttonRef.current.contains(event.target as Node)) {
        return;
      }
      // Check if click is inside dropdown (portal)
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
      setSearchTerm('');
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure portal is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (onSearch) {
      const timeoutId = setTimeout(() => {
        onSearch(searchTerm);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, onSearch]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
      }}
      className="mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-xl max-h-80 overflow-hidden"
    >
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-60">
        {loading ? (
          <div className="px-4 py-8 text-center text-slate-500">
            Cargando...
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`
                w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors
                ${option.value === value ? 'bg-blue-100' : ''}
              `}
            >
              <div className="flex flex-col">
                <span className={`font-medium ${option.value === value ? 'text-blue-700' : 'text-slate-900'}`}>
                  {option.label}
                </span>
                {option.subtitle && (
                  <span className={`text-xs ${option.value === value ? 'text-blue-600' : 'text-slate-500'}`}>
                    {option.subtitle}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {allowCreate && (
        <div className="border-t border-slate-200">
          <button
            type="button"
            onClick={handleCreateNew}
            className="w-full px-4 py-3 text-left text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            {createLabel}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-4 py-2.5 rounded-lg border-2 bg-white text-left
            flex items-center justify-between
            ${error
              ? 'border-red-500 focus:border-red-600 focus:ring-red-200'
              : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
            }
            ${disabled ? 'bg-slate-100 cursor-not-allowed' : 'cursor-pointer hover:border-slate-400'}
            focus:outline-none focus:ring-4
            transition-all duration-200
          `}
        >
          <span className={displayValue ? 'text-slate-900' : 'text-slate-400'}>
            {displayValue || placeholder}
          </span>
          <div className="flex items-center gap-2">
            {displayValue && !disabled && (
              <X
                className="w-4 h-4 text-slate-400 hover:text-slate-600"
                onClick={handleClear}
              />
            )}
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''
                }`}
            />
          </div>
        </button>

        {isOpen && createPortal(dropdownContent, document.body)}
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
    </div>
  );
}
