import type { PausaCategoria } from '../../hooks/usePausasAnalytics';

interface PausasPorCategoriaChartProps {
  categorias: PausaCategoria[];
  loading: boolean;
}

const categoriasConfig: Record<string, { label: string; color: string; emoji: string }> = {
  cliente: { label: 'Cliente', color: '#3B82F6', emoji: '👤' },
  materiales: { label: 'Materiales', color: '#F59E0B', emoji: '📦' },
  maquinaria: { label: 'Maquinaria', color: '#EF4444', emoji: '⚙️' },
  personal: { label: 'Personal', color: '#8B5CF6', emoji: '👥' },
  externo: { label: 'Externo', color: '#6B7280', emoji: '🌐' },
  otro: { label: 'Otro', color: '#9CA3AF', emoji: '⏸️' },
};

export function PausasPorCategoriaChart({ categorias, loading }: PausasPorCategoriaChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6 animate-pulse"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-6">Pausas por Categoría</h3>
        <div className="text-center py-8 text-gray-400">
          <p>No hay datos de pausas en este período</p>
        </div>
      </div>
    );
  }

  const maxCantidad = Math.max(...categorias.map((c) => c.cantidad));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-6">Pausas por Categoría</h3>

      <div className="space-y-4">
        {categorias.map((cat) => {
          const config = categoriasConfig[cat.categoria] || categoriasConfig.otro;
          const percentage = (cat.cantidad / maxCantidad) * 100;

          return (
            <div key={cat.categoria}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{config.emoji}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {config.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {cat.cantidad}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({cat.porcentaje}%)
                  </span>
                </div>
              </div>

              <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: config.color,
                  }}
                >
                  <div className="flex items-center justify-end h-full px-3">
                    <span className="text-xs font-medium text-white">
                      {cat.tiempo_total_horas}h total
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Promedio: {cat.tiempo_promedio_horas}h por pausa
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
