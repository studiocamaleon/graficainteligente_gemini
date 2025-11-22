import { useState } from 'react';
import { Card } from '../ui/Card';
import { SimpleTable } from '../ui/SimpleTable';
import { MetricaCategoria } from '../../hooks/useProductivityMetrics';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface CategoryPerformanceTableProps {
  data: MetricaCategoria[];
  loading?: boolean;
}

type SortField = 'categoria_nombre' | 'total_ordenes' | 'minutos_promedio_por_item';
type SortDirection = 'asc' | 'desc';

export function CategoryPerformanceTable({ data, loading }: CategoryPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('minutos_promedio_por_item');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  if (loading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-6">Rendimiento por Categoría</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 bg-gray-200 rounded flex-1"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold mb-4">Rendimiento por Categoría</h3>
        <p className="text-gray-500 text-center py-8">No hay datos disponibles</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-6">Rendimiento por Categoría</h3>

      <SimpleTable>
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            <th
              className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('categoria_nombre')}
            >
              <div className="flex items-center gap-2">
                Categoría
                <SortIcon field="categoria_nombre" />
              </div>
            </th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('total_ordenes')}
            >
              <div className="flex items-center justify-end gap-2">
                Órdenes
                <SortIcon field="total_ordenes" />
              </div>
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
            <th
              className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('minutos_promedio_por_item')}
            >
              <div className="flex items-center justify-end gap-2">
                Tiempo Prom./Item
                <SortIcon field="minutos_promedio_por_item" />
              </div>
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rango (Min - Max)</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Variabilidad</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((categoria) => {
            const variabilidad =
              categoria.desviacion_estandar / categoria.minutos_promedio_por_item;
            const variabilidadColor =
              variabilidad < 0.2
                ? 'text-green-600 bg-green-50'
                : variabilidad < 0.5
                ? 'text-yellow-600 bg-yellow-50'
                : 'text-red-600 bg-red-50';

            return (
              <tr key={categoria.categoria_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{categoria.categoria_nombre}</td>
                <td className="px-6 py-4 text-right">{categoria.total_ordenes}</td>
                <td className="px-6 py-4 text-right">{categoria.total_items}</td>
                <td className="px-6 py-4 text-right font-semibold">
                  {categoria.minutos_promedio_por_item.toFixed(1)} min
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {categoria.minutos_minimo.toFixed(1)} - {categoria.minutos_maximo.toFixed(1)} min
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${variabilidadColor}`}>
                    {variabilidad < 0.2
                      ? 'Consistente'
                      : variabilidad < 0.5
                      ? 'Moderada'
                      : 'Alta'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SimpleTable>
    </Card>
  );
}
