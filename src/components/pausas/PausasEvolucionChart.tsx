import { TrendingUp } from 'lucide-react';
import type { PausaEvolucion } from '../../hooks/usePausasAnalytics';

interface PausasEvolucionChartProps {
  evolucion: PausaEvolucion[];
  loading: boolean;
}

export function PausasEvolucionChart({ evolucion, loading }: PausasEvolucionChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6 animate-pulse"></div>
        <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  if (evolucion.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-6">Evolución Temporal</h3>
        <div className="text-center py-12 text-gray-400">
          <p>No hay datos de evolución en este período</p>
        </div>
      </div>
    );
  }

  const maxCantidad = Math.max(...evolucion.map((e) => e.cantidad_pausas));
  const maxAltura = 200; // px

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Evolución Temporal</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingUp className="w-4 h-4" />
          <span>Pausas por período</span>
        </div>
      </div>

      <div className="relative">
        {/* Leyenda vertical */}
        <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-500">
          <span>{maxCantidad}</span>
          <span>{Math.round(maxCantidad / 2)}</span>
          <span>0</span>
        </div>

        {/* Gráfico de barras */}
        <div className="ml-14 overflow-x-auto">
          <div className="flex items-end gap-2 min-w-max" style={{ height: `${maxAltura}px` }}>
            {evolucion.map((punto) => {
              const altura = maxCantidad > 0 ? (punto.cantidad_pausas / maxCantidad) * maxAltura : 0;

              return (
                <div
                  key={punto.periodo}
                  className="flex flex-col items-center gap-2 min-w-[60px] group"
                >
                  {/* Tooltip al hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-16 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    <div className="font-medium">{punto.periodo}</div>
                    <div>{punto.cantidad_pausas} pausas</div>
                    <div>{punto.tiempo_total_horas}h total</div>
                  </div>

                  {/* Barra */}
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg hover:from-blue-600 hover:to-blue-500 transition-all cursor-pointer relative"
                    style={{ height: `${altura}px`, minHeight: altura > 0 ? '4px' : '0' }}
                  >
                    {/* Etiqueta en la barra */}
                    {altura > 30 && (
                      <span className="absolute top-2 left-0 right-0 text-center text-xs font-medium text-white">
                        {punto.cantidad_pausas}
                      </span>
                    )}
                  </div>

                  {/* Etiqueta del período */}
                  <span className="text-xs text-gray-600 transform -rotate-45 origin-top-left mt-2 whitespace-nowrap">
                    {punto.periodo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Línea base */}
        <div className="ml-14 mt-2 border-t border-gray-300"></div>
      </div>
    </div>
  );
}
