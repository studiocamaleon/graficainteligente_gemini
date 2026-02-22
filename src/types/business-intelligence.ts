export type BIGranularidad = 'dia' | 'semana' | 'mes';
export type BIPreset =
  | 'hoy'
  | 'esta_semana'
  | 'este_mes'
  | 'mes_pasado'
  | 'ultimos_3_meses'
  | 'ultimos_6_meses'
  | 'este_anio'
  | 'anio_pasado'
  | 'personalizado';

export interface BIMeta {
  fecha_inicio: string;
  fecha_fin: string;
  timezone: 'America/Argentina/Buenos_Aires';
  criterio_fecha: 'creacion_ot_oc';
  version_calculo: 'bi_v2';
}

export interface BIExecutiveData {
  revenue_total: number;
  revenue_growth_pct: number;
  total_orders: number;
  ticket_promedio: number;
  cash_margin_pct: number;
  brecha_cobranza: number;
  canal_dominante: string;
  canal_concentracion_pct: number;
}

export interface BIVentasTimelineItem {
  periodo: string;
  periodo_label: string;
  total_ventas: number;
  total_ordenes: number;
  ordenes_ot: number;
  ordenes_oc: number;
  ticket_promedio: number;
}

export interface BIVentasCanalItem {
  canal: string;
  total_ventas: number;
  total_ordenes: number;
  porcentaje_ventas: number;
  ticket_promedio: number;
}

export interface BIVentasCategoriaItem {
  categoria_nombre: string;
  total_ventas: number;
  total_ordenes: number;
  porcentaje_ventas: number;
  ticket_promedio: number;
}

export interface BITopProductoItem {
  producto_nombre: string;
  categoria_nombre: string;
  total_vendido: number;
  unidades_vendidas: number;
  porcentaje_ventas: number;
  ticket_promedio: number;
}

export interface BIHeatmapItem {
  dia_semana: number;
  hora: number;
  total_ordenes: number;
}

export interface BIVentasData {
  timeline: BIVentasTimelineItem[];
  canales: BIVentasCanalItem[];
  categorias: BIVentasCategoriaItem[];
  topProductos: BITopProductoItem[];
  heatmap: BIHeatmapItem[];
}

