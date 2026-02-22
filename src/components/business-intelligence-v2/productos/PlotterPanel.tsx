import ReactECharts from 'echarts-for-react';
import { Layers, Package, Ruler, TrendingUp } from 'lucide-react';
import type { BIProductosData } from '../../../types/business-intelligence';
import { BISectionCard } from '../BISectionCard';
import { KPICard } from '../KPICard';
import { formatCurrencyARS } from '../currency';

interface PlotterPanelProps {
  data: BIProductosData;
}

export function PlotterPanel({ data }: PlotterPanelProps) {
  const r = data.plotter.resumen;

  const makePie = (rows: Array<{ name: string; value: number }>) => ({
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '72%'], label: { formatter: '{b}: {d}%' }, data: rows }],
  });

  const materialesOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.plotter.topMateriales.slice(0, 8).map((i) => i.material_label) },
    series: [{ type: 'bar', data: data.plotter.topMateriales.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#0ea5e9', borderRadius: [0, 6, 6, 0] } }],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Ventas Plotter" value={formatCurrencyARS(r.total_ventas)} subtitle="Facturación del período" hint="Ventas de ítems Plotter de Corte." icon={TrendingUp} tone="cyan" />
        <KPICard title="Órdenes" value={String(r.total_ordenes)} subtitle="Órdenes con Plotter" hint="Órdenes con al menos un ítem Plotter." icon={Package} tone="emerald" />
        <KPICard title="Metros lineales" value={r.total_ml.toFixed(2)} subtitle="ml acumulados" hint="Volumen total en metros lineales." icon={Ruler} tone="indigo" />
        <KPICard title="Ticket promedio" value={formatCurrencyARS(r.ticket_promedio_orden)} subtitle="Ventas / órdenes" hint="Promedio por orden." icon={Layers} tone="amber" />
        <KPICard title="Precio prom. por ml" value={formatCurrencyARS(r.precio_promedio_ml)} subtitle="Ventas / ml" hint="Precio promedio por metro lineal." icon={Package} tone="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4"><BISectionCard title="Mix de anchos" description="Participación por ancho de corte."><ReactECharts option={makePie(data.plotter.mixAnchos.map((i) => ({ name: i.ancho_label, value: i.total_ventas })))} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Mix de color" description="Participación por color."><ReactECharts option={makePie(data.plotter.mixColor.map((i) => ({ name: i.color_label, value: i.total_ventas })))} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Mix de marca" description="Participación por marca."><ReactECharts option={makePie(data.plotter.mixMarca.map((i) => ({ name: i.marca_label, value: i.total_ventas })))} style={{ height: 320 }} /></BISectionCard></div>
      </div>

      <BISectionCard title="Top materiales/variantes" description="Facturación por material base.">
        <ReactECharts option={materialesOption} style={{ height: 340 }} />
      </BISectionCard>
    </div>
  );
}
