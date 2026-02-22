import ReactECharts from 'echarts-for-react';
import { Layers, Package, Ruler, TrendingUp } from 'lucide-react';
import type { BIProductosData } from '../../../types/business-intelligence';
import { BISectionCard } from '../BISectionCard';
import { KPICard } from '../KPICard';
import { formatCurrencyARS } from '../currency';

interface RigidosPanelProps {
  data: BIProductosData;
}

export function RigidosPanel({ data }: RigidosPanelProps) {
  const r = data.rigidos.resumen;

  const varianteOption = {
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '72%'], label: { formatter: '{b}: {d}%' }, data: data.rigidos.mixVarianteEspesor.map((i) => ({ name: i.variante_espesor_label, value: i.total_ventas })) }],
  };

  const topMaterialesOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.rigidos.topMateriales.slice(0, 8).map((i) => i.material_label) },
    series: [{ type: 'bar', data: data.rigidos.topMateriales.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#06b6d4', borderRadius: [0, 6, 6, 0] } }],
  };

  const topMedidasOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.rigidos.topMedidas.slice(0, 8).map((i) => i.medida_label) },
    series: [{ type: 'bar', data: data.rigidos.topMedidas.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#6366f1', borderRadius: [0, 6, 6, 0] } }],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Ventas Rígidos" value={formatCurrencyARS(r.total_ventas)} subtitle="Facturación del período" hint="Ventas de Materiales Rígidos." icon={TrendingUp} tone="cyan" />
        <KPICard title="Órdenes" value={String(r.total_ordenes)} subtitle="Órdenes con Rígidos" hint="Órdenes con al menos un ítem de la categoría." icon={Package} tone="emerald" />
        <KPICard title="m² vendidos" value={r.total_mt2.toFixed(2)} subtitle="Superficie acumulada" hint="Suma de superficie estimada." icon={Ruler} tone="indigo" />
        <KPICard title="Ticket promedio" value={formatCurrencyARS(r.ticket_promedio_orden)} subtitle="Ventas / órdenes" hint="Promedio por orden." icon={Layers} tone="amber" />
        <KPICard title="Precio prom. m²" value={formatCurrencyARS(r.precio_promedio_mt2)} subtitle="Ventas / m²" hint="Precio promedio por metro cuadrado." icon={Package} tone="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4"><BISectionCard title="Mix variante/espesor" description="Distribución por configuración técnica."><ReactECharts option={varianteOption} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Top materiales" description="Facturación por material."><ReactECharts option={topMaterialesOption} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Top medidas" description="Facturación por medida."><ReactECharts option={topMedidasOption} style={{ height: 320 }} /></BISectionCard></div>
      </div>
    </div>
  );
}
