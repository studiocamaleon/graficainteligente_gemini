import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { IngresosEgresosData } from '../../types/reportes';

interface IngresosEgresosChartProps {
  data: IngresosEgresosData[] | undefined;
  loading: boolean;
}

export function IngresosEgresosChart({ data, loading }: IngresosEgresosChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-gray-500">
        <div className="text-center">
          <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map(d => Math.max(Number(d.ingresos), Number(d.egresos)))
  );

  const totalIngresos = data.reduce((sum, d) => sum + Number(d.ingresos), 0);
  const totalEgresos = data.reduce((sum, d) => sum + Number(d.egresos), 0);
  const balanceTotal = totalIngresos - totalEgresos;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">Total Ingresos</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-900">
            ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-700">Total Egresos</span>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-900">
            ${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className={`rounded-lg p-4 border ${
          balanceTotal >= 0
            ? 'bg-blue-50 border-blue-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${
              balanceTotal >= 0 ? 'text-blue-700' : 'text-orange-700'
            }`}>
              Balance Neto
            </span>
            <DollarSign className={`w-5 h-5 ${
              balanceTotal >= 0 ? 'text-blue-600' : 'text-orange-600'
            }`} />
          </div>
          <div className={`text-2xl font-bold ${
            balanceTotal >= 0 ? 'text-blue-900' : 'text-orange-900'
          }`}>
            ${balanceTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: '320px' }}>
        <div className="flex h-full items-end justify-between gap-2">
          {data.map((item, index) => {
            const ingresosHeight = maxValue > 0 ? (Number(item.ingresos) / maxValue) * 100 : 0;
            const egresosHeight = maxValue > 0 ? (Number(item.egresos) / maxValue) * 100 : 0;

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="w-full flex gap-1 items-end justify-center" style={{ height: '240px' }}>
                  {/* Barra de Ingresos */}
                  <div className="relative group flex-1 max-w-[40px]">
                    <div
                      className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all duration-300 hover:from-green-600 hover:to-green-500 cursor-pointer"
                      style={{ height: `${ingresosHeight}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Ingresos: ${Number(item.ingresos).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Egresos */}
                  <div className="relative group flex-1 max-w-[40px]">
                    <div
                      className="w-full bg-gradient-to-t from-red-500 to-red-400 rounded-t-lg transition-all duration-300 hover:from-red-600 hover:to-red-500 cursor-pointer"
                      style={{ height: `${egresosHeight}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Egresos: ${Number(item.egresos).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Label */}
                <div className="text-xs text-gray-600 font-medium text-center truncate w-full px-1">
                  {item.periodo_label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gradient-to-t from-green-500 to-green-400 rounded"></div>
          <span className="text-sm text-gray-700">Ingresos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gradient-to-t from-red-500 to-red-400 rounded"></div>
          <span className="text-sm text-gray-700">Egresos</span>
        </div>
      </div>
    </div>
  );
}
