import { ReactNode } from 'react';
import { CollapsibleFilters } from '../../ui/CollapsibleFilters';

interface AdvancedFiltersPanelProps {
  storageKey: string;
  activeFiltersCount: number;
  onReset: () => void;
  children: ReactNode;
}

export function AdvancedFiltersPanel({
  storageKey,
  activeFiltersCount,
  onReset,
  children,
}: AdvancedFiltersPanelProps) {
  return (
    <CollapsibleFilters
      storageKey={storageKey}
      activeFiltersCount={activeFiltersCount}
      onReset={onReset}
      defaultCollapsed
      variant="enterprise"
      title="Filtros avanzados"
    >
      {children}
    </CollapsibleFilters>
  );
}
