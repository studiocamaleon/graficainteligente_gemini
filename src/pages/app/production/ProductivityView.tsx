import { useState } from 'react';
import { useProductivityMetrics } from '../../../hooks/useProductivityMetrics';
import { KpiCard } from '../../../components/productivity/KpiCard';
import { StageDistributionChart } from '../../../components/productivity/StageDistributionChart';
import { StepPerformanceChart } from '../../../components/productivity/StepPerformanceChart';
import { OperatorRanking } from '../../../components/productivity/OperatorRanking';
import { DateRangeSelector } from '../../../components/productivity/DateRangeSelector';
import { ComplianceRateCard } from '../../../components/productivity/ComplianceRateCard';
import { ComplianceEvolutionChart } from '../../../components/productivity/ComplianceEvolutionChart';
import { ComplianceDetailsTable } from '../../../components/productivity/ComplianceDetailsTable';
import { Button } from '../../../components/ui/Button';
import {
  Clock,
  Package,
  CheckCircle2,
  Timer,
  RefreshCw,
  TrendingUp,
  Users,
  AlertTriangle,
  Target,
} from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';

export function ProductivityView() {
  const [dateRange, setDateRange] = useState<{
    desde: Date | null;
    hasta: Date | null;
  }>({
    desde: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    hasta: new Date(),
  });

  const {
    loading,
    error,
    kpisGenerales,
    metricasPorPaso,
    metricasPorEtapa,
    metricasPorOperario,
    tasaCumplimiento,
    evolutivoTasa,
    refresh,
  } = useProductivityMetrics(dateRange);

  console.log('[ProductivityView] Render state:', {
    loading,
    error,
    hasKpisGenerales: !!kpisGenerales,
    kpisGenerales,
    metricasPorPasoCount: metricasPorPaso.length,
    metricasPorEtapaCount: metricasPorEtapa.length,
  });

  const handleDateRangeChange = (desde: Date | null, hasta: Date | null) => {
    setDateRange({ desde, hasta });
  };

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Error al cargar métricas"
        description={error}
        action={
          <Button onClick={refresh} variant="primary">
            Reintentar
          </Button>
        }
      />
    );
  }

  const hasData = kpisGenerales && kpisGenerales.total_pasos_completados > 0;

  if (!loading && !hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <DateRangeSelector onRangeChange={handleDateRangeChange} />
          <Button onClick={refresh} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <EmptyState
          icon={TrendingUp}
          title="No hay datos de productividad"
          description="Comienza a ejecutar pasos de producción para ver métricas y análisis detallados de rendimiento."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con selector de fechas */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <DateRangeSelector onRangeChange={handleDateRangeChange} />
        <Button onClick={refresh} variant="secondary" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Órdenes Completadas"
          value={kpisGenerales?.total_ordenes_completadas || 0}
          subtitle={`${kpisGenerales?.total_items_completados || 0} items en total`}
          icon={Package}
          color="blue"
          loading={loading}
        />

        <KpiCard
          title="Pasos Completados"
          value={kpisGenerales?.total_pasos_completados || 0}
          subtitle={`${kpisGenerales?.total_horas_produccion?.toFixed(1) || 0} horas totales`}
          icon={CheckCircle2}
          color="green"
          loading={loading}
        />

        <KpiCard
          title="Tiempo Prom. por Orden"
          value={`${kpisGenerales?.horas_promedio_por_orden?.toFixed(1) || 0} h`}
          subtitle={`${kpisGenerales?.minutos_promedio_por_item?.toFixed(1) || 0} min/item`}
          icon={Clock}
          color="teal"
          loading={loading}
        />

        <KpiCard
          title="Paso Más Lento"
          value={`${kpisGenerales?.paso_mas_lento_minutos?.toFixed(1) || 0} min`}
          subtitle={kpisGenerales?.paso_mas_lento || 'N/A'}
          icon={Timer}
          color="orange"
          loading={loading}
        />
      </div>

      {/* Análisis de Pasos y Tiempos */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-semibold text-gray-900">Análisis de Tiempos y Pasos</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StepPerformanceChart data={metricasPorPaso} loading={loading} limit={8} />
          <StageDistributionChart data={metricasPorEtapa} loading={loading} />
        </div>
      </div>

      {/* Sección de Cumplimiento */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Cumplimiento de Plazos Prometidos</h2>
        </div>

        <div className="space-y-6 mb-6">
          <ComplianceRateCard data={tasaCumplimiento!} loading={loading} />
          <ComplianceEvolutionChart data={evolutivoTasa} loading={loading} />
        </div>

        <ComplianceDetailsTable data={tasaCumplimiento} loading={loading} />
      </div>

      {/* Ranking de Operarios */}
      {metricasPorOperario.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Rendimiento del Equipo</h2>
          </div>
          <OperatorRanking data={metricasPorOperario} loading={loading} />
        </div>
      )}

      {/* Footer informativo */}
      <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Sobre el Tiempo Promedio Productivo
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Este tablero muestra el **tiempo efectivo de trabajo** por cada orden. El cálculo suma la
          duración de todos los pasos ejecutados, **restando cualquier periodo en que la orden
          estuvo pausada** (espera de material, consulta a cliente, etc.).
          Esto permite medir la eficiencia real de los procesos de producción sin ruidos externos.
        </p>
      </div>
    </div>
  );
}
