import { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Layers, Package, Ruler, TrendingUp } from 'lucide-react';
import { useBIProductos } from '../../../hooks/useBIProductos';
import type { BIQueryParams } from '../../../hooks/biShared';
import { BISectionCard } from '../../../components/business-intelligence-v2/BISectionCard';
import { KPICard } from '../../../components/business-intelligence-v2/KPICard';
import { BIErrorState, BILoadingState } from '../../../components/business-intelligence-v2/BIState';
import { CATEGORIAS_SISTEMA } from '../../../constants/categorias';
import { formatCurrencyARS } from '../../../components/business-intelligence-v2/currency';
import { TalonariosPanel } from '../../../components/business-intelligence-v2/productos/TalonariosPanel';
import { PlotterPanel } from '../../../components/business-intelligence-v2/productos/PlotterPanel';
import { RigidosPanel } from '../../../components/business-intelligence-v2/productos/RigidosPanel';
import { SellosPanel } from '../../../components/business-intelligence-v2/productos/SellosPanel';
import { PortabannersPanel } from '../../../components/business-intelligence-v2/productos/PortabannersPanel';

interface ProductosTabProps {
  params: BIQueryParams;
}

const formatDate = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-AR') : 'N/D');

const BI_PRODUCT_CATEGORIES = [
  { value: CATEGORIAS_SISTEMA.IMPRESION_LASER.nombre, label: 'Impresion Laser' },
  { value: CATEGORIAS_SISTEMA.TALONARIOS.nombre, label: 'Talonarios' },
  { value: CATEGORIAS_SISTEMA.IMPRESION_GRAN_FORMATO.nombre, label: 'Gran Formato' },
  { value: CATEGORIAS_SISTEMA.MATERIALES_RIGIDOS.nombre, label: 'Materiales Rigidos' },
  { value: CATEGORIAS_SISTEMA.PLOTTER_CORTE.nombre, label: 'Plotter de Corte' },
  { value: CATEGORIAS_SISTEMA.SELLOS.nombre, label: 'Sellos' },
  { value: CATEGORIAS_SISTEMA.PORTABANNERS.nombre, label: 'Portabanners' },
  { value: 'Personalizado', label: 'Personalizado' },
] as const;

