import { Badge } from '../ui/Badge';

interface ProductoData {
  producto_nombre: string;
  categoria_nombre: string;
  total_vendido: number;
  unidades_vendidas: number;
  porcentaje: number;
  ticket_promedio: number;
}

interface TopProductosChartProps {
  data?: ProductoData[];
  loading?: boolean;
}

export function TopProductosChart({ data, loading }: TopProductosChartProps) {
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
        No hay datos de productos disponibles
      </div>
    );
  }

  const maxVendido = Math.max(...data.map(d => d.total_vendido));

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {data.map((producto, index) => {
        const widthPercent = maxVendido > 0 ? (producto.total_vendido / maxVendido) * 100 : 0;

        return (
          <div key={index} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {producto.producto_nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {producto.categoria_nombre}
                  </p>
                </div>
              </div>
              <div className="text-right ml-2">
                <p className="text-sm font-semibold text-gray-900">
                  ${producto.total_vendido.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {producto.porcentaje.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${widthPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>{producto.unidades_vendidas} unidades</span>
              <span>Promedio: ${producto.ticket_promedio.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
