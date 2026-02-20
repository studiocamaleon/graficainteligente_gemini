import { ReactNode, useState, useEffect } from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';

interface CollapsibleFiltersProps {
  children: ReactNode;
  storageKey?: string;
  activeFiltersCount?: number;
  title?: string;
  defaultCollapsed?: boolean;
  onReset?: () => void;
  variant?: 'default' | 'enterprise';
  className?: string;
}

export function CollapsibleFilters({
  children,
  storageKey = 'filters-collapsed',
  activeFiltersCount = 0,
  title = 'Filtros avanzados',
  defaultCollapsed = true,
  onReset,
  variant = 'default',
  className = '',
}: CollapsibleFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? stored === 'true' : defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isCollapsed));
  }, [defaultCollapsed, isCollapsed, storageKey]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const buttonClassName =
    variant === 'enterprise'
      ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
      : 'border-gray-300 text-gray-700 hover:bg-gray-50';
  const panelClassName =
    variant === 'enterprise'
      ? 'rounded-xl border border-slate-200 bg-slate-50/80 p-4'
      : '';

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={toggleCollapse}
          className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium transition-colors ${buttonClassName}`}
        >
          {isCollapsed ? <Filter className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{isCollapsed ? `${title}: mostrar` : `${title}: ocultar`}</span>
          {isCollapsed && activeFiltersCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>
        {!isCollapsed && onReset && activeFiltersCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
        }`}
      >
        <div className={`space-y-4 ${panelClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
