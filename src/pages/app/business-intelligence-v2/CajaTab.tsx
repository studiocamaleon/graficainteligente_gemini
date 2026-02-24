import ReactECharts from 'echarts-for-react';
import { AlertTriangle, Banknote, Clock3, Wallet } from 'lucide-react';
import { useBICaja } from '../../../hooks/useBICaja';
import type { BIQueryParams } from '../../../hooks/biShared';
import { BISectionCard } from '../../../components/business-intelligence-v2/BISectionCard';
import { KPICard } from '../../../components/business-intelligence-v2/KPICard';
import { BIErrorState, BILoadingState } from '../../../components/business-intelligence-v2/BIState';
import { formatCurrencyARS } from '../../../components/business-intelligence-v2/currency';

interface CajaTabProps {
  params: BIQueryParams;
}

export function CajaTab({ params }: CajaTabProps) {
  const caja = useBICaja(params);
  if (caja.loading) return <BILoadingState label="Cargando indicadores de caja..." />;
  if (caja.error) return <BIErrorState message={caja.error} />;
  if (!caja.data) return <BIErrorState message="No hay datos de caja disponibles." />;

  const waterfallOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => formatCurrencyARS(Number(value || 0)),
    },
    xAxis: { type: 'category', data: ['Ingresos', 'Egresos', 'Balance'] },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrencyARS(value) } },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    series: [
      {
        type: 'bar',
        data: [
          { value: caja.data.ingresos_movimientos, itemStyle: { color: '#14b8a6' } },
          { value: caja.data.egresos_movimientos, itemStyle: { color: '#f97316' } },
          { value: caja.data.balance_movimientos, itemStyle: { color: caja.data.balance_movimientos >= 0 ? '#06b6d4' : '#ef4444' } },
        ],
        itemStyle: { borderRadius: [8, 8, 0, 0] },
      },
    ],
  };

  const agingOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${formatCurrencyARS(Number(params.value || 0))} (${Number(params.percent || 0).toFixed(1)}%)`,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '72%'],
        label: { formatter: '{b}: {d}%' },
        data: [
          { name: '0-30 días', value: caja.data.pendiente_0_30 },
          { name: '31-60 días', value: caja.data.pendiente_31_60 },
          { name: '61+ días', value: caja.data.pendiente_61_mas },
        ],
      },
    ],
  };

  const dsoByCategory = caja.data.dso_por_categoria.slice(0, 8);
  const dsoCategoriaOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' as const },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const row = params?.[0];
        if (!row) return '';
        return `${row.name}: ${Number(row.value || 0).toFixed(1)} días`;
      },
    },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', name: 'Días' },
    yAxis: {
      type: 'category',
      data: dsoByCategory.map((d) => d.categoria_nombre),
    },
    series: [
      {
        type: 'bar',
        name: 'DSO',
        data: dsoByCategory.map((d) => d.dso_promedio_dias),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#0ea5e9' },
        label: {
          show: true,
          position: 'right' as const,
          formatter: ({ value }: { value: number }) => `${Number(value || 0).toFixed(1)} días`,
          color: '#334155',
          fontSize: 11,
        },
      },
    ],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Cobrado período" value={formatCurrencyARS(caja.data.cobrado_periodo)} subtitle="Por fecha de pago" hint="Dinero efectivamente cobrado en el período." icon={Wallet} tone="emerald" />
        <KPICard title="Egresos período" value={formatCurrencyARS(caja.data.egresos_movimientos)} subtitle="Total de salidas de caja" hint="Suma de egresos registrados en el período seleccionado." icon={Banknote} tone="rose" />
        <KPICard title="Aging 61+ días" value={formatCurrencyARS(caja.data.pendiente_61_mas)} subtitle="Riesgo alto de cobranza" hint="Deuda con más de 61 días sin cobrar." icon={AlertTriangle} tone={caja.data.pendiente_61_mas > 0 ? 'amber' : 'emerald'} />
        <KPICard title="DSO estimado" value={`${caja.data.dso_estimado.toFixed(1)} días`} subtitle="Tiempo medio de cobro" hint="Días promedio que tarda en cobrarse una venta." icon={Clock3} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <BISectionCard title="Ingresos vs Egresos" description="Métrica tesorería por movimientos de caja." right={<span className="text-[11px] font-medium text-slate-500">Qué es: flujo real de dinero del período.</span>}>
            <ReactECharts option={waterfallOption} style={{ height: 330 }} />
          </BISectionCard>
        </div>
        <div className="xl:col-span-5">
          <BISectionCard title="Aging de Pendientes" description="Distribución de deuda por antigüedad">
            <ReactECharts option={agingOption} style={{ height: 330 }} />
          </BISectionCard>
        </div>
      </div>

      <BISectionCard
        title="DSO por Categoría"
        description="Categoría: X días promedio de cobro (solo órdenes cobradas al 100%)."
        right={<span className="text-[11px] font-medium text-slate-500">Qué es: demora de cobro por categoría principal.</span>}
      >
        <ReactECharts option={dsoCategoriaOption} style={{ height: 340 }} />
      </BISectionCard>
    </div>
  );
}
