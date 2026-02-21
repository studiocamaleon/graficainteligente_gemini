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
