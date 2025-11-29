import type { TimelineData } from '../../types/reportes';

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
  const maxOrdenes = Math.max(...data.map(d => d.total_ordenes));

  const CHART_HEIGHT = 288; // 72px * 4 = h-72 en píxeles

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-6 text-sm mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-600 rounded"></div>
          <span className="text-gray-700">Facturación ($)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-green-600 rounded"></div>
          <span className="text-gray-700">Cantidad de Órdenes</span>
        </div>
      </div>

      <div className="relative" style={{ height: `${CHART_HEIGHT + 40}px` }}>
        {/* Escala de ventas (izquierda) */}
        <div className="absolute left-0 top-0 flex flex-col justify-between w-20" style={{ height: `${CHART_HEIGHT}px` }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-end">
              <span className="text-xs text-gray-500">
                ${((maxVentas / 4) * (4 - i)).toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Líneas de guía horizontales */}
        <div className="absolute left-24 right-16 top-0 flex flex-col justify-between pointer-events-none" style={{ height: `${CHART_HEIGHT}px` }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-gray-200"></div>
          ))}
        </div>

        {/* Escala de órdenes (derecha) */}
        <div className="absolute right-0 top-0 flex flex-col justify-between w-12" style={{ height: `${CHART_HEIGHT}px` }}>
          {[0, 1, 2, 3, 4].reverse().map((i) => (
            <div key={i} className="flex items-center justify-start">
              <span className="text-xs text-green-600 font-medium">
                {Math.ceil((maxOrdenes / 4) * i)}
              </span>
            </div>
          ))}
        </div>

        {/* Área de barras */}
        <div className="absolute left-24 right-16 top-0 bottom-10 flex items-end gap-2">
          {data.map((item, index) => {
            const ventasHeightPx = maxVentas > 0 ? (item.total_ventas / maxVentas) * CHART_HEIGHT : 0;
            const ordenesHeightPx = maxOrdenes > 0 ? (item.total_ordenes / maxOrdenes) * CHART_HEIGHT : 0;

            return (
              <div
                key={index}
                className="flex-1 flex items-end justify-center gap-1 group cursor-pointer relative"
                style={{ height: `${CHART_HEIGHT}px` }}
              >
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all"
                  style={{
                    height: `${ventasHeightPx}px`,
                    minHeight: ventasHeightPx > 0 ? '4px' : '0'
                  }}
                ></div>
                <div
                  className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t hover:from-green-700 hover:to-green-500 transition-all"
                  style={{
                    height: `${ordenesHeightPx}px`,
                    minHeight: ordenesHeightPx > 0 ? '4px' : '0'
                  }}
                ></div>

                <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-3 py-2 whitespace-nowrap z-10 shadow-lg">
                  <div className="font-semibold mb-1">{item.fecha}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span>Ventas: ${item.total_ventas.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span>Órdenes: {item.total_ordenes}</span>
                    </div>
                    <div className="text-gray-300 text-xs pt-1 border-t border-gray-700">
                      Ticket: ${item.ticket_promedio.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Etiquetas de fecha (abajo) */}
        <div className="absolute left-24 right-16 bottom-0 flex items-center justify-center gap-2 text-xs text-gray-600">
          {data.map((item, index) => (
            <span key={index} className="flex-1 text-center">
              {new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