export interface BIProductosCategoriaItem {
  categoria_nombre: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosResumen {
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  ticket_promedio_orden: number;
  precio_promedio_unidad: number;
  productos_unicos: number;
}

export interface BIProductosTopItem {
  producto_nombre: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  ticket_promedio_orden: number;
  precio_promedio_unidad: number;
}

export interface BIProductosLaserMedidaItem {
  medida_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosLaserTintaItem {
  tinta_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosLaserCaraItem {
  cara_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosGranFormatoResumen {
  total_ventas: number;
  total_ordenes: number;
  total_items: number;
  total_lineas: number;
  total_mt2: number;
  total_ml: number;
  ticket_promedio_orden: number;
  precio_promedio_mt2: number;
  precio_promedio_ml: number;
}

export interface BIProductosGranFormatoMixTipoVentaItem {
  tipo_venta: string;
  total_ventas: number;
  total_lineas: number;
  total_mt2: number;
  total_ml: number;
  porcentaje_ventas: number;
}

export interface BIProductosGranFormatoMaterialItem {
  material_label: string;
  total_ventas: number;
  total_lineas: number;
  total_mt2: number;
  total_ml: number;
}

export interface BIProductosGranFormatoAnchoItem {
  ancho_label: string;
  ancho_cm: number;
  total_ventas: number;
  total_lineas: number;
  total_ml: number;
}

export interface BIProductosGranFormatoTecnologiaUnidadItem {
  tecnologia_label: string;
  tipo_venta: string;
  total_ventas: number;
  total_lineas: number;
  total_mt2: number;
  total_ml: number;
  precio_promedio_mt2: number;
  precio_promedio_ml: number;
}

export interface BIProductosActividadCategoria {
  categoria_nombre: string;
  total_items_historico: number;
  primera_venta: string | null;
  ultima_venta: string | null;
}

export interface BIProductosTalonariosResumen {
  total_ventas: number;
  total_ordenes: number;
  total_unidades: number;
  ticket_promedio_orden: number;
  precio_promedio_unidad: number;
}

export interface BIProductosTalonariosTipoCopiaItem {
  tipo_copia: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  porcentaje_ventas: number;
}

export interface BIProductosTalonariosTintaItem {
  tinta_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  porcentaje_ventas: number;
}

export interface BIProductosTalonariosMedidaItem {
  medida_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosTalonariosMaterialItem {
  material_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosPlotterResumen {
  total_ventas: number;
  total_ordenes: number;
  total_unidades: number;
  total_ml: number;
  ticket_promedio_orden: number;
  precio_promedio_ml: number;
}

export interface BIProductosPlotterAnchoItem {
  ancho_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ml: number;
  porcentaje_ventas: number;
}

export interface BIProductosPlotterColorItem {
  color_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ml: number;
  porcentaje_ventas: number;
}

export interface BIProductosPlotterMarcaItem {
  marca_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ml: number;
  porcentaje_ventas: number;
}

export interface BIProductosPlotterMaterialItem {
  material_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ml: number;
}

export interface BIProductosRigidosResumen {
  total_ventas: number;
  total_ordenes: number;
  total_unidades: number;
  total_mt2: number;
  ticket_promedio_orden: number;
  precio_promedio_mt2: number;
}

export interface BIProductosRigidosVarianteEspesorItem {
  variante_espesor_label: string;
  total_ventas: number;
  total_unidades: number;
  total_mt2: number;
  porcentaje_ventas: number;
}

export interface BIProductosRigidosMaterialItem {
  material_label: string;
  total_ventas: number;
  total_unidades: number;
  total_mt2: number;
}

export interface BIProductosRigidosMedidaItem {
  medida_label: string;
  total_ventas: number;
  total_unidades: number;
  total_mt2: number;
}

export interface BIProductosSellosResumen {
  total_ventas: number;
  total_ordenes: number;
  total_unidades: number;
  ticket_promedio_orden: number;
  precio_promedio_unidad: number;
}

export interface BIProductosSellosTipoProductoItem {
  tipo_producto: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  porcentaje_ventas: number;
}

export interface BIProductosSellosTipoSelloItem {
  tipo_sello: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  porcentaje_ventas: number;
}

export interface BIProductosSellosMarcaItem {
  marca_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
  porcentaje_ventas: number;
}

export interface BIProductosSellosMedidaItem {
  medida_label: string;
  total_ventas: number;
  total_unidades: number;
  total_ordenes: number;
}

export interface BIProductosPortabannersResumen {
  total_ventas: number;
  total_ordenes: number;
  total_unidades: number;
  total_area_mt2: number;
  ticket_promedio_orden: number;
  precio_promedio_mt2: number;
}

export interface BIProductosPortabannersTecnologiaItem {
  tecnologia_label: string;
  total_ventas: number;
  total_unidades: number;
  total_area_mt2: number;
  porcentaje_ventas: number;
}

export interface BIProductosPortabannersMedidaItem {
  medida_label: string;
  total_ventas: number;
  total_unidades: number;
  total_area_mt2: number;
}

export interface BIProductosPortabannersAreaItem {
  rango_label: string;
  total_ventas: number;
  total_unidades: number;
  total_area_mt2: number;
}

export interface BIProductosData {
  categorias: BIProductosCategoriaItem[];
  categoriaSeleccionada: string;
  resumen: BIProductosResumen;
  topProductos: BIProductosTopItem[];
  laserMedidas: BIProductosLaserMedidaItem[];
  laserTintas: BIProductosLaserTintaItem[];
  laserCaras: BIProductosLaserCaraItem[];
  granFormatoResumen: BIProductosGranFormatoResumen;
  granFormatoMixTipoVenta: BIProductosGranFormatoMixTipoVentaItem[];
  granFormatoTopMateriales: BIProductosGranFormatoMaterialItem[];
  granFormatoTopAnchos: BIProductosGranFormatoAnchoItem[];
  granFormatoTecnologiaUnidades: BIProductosGranFormatoTecnologiaUnidadItem[];
  granFormatoTecnologiasDisponibles: string[];
  actividadCategoria: BIProductosActividadCategoria;
  talonarios: {
    resumen: BIProductosTalonariosResumen;
    mixTipoCopia: BIProductosTalonariosTipoCopiaItem[];
    mixTintas: BIProductosTalonariosTintaItem[];
    topMedidas: BIProductosTalonariosMedidaItem[];
    topMateriales: BIProductosTalonariosMaterialItem[];
  };
  plotter: {
    resumen: BIProductosPlotterResumen;
    mixAnchos: BIProductosPlotterAnchoItem[];
    mixColor: BIProductosPlotterColorItem[];
    mixMarca: BIProductosPlotterMarcaItem[];
    topMateriales: BIProductosPlotterMaterialItem[];
  };
  rigidos: {
    resumen: BIProductosRigidosResumen;
    mixVarianteEspesor: BIProductosRigidosVarianteEspesorItem[];
    topMateriales: BIProductosRigidosMaterialItem[];
    topMedidas: BIProductosRigidosMedidaItem[];
  };
  sellos: {
    resumen: BIProductosSellosResumen;
    mixTipoProducto: BIProductosSellosTipoProductoItem[];
    mixTipoSello: BIProductosSellosTipoSelloItem[];
    mixMarca: BIProductosSellosMarcaItem[];
    topMedidas: BIProductosSellosMedidaItem[];
  };
  portabanners: {
    resumen: BIProductosPortabannersResumen;
    mixTecnologia: BIProductosPortabannersTecnologiaItem[];
    topMedidas: BIProductosPortabannersMedidaItem[];
    areaResumen: BIProductosPortabannersAreaItem[];
  };
}

export interface BICajaData {
  ingresos_movimientos: number;
  egresos_movimientos: number;
  balance_movimientos: number;
  cobrado_periodo: number;
  pendiente_0_30: number;
  pendiente_31_60: number;
  pendiente_61_mas: number;
  dso_estimado: number;
  dso_por_categoria: {
    categoria_nombre: string;
    total_ordenes_cobradas: number;
    dso_promedio_dias: number;
    dso_mediana_dias: number;
  }[];
}

export interface BIClientesData {
  clientes_nuevos: number;
  clientes_activos: number;
  clientes_recurrentes: number;
  frecuencia_compra: number;
  recencia_media_dias: number;
  concentracion_top10_pct: number;
  ticket_promedio_cliente: number;
  ltv_promedio: number;
  ltv_mediano: number;
  clientes_con_compras_historicas: number;
  top_ltv_clientes: {
    cliente_id: string;
    cliente_nombre: string;
    ltv_total: number;
    total_ordenes: number;
    ticket_promedio: number;
  }[];
}

export interface BIOperacionData {
  lead_time_dias_habiles_prom: number;
  on_time_pct: number;
  backlog_activo: number;
  entregadas_periodo: number;
  ciclo_mediano_dias_habiles: number;
  tiempos_por_categoria: {
    categoria_nombre: string;
    total_entregadas: number;
    lead_time_dias_habiles_prom: number;
  }[];
}

export interface BIHookResult<T> {
  data: T | null;
  meta: BIMeta | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
