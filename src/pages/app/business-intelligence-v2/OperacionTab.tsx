import ReactECharts from 'echarts-for-react';
import { Clock4, Gauge, PackageCheck, Timer } from 'lucide-react';
import { useBIOperacion } from '../../../hooks/useBIOperacion';
import type { BIQueryParams } from '../../../hooks/biShared';
import { BISectionCard } from '../../../components/business-intelligence-v2/BISectionCard';
import { KPICard } from '../../../components/business-intelligence-v2/KPICard';
import { BIErrorState, BILoadingState } from '../../../components/business-intelligence-v2/BIState';

interface OperacionTabProps {
  params: BIQueryParams;
}

export function OperacionTab({ params }: OperacionTabProps) {
  const operacion = useBIOperacion(params);
  if (operacion.loading) return <BILoadingState label="Cargando métricas operativas..." />;
  if (operacion.error) return <BIErrorState message={operacion.error} />;
  if (!operacion.data) return <BIErrorState message="No hay datos de operación disponibles." />;

  const speedOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        progress: { show: true, width: 18 },
        pointer: { show: true },
        axisLine: { lineStyle: { width: 18 } },
        detail: { valueAnimation: true, formatter: '{value}%' },
        data: [{ value: Number(operacion.data.on_time_pct.toFixed(1)), name: 'On Time' }],
      },
    ],
  };

  const tiemposPorCategoria = operacion.data.tiempos_por_categoria.slice(0, 8);
  const tiemposCategoriaOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' as const },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const row = params?.[0];
        if (!row) return '';
        return `${row.name}: ${Number(row.value || 0).toFixed(1)} días hábiles`;
      },
    },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', name: 'Días hábiles' },
    yAxis: { type: 'category', data: tiemposPorCategoria.map((x) => x.categoria_nombre) },
    series: [
      {
        type: 'bar',
        data: tiemposPorCategoria.map((x) => x.lead_time_dias_habiles_prom),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#0ea5e9' },
        label: {
          show: true,
          position: 'right' as const,
          formatter: ({ value }: { value: number }) => `${Number(value || 0).toFixed(1)} d`,
          color: '#334155',
          fontSize: 11,
        },
      },
    ],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Lead time prom." value={`${operacion.data.lead_time_dias_habiles_prom.toFixed(1)} días`} subtitle="Creación a entrega (L-V + feriados AR)" hint="Promedio en días hábiles, excluye sábados, domingos y feriados nacionales argentinos." icon={Timer} tone="cyan" />
        <KPICard title="On-time delivery" value={`${operacion.data.on_time_pct.toFixed(1)}%`} subtitle="Cumplimiento de ETA" hint="% de órdenes entregadas dentro del plazo prometido." icon={PackageCheck} tone={operacion.data.on_time_pct >= 85 ? 'emerald' : 'amber'} />
        <KPICard title="Backlog activo" value={String(operacion.data.backlog_activo)} subtitle="Órdenes pendientes/en proceso" hint="Carga operativa actual aún no finalizada." icon={Clock4} tone={operacion.data.backlog_activo > 100 ? 'amber' : 'indigo'} />
        <KPICard title="Ciclo mediano" value={`${operacion.data.ciclo_mediano_dias_habiles.toFixed(1)} días`} subtitle={`Entregadas ${operacion.data.entregadas_periodo}`} hint="Mediana en días hábiles (menos sensible a casos extremos)." icon={Gauge} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <BISectionCard title="On-time gauge" description="Cumplimiento sobre fecha objetivo." right={<span className="text-[11px] font-medium text-slate-500">Qué es: puntualidad operativa del período.</span>}>
            <ReactECharts option={speedOption} style={{ height: 330 }} />
          </BISectionCard>
        </div>
        <div className="xl:col-span-7">
          <BISectionCard title="Lectura operativa" description="Resumen ejecutivo del período">
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Lead time promedio: <strong>{operacion.data.lead_time_dias_habiles_prom.toFixed(1)} días hábiles</strong>.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Backlog activo actual: <strong>{operacion.data.backlog_activo}</strong> órdenes.
              </div>
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                {operacion.data.on_time_pct >= 85
                  ? 'Desempeño operativo sólido, con cumplimiento alto de fechas de entrega.'
                  : 'Hay oportunidad de mejora en puntualidad: revisar cuellos de botella en producción.'}
              </div>
            </div>
          </BISectionCard>
        </div>
      </div>

      <BISectionCard
        title="Lead Time por Categoría"
        description="Categoría: días hábiles promedio hasta entrega."
        right={<span className="text-[11px] font-medium text-slate-500">Qué es: demora operativa por tipo de trabajo.</span>}
      >
        <ReactECharts option={tiemposCategoriaOption} style={{ height: 340 }} />
      </BISectionCard>
    </div>
  );
}
