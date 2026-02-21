import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Target, TrendingUp } from 'lucide-react';
import { useBIVentas } from '../../../hooks/useBIVentas';
import type { BIQueryParams } from '../../../hooks/biShared';
import { BISectionCard } from '../../../components/business-intelligence-v2/BISectionCard';
import { KPICard } from '../../../components/business-intelligence-v2/KPICard';
import { BIErrorState, BILoadingState } from '../../../components/business-intelligence-v2/BIState';

interface VentasTabProps {
  params: BIQueryParams;
}

const money = (value: number) =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export function VentasTab({ params }: VentasTabProps) {
  const ventasParams = useMemo(() => ({ ...params, granularidad: 'dia' as const }), [params]);
  const ventas = useBIVentas(ventasParams);
  if (ventas.loading) return <BILoadingState label="Cargando analítica de ventas..." />;
  if (ventas.error) return <BIErrorState message={ventas.error} />;
  if (!ventas.data) return <BIErrorState message="No hay datos de ventas disponibles." />;

  const totalVentas = ventas.data.timeline.reduce((acc, row) => acc + row.total_ventas, 0);
  const totalOrdenes = ventas.data.timeline.reduce((acc, row) => acc + row.total_ordenes, 0);
  const mixOc = totalOrdenes > 0
    ? (ventas.data.timeline.reduce((acc, row) => acc + row.ordenes_oc, 0) / totalOrdenes) * 100
    : 0;
  const ticket = totalOrdenes > 0 ? totalVentas / totalOrdenes : 0;

  const timelineOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 12, right: 12, top: 40, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: ventas.data.timeline.map((d) => d.periodo_label) },
    yAxis: [{ type: 'value', name: 'Ventas' }, { type: 'value', name: 'Órdenes' }],
    series: [
      {
        type: 'bar',
        name: 'Ventas',
        data: ventas.data.timeline.map((d) => d.total_ventas),
        itemStyle: { borderRadius: [6, 6, 0, 0], color: '#06b6d4' },
      },
      {
        type: 'line',
        name: 'Órdenes',
        yAxisIndex: 1,
        smooth: true,
        data: ventas.data.timeline.map((d) => d.total_ordenes),
        lineStyle: { width: 3, color: '#6366f1' },
      },
    ],
  };

  const categoryOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: ventas.data.categorias.slice(0, 8).map((c) => c.categoria_nombre),
    },
    series: [
      {
        type: 'bar',
        data: ventas.data.categorias.slice(0, 8).map((c) => c.total_ventas),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#0ea5e9' },
      },
    ],
  };

  const categoryTicketOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: ventas.data.categorias.slice(0, 8).map((c) => c.categoria_nombre),
    },
    series: [
      {
        type: 'bar',
        data: ventas.data.categorias.slice(0, 8).map((c) => c.ticket_promedio),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#6366f1' },
      },
    ],
  };

  const heatmapPoints = ventas.data.heatmap.map((h) => [h.hora, h.dia_semana, h.total_ordenes]);
  const maxHeat = Math.max(1, ...ventas.data.heatmap.map((h) => h.total_ordenes));
  const heatOption = {
    tooltip: { position: 'top' as const },
    grid: { left: 40, right: 78, top: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, h) => `${h}`),
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: DOW_LABELS,
      splitArea: { show: true },
    },
      visualMap: {
        min: 0,
        max: maxHeat,
        calculable: true,
      orient: 'vertical',
      right: 6,
      top: 'middle',
      inRange: { color: ['#ecfeff', '#67e8f9', '#0891b2'] },
    },
    series: [{ type: 'heatmap', data: heatmapPoints }],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard title="Ventas período" value={`$${money(totalVentas)}`} subtitle="OT + OC independientes" hint="Facturación comercial total del rango elegido." icon={TrendingUp} tone="cyan" />
        <KPICard title="Órdenes período" value={String(totalOrdenes)} subtitle={`Ticket ${money(ticket)}`} hint="Cantidad de órdenes comerciales en el período." icon={Target} tone="indigo" />
        <KPICard title="Mix OC independientes" value={`${mixOc.toFixed(1)}%`} subtitle="Participación sobre órdenes" hint="% de órdenes OC sobre el total de órdenes comerciales." icon={Target} tone="emerald" />
        <KPICard
          title="Top producto share"
          value={`${(ventas.data.topProductos[0]?.porcentaje_ventas || 0).toFixed(1)}%`}
          subtitle={ventas.data.topProductos[0]?.producto_nombre || 'Sin datos'}
          hint="Participación del producto líder sobre ventas del período."
          icon={Target}
          tone={(ventas.data.topProductos[0]?.porcentaje_ventas || 0) > 30 ? 'amber' : 'cyan'}
        />
      </div>

      <BISectionCard title="Revenue + Órdenes" description="Comparativa diaria comercial." right={<span className="text-[11px] font-medium text-slate-500">Qué es: volumen vendido y cantidad de órdenes por día.</span>}>
        <ReactECharts option={timelineOption} style={{ height: 340 }} />
      </BISectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <BISectionCard title="Facturación por Categoría" description="Top 8 categorías por ventas">
            <ReactECharts option={categoryOption} style={{ height: 340 }} />
          </BISectionCard>
        </div>
        <div className="xl:col-span-4">
          <BISectionCard title="Ticket promedio por categoría" description="Monto promedio por orden en cada categoría.">
            <ReactECharts option={categoryTicketOption} style={{ height: 340 }} />
          </BISectionCard>
        </div>
        <div className="xl:col-span-4">
          <BISectionCard title="Heatmap horario/semanal" description="Estacionalidad de demanda por día y hora.">
            <ReactECharts option={heatOption} style={{ height: 340 }} />
            <p className="mt-2 text-[11px] text-slate-500">Más oscuro = mayor cantidad de órdenes en esa franja.</p>
          </BISectionCard>
        </div>
      </div>
    </div>
  );
}
