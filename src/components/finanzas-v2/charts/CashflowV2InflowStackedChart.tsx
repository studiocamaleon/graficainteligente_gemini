import ReactECharts from 'echarts-for-react';
import type { CashflowV2Point } from '../../../types/finanzas-cashflow-v2';

interface CashflowV2InflowStackedChartProps {
  data: CashflowV2Point[];
}

export function CashflowV2InflowStackedChart({ data }: CashflowV2InflowStackedChartProps) {
  const option = {
    grid: { left: 40, right: 24, top: 36, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0),
    },
    legend: { top: 4, textStyle: { color: '#334155' } },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.fecha),
      axisLabel: {
        color: '#64748b',
        formatter: (v: string) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', formatter: (v: number) => `${Math.round(v / 1000)}k` },
    },
    series: [
      {
        name: 'WIP futuro',
        type: 'bar',
        stack: 'in',
        itemStyle: { color: '#6366f1' },
        data: data.map((d) => d.ingreso_wip_futuro),
      },
      {
        name: 'WIP vencido',
        type: 'bar',
        stack: 'in',
        itemStyle: { color: '#10b981' },
        data: data.map((d) => d.ingreso_wip_vencido),
      },
      {
        name: 'Otros vencidos',
        type: 'bar',
        stack: 'in',
        itemStyle: { color: '#0ea5e9' },
        data: data.map((d) => d.ingreso_otros_vencidos),
      },
      {
        name: 'Cheques',
        type: 'bar',
        stack: 'in',
        itemStyle: { color: '#22d3ee' },
        data: data.map((d) => d.ingreso_cheques),
      },
      {
        name: 'Liquidaciones',
        type: 'bar',
        stack: 'in',
        itemStyle: { color: '#14b8a6' },
        data: data.map((d) => d.ingreso_liquidaciones),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 330, width: '100%' }} />;
}