export function ProductosTab({ params }: ProductosTabProps) {
  const [categoria, setCategoria] = useState('Impresion Laser');
  const [tecnologiaGranFormato, setTecnologiaGranFormato] = useState<string>('__all__');
  const productos = useBIProductos({
    ...params,
    categoria,
    tecnologiaGranFormato: categoria === CATEGORIAS_SISTEMA.IMPRESION_GRAN_FORMATO.nombre && tecnologiaGranFormato !== '__all__'
      ? tecnologiaGranFormato
      : null,
  });
  const isLaser = categoria === CATEGORIAS_SISTEMA.IMPRESION_LASER.nombre;
  const isGranFormato = categoria === CATEGORIAS_SISTEMA.IMPRESION_GRAN_FORMATO.nombre;
  const isTalonarios = categoria === CATEGORIAS_SISTEMA.TALONARIOS.nombre;
  const isPlotter = categoria === CATEGORIAS_SISTEMA.PLOTTER_CORTE.nombre;
  const isRigidos = categoria === CATEGORIAS_SISTEMA.MATERIALES_RIGIDOS.nombre;
  const isSellos = categoria === CATEGORIAS_SISTEMA.SELLOS.nombre;
  const isPortabanners = categoria === CATEGORIAS_SISTEMA.PORTABANNERS.nombre;

  if (productos.loading) return <BILoadingState label="Cargando analítica de productos..." />;
  if (productos.error) return <BIErrorState message={productos.error} />;
  if (!productos.data) return <BIErrorState message="No hay datos de productos disponibles." />;

  const categoriasOptions = BI_PRODUCT_CATEGORIES;

  const topProductosOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => formatCurrencyARS(Number(value || 0)),
    },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrencyARS(value) } },
    yAxis: {
      type: 'category',
      data: productos.data.topProductos.slice(0, 10).map((p) => p.producto_nombre),
    },
    series: [
      {
        type: 'bar',
        data: productos.data.topProductos.slice(0, 10).map((p) => p.total_ventas),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#0ea5e9' },
      },
    ],
  };

  const categoriasMixOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${formatCurrencyARS(Number(params.value || 0))} (${Number(params.percent || 0).toFixed(1)}%)`,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        label: { formatter: '{b}: {d}%' },
        data: productos.data.categorias.slice(0, 8).map((c) => ({
          name: c.categoria_nombre,
          value: c.total_ventas,
        })),
      },
    ],
  };

  const laserMedidasOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: productos.data.laserMedidas.slice(0, 10).map((m) => m.medida_label),
    },
    series: [
      {
        type: 'bar',
        data: productos.data.laserMedidas.slice(0, 10).map((m) => m.total_unidades),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#6366f1' },
      },
    ],
  };

  const laserTintasOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${formatCurrencyARS(Number(params.value || 0))} (${Number(params.percent || 0).toFixed(1)}%)`,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        label: { formatter: '{b}: {d}%' },
        data: productos.data.laserTintas.map((t) => ({ name: t.tinta_label, value: t.total_ventas })),
      },
    ],
  };

  const laserCarasOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        label: { formatter: '{b}: {d}%' },
        data: productos.data.laserCaras.map((c) => ({ name: c.cara_label, value: c.total_unidades })),
      },
    ],
  };

  const granFormatoMixTipoVentaOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${formatCurrencyARS(Number(params.value || 0))} (${Number(params.percent || 0).toFixed(1)}%)`,
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        label: { formatter: '{b}: {d}%' },
        data: productos.data.granFormatoMixTipoVenta.map((t) => ({
          name: t.tipo_venta,
          value: t.total_ventas,
        })),
      },
    ],
  };

  const granFormatoMaterialesOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => formatCurrencyARS(Number(value || 0)),
    },
    grid: { left: 12, right: 12, top: 12, bottom: 24, containLabel: true },
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrencyARS(value) } },
    yAxis: {
      type: 'category',
      data: productos.data.granFormatoTopMateriales.slice(0, 8).map((m) => m.material_label),
    },
    series: [
      {
        type: 'bar',
        data: productos.data.granFormatoTopMateriales.slice(0, 8).map((m) => m.total_ventas),
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#06b6d4' },
      },
    ],
  };

  const techRows = productos.data.granFormatoTecnologiaUnidades;
  const tecnologias = Array.from(new Set(techRows.map((r) => r.tecnologia_label)));
  const granFormatoTecnologiaUnidadOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => formatCurrencyARS(Number(value || 0)),
    },
    legend: { bottom: 0 },
    grid: { left: 12, right: 12, top: 12, bottom: 42, containLabel: true },
    xAxis: {
      type: 'category',
      data: tecnologias,
      axisLabel: { rotate: 20 },
    },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrencyARS(value) } },
    series: [
      {
        name: 'Metro cuadrado',
        type: 'bar',
        stack: 'ventas',
        data: tecnologias.map((t) =>
          techRows
            .filter((r) => r.tecnologia_label === t && r.tipo_venta === 'Metro cuadrado')
            .reduce((acc, cur) => acc + cur.total_ventas, 0)
        ),
        itemStyle: { color: '#0ea5e9', borderRadius: [6, 6, 0, 0] },
      },
      {
        name: 'Metro lineal',
        type: 'bar',
        stack: 'ventas',
        data: tecnologias.map((t) =>
          techRows
            .filter((r) => r.tecnologia_label === t && r.tipo_venta === 'Metro lineal')
            .reduce((acc, cur) => acc + cur.total_ventas, 0)
        ),
        itemStyle: { color: '#22c55e', borderRadius: [6, 6, 0, 0] },
      },
    ],
  };

  return (
    <div className="space-y-5">
      <BISectionCard
        title="Filtro de categoría"
        description="Analiza métricas de producto por categoría comercial."
        right={<span className="text-[11px] font-medium text-slate-500">Corte por categoría</span>}
      >
        <div className="max-w-sm">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => {
              const next = e.target.value;
              setCategoria(next);
              if (next !== CATEGORIAS_SISTEMA.IMPRESION_GRAN_FORMATO.nombre) {
                setTecnologiaGranFormato('__all__');
              }
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-cyan-400 focus:ring-2"
          >
            {categoriasOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </BISectionCard>

      {isLaser && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPICard title="Ventas categoría" value={formatCurrencyARS(productos.data.resumen.total_ventas)} subtitle="Facturación del período" hint="Total vendido en Impresión Laser para el rango seleccionado." icon={TrendingUp} tone="cyan" />
            <KPICard title="Unidades vendidas" value={productos.data.resumen.total_unidades.toFixed(0)} subtitle="Suma de cantidades" hint="Volumen total vendido de ítems de láser." icon={Ruler} tone="indigo" />
            <KPICard title="Órdenes con láser" value={String(productos.data.resumen.total_ordenes)} subtitle="Órdenes únicas" hint="Órdenes que incluyen al menos un ítem de Impresión Laser." icon={Package} tone="emerald" />
            <KPICard title="Ticket por orden" value={formatCurrencyARS(productos.data.resumen.ticket_promedio_orden)} subtitle="Ventas / órdenes" hint="Promedio de facturación por orden con ítems láser." icon={Layers} tone="amber" />
            <KPICard title="Precio prom. unidad" value={formatCurrencyARS(productos.data.resumen.precio_promedio_unidad)} subtitle={`${productos.data.resumen.productos_unicos} productos únicos`} hint="Precio promedio por unidad vendida en láser." icon={Package} tone="cyan" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <BISectionCard title="Top productos" description="Ranking por facturación de la categoría seleccionada.">
                <ReactECharts option={topProductosOption} style={{ height: 360 }} />
              </BISectionCard>
            </div>
            <div className="xl:col-span-5">
              <BISectionCard title="Mix de categorías" description="Participación de ventas por categoría (global período).">
                <ReactECharts option={categoriasMixOption} style={{ height: 360 }} />
              </BISectionCard>
            </div>
          </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <BISectionCard title="Medidas más vendidas" description="Unidades vendidas por medida (ancho x alto).">
              <ReactECharts option={laserMedidasOption} style={{ height: 340 }} />
            </BISectionCard>
          </div>
          <div className="xl:col-span-3">
            <BISectionCard title="Mix de tintas" description="Distribución de ventas por tinta en láser.">
              <ReactECharts option={laserTintasOption} style={{ height: 340 }} />
            </BISectionCard>
          </div>
          <div className="xl:col-span-4">
            <BISectionCard title="Caras impresas" description="Solo frente vs frente y dorso (volumen).">
              <ReactECharts option={laserCarasOption} style={{ height: 340 }} />
            </BISectionCard>
          </div>
        </div>
        </>
      )}

      {isGranFormato && (
        <>
          <BISectionCard
            title="Filtro de tecnología"
            description="Segmenta métricas de gran formato por tecnología para no mezclar unidades de venta."
          >
            <div className="max-w-sm">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Tecnología</label>
              <select
                value={tecnologiaGranFormato}
                onChange={(e) => setTecnologiaGranFormato(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-cyan-400 focus:ring-2"
              >
                <option value="__all__">Todas</option>
                {productos.data.granFormatoTecnologiasDisponibles.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </BISectionCard>

          {productos.data.granFormatoResumen.total_items === 0 ? (
            <BISectionCard
              title="Sin datos de Gran Formato"
              description={`No hay ítems de Impresión Gran Formato en el período seleccionado (${params.fechaInicio} a ${params.fechaFin})${tecnologiaGranFormato !== '__all__' ? ` para la tecnología ${tecnologiaGranFormato}` : ''}.`}
            >
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {productos.data.actividadCategoria.total_items_historico > 0 ? (
                  <span>
                    Hay actividad histórica: {productos.data.actividadCategoria.total_items_historico} ítems.
                    Primera venta: {formatDate(productos.data.actividadCategoria.primera_venta)}.
                    Última venta: {formatDate(productos.data.actividadCategoria.ultima_venta)}.
                    Amplía el período para visualizar métricas.
                  </span>
                ) : (
                  <span>No se detectó actividad histórica para esta categoría.</span>
                )}
              </div>
            </BISectionCard>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <KPICard title="Ventas gran formato" value={formatCurrencyARS(productos.data.granFormatoResumen.total_ventas)} subtitle="Facturación del período" hint="Total vendido en ítems de gran formato." icon={TrendingUp} tone="cyan" />
                <KPICard title="Líneas técnicas" value={productos.data.granFormatoResumen.total_lineas.toFixed(0)} subtitle="Líneas de medidas registradas" hint="Cantidad total de líneas técnicas utilizadas para cotizar/vender gran formato." icon={Ruler} tone="indigo" />
                <KPICard title="Total m² estimado" value={productos.data.granFormatoResumen.total_mt2.toFixed(2)} subtitle="Superficie acumulada" hint="Suma estimada de metros cuadrados en líneas de gran formato." icon={Layers} tone="cyan" />
                <KPICard title="Precio prom. por m²" value={formatCurrencyARS(productos.data.granFormatoResumen.precio_promedio_mt2)} subtitle="Ventas / m²" hint="Facturación promedio por metro cuadrado estimado en el período." icon={TrendingUp} tone="amber" />
                <KPICard title="Precio prom. por ml" value={formatCurrencyARS(productos.data.granFormatoResumen.precio_promedio_ml)} subtitle="Ventas / ml" hint="Facturación promedio por metro lineal estimado en el período." icon={Package} tone="emerald" />
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <BISectionCard title="Tecnología + unidad de venta" description="Facturación segmentada por tecnología y unidad (m² vs metro lineal).">
                    <ReactECharts option={granFormatoTecnologiaUnidadOption} style={{ height: 340 }} />
                  </BISectionCard>
                </div>
                <div className="xl:col-span-4">
                  <BISectionCard title="Mix tipo de venta" description="Participación de ingresos por metro cuadrado vs metro lineal.">
                    <ReactECharts option={granFormatoMixTipoVentaOption} style={{ height: 340 }} />
                  </BISectionCard>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <BISectionCard title="Top materiales y variantes" description="Materiales más facturados en gran formato.">
                    <ReactECharts option={granFormatoMaterialesOption} style={{ height: 340 }} />
                  </BISectionCard>
                </div>
                <div className="xl:col-span-4">
                  <BISectionCard title="Detalle tecnología/unidad" description="Precio promedio según tecnología y unidad operativa.">
                    <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Tecnología</th>
                            <th className="px-3 py-2">Unidad</th>
                            <th className="px-3 py-2">Precio prom.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {techRows.slice(0, 30).map((row, idx) => (
                            <tr key={`${row.tecnologia_label}-${row.tipo_venta}-${idx}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{row.tecnologia_label}</td>
                              <td className="px-3 py-2 text-slate-600">{row.tipo_venta}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {row.tipo_venta === 'Metro lineal'
                                  ? `${formatCurrencyARS(row.precio_promedio_ml)} / ml`
                                  : `${formatCurrencyARS(row.precio_promedio_mt2)} / m²`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </BISectionCard>
                </div>
              </div>

            </>
          )}
        </>
      )}

      {isTalonarios && <TalonariosPanel data={productos.data} />}
      {isPlotter && <PlotterPanel data={productos.data} />}
      {isRigidos && <RigidosPanel data={productos.data} />}
      {isSellos && <SellosPanel data={productos.data} />}
      {isPortabanners && <PortabannersPanel data={productos.data} />}

      {!isLaser && !isGranFormato && !isTalonarios && !isPlotter && !isRigidos && !isSellos && !isPortabanners && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPICard title="Ventas categoría" value={formatCurrencyARS(productos.data.resumen.total_ventas)} subtitle="Facturación del período" hint="Total vendido por la categoría elegida." icon={TrendingUp} tone="cyan" />
            <KPICard title="Unidades vendidas" value={productos.data.resumen.total_unidades.toFixed(0)} subtitle="Suma de cantidades" hint="Volumen total vendido para la categoría." icon={Ruler} tone="indigo" />
            <KPICard title="Órdenes con la categoría" value={String(productos.data.resumen.total_ordenes)} subtitle="Órdenes únicas" hint="Cantidad de órdenes que incluyen al menos un ítem de esta categoría." icon={Package} tone="emerald" />
            <KPICard title="Ticket por orden" value={formatCurrencyARS(productos.data.resumen.ticket_promedio_orden)} subtitle="Ventas / órdenes" hint="Promedio de facturación por orden con esta categoría." icon={Layers} tone="amber" />
            <KPICard title="Precio prom. unidad" value={formatCurrencyARS(productos.data.resumen.precio_promedio_unidad)} subtitle={`${productos.data.resumen.productos_unicos} productos únicos`} hint="Precio promedio por unidad vendida en la categoría." icon={Package} tone="cyan" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <BISectionCard title="Top productos" description="Ranking por facturación de la categoría seleccionada.">
                <ReactECharts option={topProductosOption} style={{ height: 360 }} />
              </BISectionCard>
            </div>
            <div className="xl:col-span-5">
              <BISectionCard title="Mix de categorías" description="Participación de ventas por categoría (global período).">
                <ReactECharts option={categoriasMixOption} style={{ height: 360 }} />
              </BISectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
