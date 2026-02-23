import ReactECharts from 'echarts-for-react';
import type { CashflowV2Point } from '../../../types/finanzas-cashflow-v2';

interface CashflowV2BalanceAreaChartProps {
  data: CashflowV2Point[];
}

export function CashflowV2BalanceAreaChart({ data }: CashflowV2BalanceAreaChartProps) {
  const option = {
    backgroundColor: 'transparent',
    grid: { left: 50, right: 24, top: 20, bottom: 34 },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((d) => d.fecha),
      axisLabel: {
        formatter: (v: string) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        color: '#64748b',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#64748b',
        formatter: (v: number) => `${Math.round(v / 1000)}k`,
      },
    },
    series: [
      {
        name: 'Saldo acumulado',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: '#0f172a' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.38)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.04)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ef4444', type: 'dashed' },
          data: [{ yAxis: 0 }],
        },
        data: data.map((d) => d.saldo_acumulado),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 340, width: '100%' }} />;
}
