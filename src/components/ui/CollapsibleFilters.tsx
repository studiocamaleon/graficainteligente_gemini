import { ReactNode, useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';

interface CollapsibleFiltersProps {
  children: ReactNode;
  storageKey?: string;
  activeFiltersCount?: number;
}

export function CollapsibleFilters({
  children,
  storageKey = 'filters-collapsed',
  activeFiltersCount = 0
}: CollapsibleFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? stored === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isCollapsed));
  }, [isCollapsed, storageKey]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {isCollapsed ? <Filter className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span>{isCollapsed ? 'Mostrar Filtros' : 'Ocultar Filtros'}</span>
          {isCollapsed && activeFiltersCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
        }`}
      >
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
