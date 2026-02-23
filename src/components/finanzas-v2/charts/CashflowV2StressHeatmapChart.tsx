import ReactECharts from 'echarts-for-react';
import type { CashflowV2Point } from '../../../types/finanzas-cashflow-v2';
import { formatYmdAr } from '../../../utils/dates';

interface CashflowV2StressHeatmapChartProps {
  data: CashflowV2Point[];
}

const buckets = ['>= 0', '-0 a -250k', '-250k a -750k', '< -750k'];

function toBucket(value: number) {
  if (value >= 0) return 0;
  if (value > -250000) return 1;
  if (value > -750000) return 2;
  return 3;
}

export function CashflowV2StressHeatmapChart({ data }: CashflowV2StressHeatmapChartProps) {
  const x = data.map((d) => formatYmdAr(d.fecha, 'DD/MM'));
  const shouldRotateLabels = data.length > 45;

  const heatData = data.map((d, idx) => {
    const b = toBucket(d.saldo_acumulado);
    return [idx, b, Math.abs(d.saldo_acumulado)];
  });

  const option = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const [xIndex, yIndex, magnitude] = params.value;
        return `${x[xIndex]}<br/>Rango: ${buckets[yIndex]}<br/>Magnitud: ${new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          maximumFractionDigits: 0,
        }).format(magnitude || 0)}`;
      },
    },
    grid: { left: 70, right: 92, top: 24, bottom: 72 },
    xAxis: {
      type: 'category',
      data: x,
      splitArea: { show: true },
      axisLabel: {
        color: '#64748b',
        rotate: shouldRotateLabels ? 35 : 0,
        fontSize: 11,
        margin: 16,
      },
    },
    yAxis: {
      type: 'category',
      data: buckets,
      splitArea: { show: true },
      axisLabel: { color: '#64748b' },
    },
    visualMap: {
      min: 0,
      max: Math.max(...heatData.map((d) => d[2]), 1),
      calculable: false,
      orient: 'vertical',
      right: 8,
      top: 30,
      inRange: {
        color: ['#ecfeff', '#a5f3fc', '#67e8f9', '#06b6d4', '#155e75'],
      },
      textStyle: { color: '#64748b' },
    },
    series: [
      {
        type: 'heatmap',
        data: heatData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.35)',
          },
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 270, width: '100%' }} />;
}
