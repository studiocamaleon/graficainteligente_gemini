import ReactECharts from 'echarts-for-react';
import { Layers, Package, Ruler, TrendingUp } from 'lucide-react';
import type { BIProductosData } from '../../../types/business-intelligence';
import { BISectionCard } from '../BISectionCard';
import { KPICard } from '../KPICard';
import { formatCurrencyARS } from '../currency';

interface SellosPanelProps {
  data: BIProductosData;
}

export function SellosPanel({ data }: SellosPanelProps) {
  const r = data.sellos.resumen;

  const pie = (rows: Array<{ name: string; value: number }>) => ({
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '72%'], label: { formatter: '{b}: {d}%' }, data: rows }],
  });

  const medidasOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.sellos.topMedidas.slice(0, 8).map((i) => i.medida_label) },
    series: [{ type: 'bar', data: data.sellos.topMedidas.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#0ea5e9', borderRadius: [0, 6, 6, 0] } }],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Ventas Sellos" value={formatCurrencyARS(r.total_ventas)} subtitle="Facturación del período" hint="Ventas de la categoría Sellos." icon={TrendingUp} tone="cyan" />
        <KPICard title="Órdenes" value={String(r.total_ordenes)} subtitle="Órdenes con Sellos" hint="Órdenes con al menos un ítem de Sellos." icon={Package} tone="emerald" />
        <KPICard title="Unidades" value={r.total_unidades.toFixed(0)} subtitle="Suma de cantidades" hint="Volumen total vendido." icon={Ruler} tone="indigo" />
        <KPICard title="Ticket promedio" value={formatCurrencyARS(r.ticket_promedio_orden)} subtitle="Ventas / órdenes" hint="Promedio por orden." icon={Layers} tone="amber" />
        <KPICard title="Precio prom. unidad" value={formatCurrencyARS(r.precio_promedio_unidad)} subtitle="Ventas / unidades" hint="Precio promedio unitario." icon={Package} tone="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-3"><BISectionCard title="Mix tipo producto" description="Sello, repuesto, tinta, etc."><ReactECharts option={pie(data.sellos.mixTipoProducto.map((i) => ({ name: i.tipo_producto, value: i.total_ventas })))} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-3"><BISectionCard title="Mix tipo sello" description="Manual vs automático."><ReactECharts option={pie(data.sellos.mixTipoSello.map((i) => ({ name: i.tipo_sello, value: i.total_ventas })))} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-3"><BISectionCard title="Mix marca" description="Participación por marca."><ReactECharts option={pie(data.sellos.mixMarca.map((i) => ({ name: i.marca_label, value: i.total_ventas })))} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-3"><BISectionCard title="Top medidas" description="Facturación por medida."><ReactECharts option={medidasOption} style={{ height: 320 }} /></BISectionCard></div>
      </div>
    </div>
  );
}
