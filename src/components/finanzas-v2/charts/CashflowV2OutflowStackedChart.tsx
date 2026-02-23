import ReactECharts from 'echarts-for-react';
import type { CashflowV2Point } from '../../../types/finanzas-cashflow-v2';
import { formatYmdAr } from '../../../utils/dates';

interface CashflowV2OutflowStackedChartProps {
  data: CashflowV2Point[];
}

export function CashflowV2OutflowStackedChart({ data }: CashflowV2OutflowStackedChartProps) {
  const option = {
    grid: { left: 40, right: 24, top: 36, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const rawDate = params?.[0]?.axisValue;
        const label = typeof rawDate === 'string' ? formatYmdAr(rawDate, 'DD/MM/YYYY') : '';
        const total = params.reduce((acc, p) => acc + Math.abs(Number(p.value || 0)), 0);
        const rows = params
          .map(
            (p) =>
              `${p.marker} ${p.seriesName}: ${new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                maximumFractionDigits: 0,
              }).format(Math.abs(Number(p.value || 0)))}`
          )
          .join('<br/>');

        return `<strong>${label}</strong><br/>Total egresos: ${new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS',
          maximumFractionDigits: 0,
        }).format(total)}<br/><br/>${rows}`;
      },
    },
    legend: { top: 4, textStyle: { color: '#334155' } },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.fecha),
      axisLabel: {
        color: '#64748b',
        formatter: (v: string) => formatYmdAr(v, 'DD/MM'),
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b', formatter: (v: number) => `${Math.round(v / 1000)}k` },
    },
    series: [
      {
        name: 'Cheques',
        type: 'bar',
        stack: 'out',
        itemStyle: { color: '#ef4444' },
        data: data.map((d) => d.egreso_cheques),
      },
      {
        name: 'Tarjetas',
        type: 'bar',
        stack: 'out',
        itemStyle: { color: '#f97316' },
        data: data.map((d) => d.egreso_tarjetas),
      },
      {
        name: 'Recurrentes',
        type: 'bar',
        stack: 'out',
        itemStyle: { color: '#f59e0b' },
        data: data.map((d) => d.egreso_recurrentes),
      },
      {
        name: 'Compras',
        type: 'bar',
        stack: 'out',
        itemStyle: { color: '#db2777' },
        data: data.map((d) => d.egreso_compras),
      },
      {
        name: 'Vencidos',
        type: 'bar',
        stack: 'out',
        itemStyle: { color: '#7f1d1d' },
        data: data.map((d) => d.total_egreso_vencido),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 330, width: '100%' }} />;
}
