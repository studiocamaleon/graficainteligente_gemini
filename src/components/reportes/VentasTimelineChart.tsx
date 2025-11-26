interface TimelineData {
  fecha: string;
  total_ventas: number;
  total_ordenes: number;
  ticket_promedio: number;
}

interface VentasTimelineChartProps {
  data?: TimelineData[];
  loading?: boolean;
}

export function VentasTimelineChart({ data, loading }: VentasTimelineChartProps) {
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
        No hay datos disponibles para mostrar
      </div>
    );
  }

  const maxVentas = Math.max(...data.map(d => d.total_ventas));

  return (
    <div className="space-y-4">
      <div className="h-64 relative">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 text-right">
                ${((maxVentas / 4) * (4 - i)).toFixed(0)}
              </span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex items-end gap-1 pl-20 pr-4 pb-4">
          {data.map((item, index) => {
            const heightPercent = maxVentas > 0 ? (item.total_ventas / maxVentas) * 100 : 0;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center group cursor-pointer"
              >
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all relative"
                  style={{ height: `${heightPercent}%`, minHeight: heightPercent > 0 ? '4px' : '0' }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    ${item.total_ventas.toFixed(2)}
                    <br />
                    {item.total_ordenes} órdenes
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 overflow-x-auto text-xs text-gray-600">
        {data.map((item, index) => (
          <span key={index} className="flex-shrink-0">
            {new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
          </span>
        ))}
      </div>
    </div>
  );
}
