import ReactECharts from 'echarts-for-react';
import { Layers, Package, Ruler, TrendingUp } from 'lucide-react';
import type { BIProductosData } from '../../../types/business-intelligence';
import { BISectionCard } from '../BISectionCard';
import { KPICard } from '../KPICard';
import { formatCurrencyARS } from '../currency';

interface PortabannersPanelProps {
  data: BIProductosData;
}

export function PortabannersPanel({ data }: PortabannersPanelProps) {
  const r = data.portabanners.resumen;

  const tecnologiaOption = {
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '72%'], label: { formatter: '{b}: {d}%' }, data: data.portabanners.mixTecnologia.map((i) => ({ name: i.tecnologia_label, value: i.total_ventas })) }],
  };

  const medidasOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.portabanners.topMedidas.slice(0, 8).map((i) => i.medida_label) },
    series: [{ type: 'bar', data: data.portabanners.topMedidas.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#06b6d4', borderRadius: [0, 6, 6, 0] } }],
  };

  const areaOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: data.portabanners.areaResumen.map((i) => i.rango_label) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    series: [{ type: 'bar', data: data.portabanners.areaResumen.map((i) => i.total_ventas), itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] } }],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Ventas Portabanners" value={formatCurrencyARS(r.total_ventas)} subtitle="Facturación del período" hint="Ventas de la categoría Portabanners." icon={TrendingUp} tone="cyan" />
        <KPICard title="Órdenes" value={String(r.total_ordenes)} subtitle="Órdenes con Portabanners" hint="Órdenes con al menos un ítem de Portabanners." icon={Package} tone="emerald" />
        <KPICard title="Unidades" value={r.total_unidades.toFixed(0)} subtitle="Suma de cantidades" hint="Volumen total vendido." icon={Ruler} tone="indigo" />
        <KPICard title="Área total" value={`${r.total_area_mt2.toFixed(2)} m²`} subtitle="Área estimada" hint="Superficie acumulada estimada." icon={Layers} tone="amber" />
        <KPICard title="Precio prom. m²" value={formatCurrencyARS(r.precio_promedio_mt2)} subtitle="Ventas / m²" hint="Precio promedio por m² estimado." icon={Package} tone="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4"><BISectionCard title="Mix tecnología" description="Participación por tecnología."><ReactECharts option={tecnologiaOption} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Top medidas" description="Facturación por medida."><ReactECharts option={medidasOption} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Distribución por área" description="Facturación por rangos de m²."><ReactECharts option={areaOption} style={{ height: 320 }} /></BISectionCard></div>
      </div>
    </div>
  );
}
