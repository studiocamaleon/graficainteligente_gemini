import { useState } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { usePausasAnalytics } from '../../hooks/usePausasAnalytics';
import { PausasKPICards } from './PausasKPICards';
import { PausasPorCategoriaChart } from './PausasPorCategoriaChart';
import { PausasEvolucionChart } from './PausasEvolucionChart';
import { PausasProlongadasTable } from './PausasProlongadasTable';
import { Button } from '../ui/Button';

export function PausasAnalyticsDashboard() {
  const [fechaDesde, setFechaDesde] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const [fechaHasta, setFechaHasta] = useState(new Date());
  const [agrupacion, setAgrupacion] = useState<'dia' | 'semana' | 'mes'>('dia');

  const {
    kpis,
    categorias,
    evolucion,
    pausasProlongadas,
    loading,
    recargar,
  } = usePausasAnalytics({
    fechaDesde,
    fechaHasta,
    agrupacion,
    autoLoad: true,
  });

  const handlePeriodoPreset = (dias: number) => {
    setFechaDesde(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));
    setFechaHasta(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Filtros y Controles */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Período Rápido */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Período:</span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePeriodoPreset(7)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                7 días
              </button>
              <button
                onClick={() => handlePeriodoPreset(30)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors bg-blue-50 border-blue-300 text-blue-700"
              >
                30 días
              </button>
              <button
                onClick={() => handlePeriodoPreset(90)}
                className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                90 días
              </button>
            </div>
          </div>

          {/* Agrupación */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-gray-700">Agrupar:</span>
            <select
              value={agrupacion}
              onChange={(e) => setAgrupacion(e.target.value as 'dia' | 'semana' | 'mes')}
              className="px-3 py-1 text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="dia">Por Día</option>
              <option value="semana">Por Semana</option>
              <option value="mes">Por Mes</option>
            </select>
          </div>

          {/* Botón Refrescar */}
          <Button
            variant="secondary"
            onClick={recargar}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <PausasKPICards kpis={kpis} loading={loading} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PausasPorCategoriaChart categorias={categorias} loading={loading} />
        <PausasEvolucionChart evolucion={evolucion} loading={loading} />
      </div>

      {/* Tabla de Pausas Prolongadas */}
      <PausasProlongadasTable pausas={pausasProlongadas} loading={loading} />
    </div>
  );
}
