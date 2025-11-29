import type { VentasPorHora } from '../../types/reportes';

interface VentasPorHoraChartProps {
  data?: VentasPorHora[];
  loading?: boolean;
}

export function VentasPorHoraChart({ data, loading }: VentasPorHoraChartProps) {
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

  const maxOrdenes = Math.max(...data.map(d => d.total_ordenes));
  const horariosPico = data
    .filter(d => d.total_ordenes > 0)
    .sort((a, b) => b.total_ordenes - a.total_ordenes)
    .slice(0, 3);

  const getIntensidadColor = (ordenes: number): string => {
    if (maxOrdenes === 0) return 'bg-gray-200';
    const porcentaje = (ordenes / maxOrdenes) * 100;
    if (porcentaje >= 75) return 'bg-red-500';
    if (porcentaje >= 50) return 'bg-orange-500';
    if (porcentaje >= 25) return 'bg-yellow-500';
    if (porcentaje > 0) return 'bg-blue-300';
    return 'bg-gray-200';
  };

  const esHorarioPico = (hora: number): boolean => {
    return horariosPico.some(h => h.hora === hora);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.map((item) => {
          const intensidad = getIntensidadColor(item.total_ordenes);
          const porcentaje = maxOrdenes > 0 ? (item.total_ordenes / maxOrdenes) * 100 : 0;
          const esPico = esHorarioPico(item.hora);

          return (
            <div key={item.hora}>
              <div className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium text-gray-700 text-right">
                  {item.rango_horario}
                </div>
                <div className="flex-1 relative">
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className={`${intensidad} h-8 rounded-full transition-all duration-500 flex items-center justify-between px-3`}
                      style={{ width: `${Math.max(porcentaje, 5)}%` }}
                    >
                      <span className="text-xs font-semibold text-white">
                        {item.total_ordenes} órdenes
                      </span>
                      {esPico && (
                        <span className="text-xs font-bold text-white">
                          🔥 PICO
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-16 text-sm text-gray-600 text-right">
                  {item.porcentaje.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Horarios Pico (Top 3)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {horariosPico.map((horario, index) => (
            <div
              key={horario.hora}
              className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-orange-600">
                  #{index + 1}
                </span>
                <span className="text-xl">🔥</span>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {horario.rango_horario}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {horario.total_ordenes} órdenes ({horario.porcentaje.toFixed(1)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span>Muy Alto (75-100%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500"></div>
          <span>Alto (50-75%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span>Medio (25-50%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-300"></div>
          <span>Bajo (1-25%)</span>
        </div>
      </div>
    </div>
  );
}
