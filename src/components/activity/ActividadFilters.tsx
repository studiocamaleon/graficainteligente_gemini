import { useState } from 'react';
import { Filter, X, User, Box } from 'lucide-react';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { MultiSelect } from '../ui/MultiSelect';
import type { FiltrosActividad } from '../../types/database';

interface ActividadFiltersProps {
  filtros: Partial<FiltrosActividad>;
  onFiltrosChange: (filtros: Partial<FiltrosActividad>) => void;
  usuarios?: Array<{ id: string; nombre: string }>;
  estaciones?: Array<{ id: string; nombre: string }>;
}

export function ActividadFilters({
  filtros,
  onFiltrosChange,
  usuarios = [],
  estaciones = [],
}: ActividadFiltersProps) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const handleLimpiarFiltros = () => {
    onFiltrosChange({
      fecha_desde: null,
      fecha_hasta: null,
      responsables: [],
      estaciones: [],
      estados: [],
      tipo_etapa: null,
    });
  };

  const tieneFiltrosActivos =
    filtros.fecha_desde ||
    filtros.fecha_hasta ||
    (filtros.responsables && filtros.responsables.length > 0) ||
    (filtros.estaciones && filtros.estaciones.length > 0) ||
    (filtros.estados && filtros.estados.length > 0) ||
    filtros.tipo_etapa;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant={mostrarFiltros ? 'primary' : 'secondary'}
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          icon={Filter}
        >
          Filtros
          {tieneFiltrosActivos && (
            <span className="ml-2 px-2 py-0.5 bg-white text-blue-600 rounded-full text-xs font-medium">
              Activos
            </span>
          )}
        </Button>

        {tieneFiltrosActivos && (
          <Button variant="ghost" onClick={handleLimpiarFiltros} icon={X}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {mostrarFiltros && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha desde
              </label>
              <DatePicker
                value={filtros.fecha_desde}
                onChange={(date) =>
                  onFiltrosChange({ ...filtros, fecha_desde: date })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha hasta
              </label>
              <DatePicker
                value={filtros.fecha_hasta}
                onChange={(date) =>
                  onFiltrosChange({ ...filtros, fecha_hasta: date })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Operadores
              </label>
              <MultiSelect
                options={usuarios.map((u) => ({ value: u.id, label: u.nombre }))}
                value={filtros.responsables || []}
                onChange={(values) =>
                  onFiltrosChange({ ...filtros, responsables: values })
                }
                placeholder="Todos los operadores"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Box className="w-4 h-4 inline mr-1" />
                Estaciones
              </label>
              <MultiSelect
                options={estaciones.map((e) => ({ value: e.id, label: e.nombre }))}
                value={filtros.estaciones || []}
                onChange={(values) =>
                  onFiltrosChange({ ...filtros, estaciones: values })
                }
                placeholder="Todas las estaciones"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado
              </label>
              <MultiSelect
                options={[
                  { value: 'completado', label: 'Completado' },
                  { value: 'omitido', label: 'Omitido' },
                ]}
                value={filtros.estados || []}
                onChange={(values) =>
                  onFiltrosChange({
                    ...filtros,
                    estados: values as ('completado' | 'omitido')[],
                  })
                }
                placeholder="Todos los estados"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Etapa
              </label>
              <select
                value={filtros.tipo_etapa || ''}
                onChange={(e) =>
                  onFiltrosChange({
                    ...filtros,
                    tipo_etapa: e.target.value || null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas las etapas</option>
                <option value="prensa">Prensa</option>
                <option value="post-prensa">Post-Prensa</option>
                <option value="terminacion">Terminación</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
