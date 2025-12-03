import type { VentasPorCanal } from '../../types/reportes';

interface VentasPorCanalChartProps {
  data?: VentasPorCanal[];
  loading?: boolean;
}

export function VentasPorCanalChart({ data, loading }: VentasPorCanalChartProps) {
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

  const colors = [
    { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' },
    { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500' },
    { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-500' },
    { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {data.map((item, index) => {
          const color = colors[index % colors.length];
          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{item.canal}</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${item.total_ventas.toFixed(2)} ({item.porcentaje_ventas.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`${color.bg} h-3 rounded-full transition-all duration-500`}
                  style={{ width: `${item.porcentaje_ventas}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                <span>{item.total_ordenes} órdenes ({item.ordenes_trabajo} trabajo, {item.ordenes_copiado} copiado)</span>
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
              <th className="pb-2">Canal</th>
              <th className="pb-2 text-right">Ventas</th>
              <th className="pb-2 text-right">Órdenes</th>
              <th className="pb-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => {
              const color = colors[index % colors.length];
              return (
                <tr key={index} className="border-b">
                  <td className="py-2 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color.bg}`}></div>
                    {item.canal}
                  </td>
                  <td className="py-2 text-right font-medium">${item.total_ventas.toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <div className="text-xs">
                      <div>{item.total_ordenes} total</div>
                      <div className="text-gray-500">({item.ordenes_trabajo}T / {item.ordenes_copiado}C)</div>
                    </div>
                  </td>
                  <td className="py-2 text-right">{item.porcentaje_ventas.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
