import { useState } from 'react';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { Select } from '../../../../components/ui/Select';
import { DatePicker } from '../../../../components/ui/DatePicker';
import { VentasKPICards } from '../../../../components/reportes/VentasKPICards';
import { VentasTimelineChart } from '../../../../components/reportes/VentasTimelineChart';
import { VentasPorCanalChart } from '../../../../components/reportes/VentasPorCanalChart';
import { VentasPorCategoriaChart } from '../../../../components/reportes/VentasPorCategoriaChart';
import { TopProductosChart } from '../../../../components/reportes/TopProductosChart';
import { VentasPorDiaChart } from '../../../../components/reportes/VentasPorDiaChart';
import { VentasPorHoraChart } from '../../../../components/reportes/VentasPorHoraChart';
import { VentasPorUsuarioTable } from '../../../../components/reportes/VentasPorUsuarioTable';
import { TasaSenaCard } from '../../../../components/reportes/TasaSenaCard';
import { useReporteGeneral } from '../../../../hooks/useReporteGeneral';
import { usePageHeader } from '../../../../hooks/usePageHeader';
import type { PeriodoPreset } from '../../../../types/reportes';

export default function ReporteGeneral() {
  usePageHeader('Reporte general de ventas y análisis de desempeño');

  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('este_mes');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const { data, loading, refetch } = useReporteGeneral(periodoPreset, fechaInicio, fechaFin);

  const periodosOptions = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'esta_semana', label: 'Esta Semana' },
    { value: 'este_mes', label: 'Este Mes' },
    { value: 'mes_pasado', label: 'Mes Pasado' },
    { value: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
    { value: 'ultimos_6_meses', label: 'Últimos 6 Meses' },
    { value: 'este_anio', label: 'Este Año' },
    { value: 'anio_pasado', label: 'Año Pasado' },
    { value: 'personalizado', label: 'Personalizado' },
  ];

  const handleExportar = () => {
    console.log('Exportar reporte');
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Período
            </label>
            <Select
              value={periodoPreset}
              onChange={(value) => setPeriodoPreset(value as PeriodoPreset)}
              options={periodosOptions}
            />
          </div>

          {periodoPreset === 'personalizado' && (
            <>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Inicio
                </label>
                <DatePicker value={fechaInicio} onChange={setFechaInicio} />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Fin
                </label>
                <DatePicker value={fechaFin} onChange={setFechaFin} />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => refetch()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>

            <Button variant="primary" onClick={handleExportar}>
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </Card>

      <VentasKPICards data={data?.kpis} loading={loading} />

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Evolución de Ventas
          </h3>
          <VentasTimelineChart data={data?.timeline} loading={loading} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Ventas por Canal
            </h3>
            <VentasPorCanalChart data={data?.porCanal} loading={loading} />
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Facturación por Categorías
            </h3>
            <VentasPorCategoriaChart data={data?.porCategoria} loading={loading} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top 10 Productos Más Vendidos
          </h3>
          <TopProductosChart data={data?.topProductos} loading={loading} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Ventas por Día de la Semana
            </h3>
            <VentasPorDiaChart data={data?.porDiaSemana} loading={loading} />
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Horarios Pico de Pedidos
            </h3>
            <VentasPorHoraChart data={data?.porHora} loading={loading} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Facturación por Usuario
          </h3>
          <VentasPorUsuarioTable data={data?.porUsuario} loading={loading} />
        </div>
      </Card>

      <TasaSenaCard data={data?.tasaSena} loading={loading} />

      {loading && (
        <Card>
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos del reporte...</p>
          </div>
        </Card>
      )}

      {!loading && !data && (
        <Card>
          <div className="p-8 text-center">
            <p className="text-gray-600">No hay datos disponibles para el período seleccionado</p>
          </div>
        </Card>
      )}
    </div>
  );
}
