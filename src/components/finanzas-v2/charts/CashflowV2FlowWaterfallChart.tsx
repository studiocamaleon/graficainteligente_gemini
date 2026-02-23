import ReactECharts from 'echarts-for-react';

interface CashflowV2FlowWaterfallChartProps {
  totalIngresos: number;
  totalEgresos: number;
  totalIngresoVencido: number;
  totalEgresoVencido: number;
}

export function CashflowV2FlowWaterfallChart({
  totalIngresos,
  totalEgresos,
  totalIngresoVencido,
  totalEgresoVencido,
}: CashflowV2FlowWaterfallChartProps) {
  const neto = totalIngresos - totalEgresos;

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0),
    },
    grid: { left: 40, right: 24, top: 24, bottom: 24 },
    xAxis: {
      type: 'category',
      data: ['Ingresos', 'Egresos', 'Vencidos +', 'Vencidos -', 'Neto'],
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', formatter: (v: number) => `${Math.round(v / 1000)}k` },
    },
    series: [
      {
        type: 'bar',
        barWidth: 26,
        data: [
          { value: totalIngresos, itemStyle: { color: '#10b981' } },
          { value: -totalEgresos, itemStyle: { color: '#ef4444' } },
          { value: totalIngresoVencido, itemStyle: { color: '#0891b2' } },
          { value: -totalEgresoVencido, itemStyle: { color: '#b91c1c' } },
          { value: neto, itemStyle: { color: neto >= 0 ? '#0f766e' : '#9f1239' } },
        ],
        label: { show: false },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 300, width: '100%' }} />;
}
