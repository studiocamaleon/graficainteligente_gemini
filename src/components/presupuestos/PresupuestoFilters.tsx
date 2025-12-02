import { useState, useEffect } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { CollapsibleFilters } from '../ui/CollapsibleFilters';
import { useClients } from '../../hooks/useClients';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import type { PresupuestosFilters as FiltersType } from '../../types/presupuestos';

interface PresupuestoFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  onReset: () => void;
}

export function PresupuestoFilters({
  filters,
  onFiltersChange,
  onReset,
}: PresupuestoFiltersProps) {
  const { clients } = useClients();
  const { teamMembers } = useTeamMembers();

  const [localFilters, setLocalFilters] = useState<FiltersType>(filters);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    const active =
      !!localFilters.estado ||
      !!localFilters.canal_venta ||
      !!localFilters.vendedor_id ||
      !!localFilters.cliente_id ||
      !!localFilters.fecha_desde ||
      !!localFilters.fecha_hasta ||
      !!localFilters.solo_vencidos ||
      !!localFilters.solo_pendientes_respuesta;
    setHasActiveFilters(active);
  }, [localFilters]);

  const handleFilterChange = (key: keyof FiltersType, value: any) => {
    const newFilters = { ...localFilters, [key]: value || undefined };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleReset = () => {
    const emptyFilters: FiltersType = {};
    setLocalFilters(emptyFilters);
    onReset();
  };

  const estadoOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'borrador', label: 'Borrador' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'enviado', label: 'Enviado' },
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'rechazado', label: 'Rechazado' },
    { value: 'convertido', label: 'Convertido' },
    { value: 'vencido', label: 'Vencido' },
  ];

  const canalOptions = [
    { value: '', label: 'Todos los canales' },
    { value: 'Web', label: 'Web' },
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'Mostrador', label: 'Mostrador' },
  ];

  const clienteOptions = [
    { value: '', label: 'Todos los clientes' },
    ...clients.map((client) => ({
      value: client.id,
      label: client.razon_social,
    })),
  ];

  const vendedorOptions = [
    { value: '', label: 'Todos los vendedores' },
    ...teamMembers
      .filter((member) => ['vendedor', 'admin', 'super_admin'].includes(member.role))
      .map((member) => ({
        value: member.id,
        label: member.full_name,
      })),
  ];

  return (
    <div className="space-y-4">
      {/* Búsqueda principal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar por número o cliente..."
          value={localFilters.search || ''}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="pl-10 pr-10"
        />
        {localFilters.search && (
          <button
            onClick={() => handleFilterChange('search', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtros colapsables */}
      <CollapsibleFilters
        isOpen={hasActiveFilters}
        onToggle={() => {}}
        filterCount={
          Object.values(localFilters).filter((v) => v !== undefined && v !== '').length
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <Select
              value={
                Array.isArray(localFilters.estado)
                  ? localFilters.estado[0] || ''
                  : localFilters.estado || ''
              }
              onChange={(e) => handleFilterChange('estado', e.target.value)}
              options={estadoOptions}
            />
          </div>

          {/* Canal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Canal de venta
            </label>
            <Select
              value={
                Array.isArray(localFilters.canal_venta)
                  ? localFilters.canal_venta[0] || ''
                  : localFilters.canal_venta || ''
              }
              onChange={(e) => handleFilterChange('canal_venta', e.target.value)}
              options={canalOptions}
            />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <Select
              value={localFilters.cliente_id || ''}
              onChange={(e) => handleFilterChange('cliente_id', e.target.value)}
              options={clienteOptions}
            />
          </div>

          {/* Vendedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendedor
            </label>
            <Select
              value={localFilters.vendedor_id || ''}
              onChange={(e) => handleFilterChange('vendedor_id', e.target.value)}
              options={vendedorOptions}
            />
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desde
            </label>
            <Input
              type="date"
              value={localFilters.fecha_desde || ''}
              onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hasta
            </label>
            <Input
              type="date"
              value={localFilters.fecha_hasta || ''}
              onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
            />
          </div>

          {/* Filtros rápidos */}
          <div className="col-span-2 space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtros rápidos
            </label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localFilters.solo_vencidos || false}
                  onChange={(e) =>
                    handleFilterChange('solo_vencidos', e.target.checked || undefined)
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Solo vencidos</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localFilters.solo_pendientes_respuesta || false}
                  onChange={(e) =>
                    handleFilterChange(
                      'solo_pendientes_respuesta',
                      e.target.checked || undefined
                    )
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Pendientes de respuesta</span>
              </label>
            </div>
          </div>
        </div>

        {/* Acciones */}
        {hasActiveFilters && (
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button variant="secondary" size="sm" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        )}
      </CollapsibleFilters>
    </div>
  );
}
