import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { BarChart3, DollarSign, Gauge, Layers, Wallet } from 'lucide-react';
import { useBIExecutive } from '../../../hooks/useBIExecutive';
import { useBIVentas } from '../../../hooks/useBIVentas';
import { useBICaja } from '../../../hooks/useBICaja';
import type { BIQueryParams } from '../../../hooks/biShared';
import { BISectionCard } from '../../../components/business-intelligence-v2/BISectionCard';
import { KPICard } from '../../../components/business-intelligence-v2/KPICard';
import { BIErrorState, BILoadingState } from '../../../components/business-intelligence-v2/BIState';
import { formatCurrencyARS } from '../../../components/business-intelligence-v2/currency';

interface ExecutiveTabProps {
  params: BIQueryParams;
}

export function ExecutiveTab({ params }: ExecutiveTabProps) {
  const executive = useBIExecutive(params);
  const ventasParams = useMemo(() => ({ ...params, granularidad: 'semana' as const }), [params]);
  const ventas = useBIVentas(ventasParams);
  const caja = useBICaja(params);

  if (executive.loading || ventas.loading || caja.loading) {
    return <BILoadingState label="Procesando Executive dashboard..." />;
  }

  if (executive.error) return <BIErrorState message={executive.error} />;
  if (!executive.data) return <BIErrorState message="No hay datos de Executive disponibles." />;

  const timeline = ventas.data?.timeline || [];
  const salesOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => formatCurrencyARS(Number(value || 0)),
    },
    grid: { left: 12, right: 12, top: 20, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: timeline.map((t) => t.periodo_label),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', formatter: (value: number) => formatCurrencyARS(value) },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        name: 'Ventas',
        data: timeline.map((t) => t.total_ventas),
        lineStyle: { width: 3, color: '#06b6d4' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6,182,212,0.40)' },
              { offset: 1, color: 'rgba(6,182,212,0.05)' },
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 7,
      },
    ],
  };

  const canalOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number }) =>
        `${params.name}: ${Number(params.value || 0).toFixed(1)}%`,
    },
    legend: { bottom: 0, textStyle: { color: '#475569' } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '72%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, color: '#334155', formatter: '{b}: {c}%' },
        data: (ventas.data?.canales || []).map((c) => ({
          name: c.canal,
          value: Number(c.porcentaje_ventas.toFixed(1)),
        })),
      },
    ],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Revenue total"
          value={formatCurrencyARS(executive.data.revenue_total)}
          subtitle="Criterio comercial OT/OC"
          hint="Suma de OT + OC no vinculadas, excluye borrador/canceladas."
          icon={DollarSign}
          tone="cyan"
          delta={executive.data.revenue_growth_pct}
        />
        <KPICard
          title="Órdenes"
          value={String(executive.data.total_orders)}
          subtitle={`Ticket ${formatCurrencyARS(executive.data.ticket_promedio)}`}
          hint="Cantidad total de órdenes comerciales del período."
          icon={BarChart3}
          tone="indigo"
        />
        <KPICard
          title="Margen caja"
          value={`${executive.data.cash_margin_pct.toFixed(1)}%`}
          subtitle={`Cobrado período ${formatCurrencyARS(caja.data?.cobrado_periodo || 0)}`}
          hint="Margen sobre movimientos de caja del período (visión tesorería)."
          icon={Wallet}
          tone={executive.data.cash_margin_pct >= 0 ? 'emerald' : 'rose'}
        />
        <KPICard
          title="Concentración canal"
          value={`${executive.data.canal_concentracion_pct.toFixed(1)}%`}
          subtitle={executive.data.canal_dominante}
          hint="Participación del canal líder sobre ventas totales del período."
          icon={Layers}
          tone={executive.data.canal_concentracion_pct > 60 ? 'amber' : 'emerald'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <BISectionCard
            title="Momentum Revenue"
            description="Tendencia semanal de ventas (comercial) en UTC-3."
            right={<span className="text-[11px] font-medium text-slate-500">Qué es: evolución de facturación por semana.</span>}
          >
            <ReactECharts option={salesOption} style={{ height: 320 }} />
          </BISectionCard>
        </div>

        <div className="xl:col-span-4">
          <BISectionCard
            title="Mix de Canales"
            description="Participación porcentual de ventas por canal."
            right={<Gauge className="h-4 w-4 text-cyan-600" />}
          >
            <ReactECharts option={canalOption} style={{ height: 320 }} />
            <p className="mt-2 text-[11px] text-slate-500">
              Fórmula: % canal = ventas del canal / ventas totales del período.
            </p>
          </BISectionCard>
        </div>
      </div>
    </div>
  );
}
