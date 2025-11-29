import type { VentasPorCategoria } from '../../types/reportes';

interface VentasPorCategoriaChartProps {
  data?: VentasPorCategoria[];
  loading?: boolean;
}

const COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' },
  { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500' },
  { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-500' },
  { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500' },
  { bg: 'bg-pink-500', text: 'text-pink-600', border: 'border-pink-500' },
  { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-500' },
];

export function VentasPorCategoriaChart({ data, loading }: VentasPorCategoriaChartProps) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.map((item, index) => {
          const color = COLORS[index % COLORS.length];
          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${color.bg}`}></div>
                  <span className="text-sm font-medium text-gray-700">{item.categoria_nombre}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  ${item.total_ventas.toFixed(2)} ({item.porcentaje.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`${color.bg} h-3 rounded-full transition-all duration-500`}
                  style={{ width: `${item.porcentaje}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                <span>{item.total_ordenes} órdenes</span>
                <span>Promedio: ${item.ticket_promedio.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="pb-2">Categoría</th>
              <th className="pb-2 text-right">Ventas</th>
              <th className="pb-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => {
              const color = COLORS[index % COLORS.length];
              return (
                <tr key={index} className="border-b">
                  <td className="py-2 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color.bg}`}></div>
                    {item.categoria_nombre}
                  </td>
                  <td className="py-2 text-right font-medium">${item.total_ventas.toFixed(2)}</td>
                  <td className="py-2 text-right">{item.porcentaje.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
