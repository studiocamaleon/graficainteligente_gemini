import { Filter, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useClients } from '../../hooks/useClients';

interface FacturasFiltersProps {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: string;
  estado: string;
  onFechaDesdeChange: (value: string) => void;
  onFechaHastaChange: (value: string) => void;
  onClienteChange: (value: string) => void;
  onEstadoChange: (value: string) => void;
  onClear: () => void;
}

export function FacturasFilters({
  fechaDesde,
  fechaHasta,
  clienteId,
  estado,
  onFechaDesdeChange,
  onFechaHastaChange,
  onClienteChange,
  onEstadoChange,
  onClear,
}: FacturasFiltersProps) {
  const { clients } = useClients({ page: 1, itemsPerPage: 1000 });

  const estadosOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en_produccion', label: 'En Producción' },
    { value: 'finalizada', label: 'Finalizada' },
  ];

  const hasActiveFilters = fechaDesde || fechaHasta || clienteId || estado;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-700">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="ml-auto"
          >
            <X className="w-4 h-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha Desde
          </label>
          <Input
            type="date"
            value={fechaDesde}
            onChange={(e) => onFechaDesdeChange(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha Hasta
          </label>
          <Input
            type="date"
            value={fechaHasta}
            onChange={(e) => onFechaHastaChange(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          <SearchableSelect
            value={clienteId}
            onChange={onClienteChange}
            options={[
              { value: '', label: 'Todos los clientes' },
              ...clients.map(c => ({
                value: c.id,
                label: c.nombre_fantasia,
              })),
            ]}
            placeholder="Seleccionar cliente"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado de Orden
          </label>
          <SearchableSelect
            value={estado}
            onChange={onEstadoChange}
            options={estadosOptions}
            placeholder="Seleccionar estado"
          />
        </div>
      </div>
    </div>
  );
}
