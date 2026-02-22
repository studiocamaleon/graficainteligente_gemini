import ReactECharts from 'echarts-for-react';
import { Layers, Package, Ruler, TrendingUp } from 'lucide-react';
import type { BIProductosData } from '../../../types/business-intelligence';
import { BISectionCard } from '../BISectionCard';
import { KPICard } from '../KPICard';
import { formatCurrencyARS } from '../currency';

interface TalonariosPanelProps {
  data: BIProductosData;
}

export function TalonariosPanel({ data }: TalonariosPanelProps) {
  const r = data.talonarios.resumen;

  const tipoCopiaOption = {
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '72%'], label: { formatter: '{b}: {d}%' }, data: data.talonarios.mixTipoCopia.map((i) => ({ name: i.tipo_copia, value: i.total_ventas })) }],
  };

  const tintasOption = {
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['42%', '72%'], label: { formatter: '{b}: {d}%' }, data: data.talonarios.mixTintas.map((i) => ({ name: i.tinta_label, value: i.total_ventas })) }],
  };

  const medidasOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.talonarios.topMedidas.slice(0, 8).map((i) => i.medida_label) },
    series: [{ type: 'bar', data: data.talonarios.topMedidas.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#06b6d4', borderRadius: [0, 6, 6, 0] } }],
  };

  const materialesOption = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatCurrencyARS(Number(v || 0)) },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCurrencyARS(v) } },
    yAxis: { type: 'category', data: data.talonarios.topMateriales.slice(0, 8).map((i) => i.material_label) },
    series: [{ type: 'bar', data: data.talonarios.topMateriales.slice(0, 8).map((i) => i.total_ventas), itemStyle: { color: '#6366f1', borderRadius: [0, 6, 6, 0] } }],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Ventas Talonarios" value={formatCurrencyARS(r.total_ventas)} subtitle="Facturación del período" hint="Ventas de ítems Talonarios." icon={TrendingUp} tone="cyan" />
        <KPICard title="Órdenes" value={String(r.total_ordenes)} subtitle="Órdenes con Talonarios" hint="Cantidad de órdenes con al menos un ítem Talonarios." icon={Package} tone="emerald" />
        <KPICard title="Unidades" value={r.total_unidades.toFixed(0)} subtitle="Suma de cantidades" hint="Volumen total vendido." icon={Ruler} tone="indigo" />
        <KPICard title="Ticket promedio" value={formatCurrencyARS(r.ticket_promedio_orden)} subtitle="Ventas / órdenes" hint="Promedio por orden." icon={Layers} tone="amber" />
        <KPICard title="Precio prom. unidad" value={formatCurrencyARS(r.precio_promedio_unidad)} subtitle="Ventas / unidades" hint="Precio promedio unitario." icon={Package} tone="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4"><BISectionCard title="Mix tipo copia" description="Duplicado, triplicado, cuadruplicado."><ReactECharts option={tipoCopiaOption} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Mix tintas" description="Participación por tinta."><ReactECharts option={tintasOption} style={{ height: 320 }} /></BISectionCard></div>
        <div className="xl:col-span-4"><BISectionCard title="Top medidas" description="Facturación por medida."><ReactECharts option={medidasOption} style={{ height: 320 }} /></BISectionCard></div>
      </div>

      <BISectionCard title="Top materiales/variantes" description="Materiales con mayor facturación.">
        <ReactECharts option={materialesOption} style={{ height: 340 }} />
      </BISectionCard>
    </div>
  );
}
