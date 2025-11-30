export interface ReporteGeneralKPIs {
  total_ventas: number;
  total_ordenes: number;
  ticket_promedio: number;
  total_cobrado: number;
  saldo_pendiente: number;
  tasa_cobro: number;
  variacion_ventas: number;
  variacion_ordenes: number;
}

export interface VentasPorCanal {
  canal: string;
  total_ventas: number;
  total_ordenes: number;
  ordenes_trabajo: number;
  ordenes_copiado: number;
  porcentaje_ventas: number;
  porcentaje_ordenes: number;
  ticket_promedio: number;
}

export interface VentasPorCategoria {
  categoria_nombre: string;
  total_ventas: number;
  total_ordenes: number;
  porcentaje: number;
  ticket_promedio: number;
}

export interface VentasPorDiaSemana {
  dia_semana: number;
  dia_nombre: string;
  total_ventas: number;
  total_ordenes: number;
  ticket_promedio: number;
  porcentaje_ordenes: number;
}

export interface VentasPorHora {
  hora: number;
  rango_horario: string;
  total_ordenes: number;
  porcentaje: number;
}

export interface VentasPorUsuario {
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  total_ventas: number;
  total_ordenes: number;
  ticket_promedio: number;
  porcentaje: number;
}

export interface TasaSenaData {
  total_ventas: number;
  total_cobrado: number;
  saldo_pendiente: number;
  total_ordenes: number;
  ordenes_con_sena: number;
  ordenes_sin_sena: number;
  tasa_sena_promedio: number;
  porcentaje_ordenes_con_sena: number;
  monto_sena_promedio: number;
}

export interface TimelineData {
  fecha: string;
  total_ventas: number;
  total_ordenes: number;
  ordenes_trabajo: number;
  ordenes_copiado: number;
  ticket_promedio: number;
}

export interface TopProducto {
  producto_nombre: string;
  categoria_nombre: string;
  total_vendido: number;
  unidades_vendidas: number;
  porcentaje: number;
  ticket_promedio: number;
}

export interface IngresosEgresosData {
  fecha: string;
  periodo_label: string;
  ingresos: number;
  egresos: number;
  balance: number;
}

export interface ReporteGeneralData {
  kpis: ReporteGeneralKPIs | null;
  timeline: TimelineData[];
  ingresosEgresos: IngresosEgresosData[];
  porCanal: VentasPorCanal[];
  porCategoria: VentasPorCategoria[];
  topProductos: TopProducto[];
  porDiaSemana: VentasPorDiaSemana[];
  porHora: VentasPorHora[];
  porUsuario: VentasPorUsuario[];
  tasaSena: TasaSenaData | null;
}

export type PeriodoPreset =
  | 'hoy'
  | 'esta_semana'
  | 'este_mes'
  | 'mes_pasado'
  | 'ultimos_3_meses'
  | 'ultimos_6_meses'
  | 'este_anio'
  | 'anio_pasado'
  | 'personalizado';
