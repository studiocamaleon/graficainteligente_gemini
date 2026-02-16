import { EstadoOrdenTrabajo, TipoEventoHistorial, TasaCumplimiento } from './database';

export interface DashboardStats {
  // Ordenes de Trabajo (OT)
  ordenesPendientes: number;
  ordenesEnProceso: number;
  entregasHoy: number;
  visitasHoy: number;

  // Centro de Copiado (CC)
  copiadoPendientes: number;
  copiadoEnProceso: number;
  copiadoEntregasHoy: number;
}

export interface ProximaEntrega {
  id: string;
  numero_orden: string;
  cliente_nombre: string;
  fecha_estimada_entrega: string;
  dias_restantes: number;
  estado: EstadoOrdenTrabajo;
  progreso_porcentaje: number;
  nivel_urgencia: 'critico' | 'urgente' | 'proximo' | 'normal';
  total_pasos: number;
  pasos_completados: number;
}

export type TipoEventoProduccion = 'paso_iniciado' | 'paso_completado' | 'paso_pausado' | 'paso_reanudado';

export interface ActividadReciente {
  id: string;
  tipo: 'orden' | 'produccion';
  tipo_evento: TipoEventoHistorial | TipoEventoProduccion;
  descripcion: string;
  orden_numero: string;
  orden_id: string;
  usuario_nombre: string | null;
  tiempo_relativo: string;
  created_at: string;
  detalle_extra?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  tasaCumplimiento: TasaCumplimiento | null;
  proximasEntregas: ProximaEntrega[];
  actividadReciente: ActividadReciente[];
}

export type NivelUrgencia = 'critico' | 'urgente' | 'proximo' | 'normal';

export interface UrgenciaConfig {
  color: string;
  bgColor: string;
  textColor: string;
  label: string;
}

// -----------------------------
// Dashboard v2 (operativo)
// -----------------------------
export type DashboardScope = 'ot' | 'copiado';
export type DashboardPeriod = '7d' | '30d' | '90d' | 'mes_actual';
export type DashboardTrend = 'up' | 'down' | 'flat';

export interface DashboardKpiValue {
  value: number;
  prev: number;
  deltaAbs: number;
  deltaPct: number;
  trend: DashboardTrend;
}

export interface DashboardKpisV2 {
  pendientes: DashboardKpiValue;
  enProceso: DashboardKpiValue;
  vencidas: DashboardKpiValue;
  finalizadasPeriodo: DashboardKpiValue;
  cumplimiento: DashboardKpiValue;
  updatedAt: string | null;
}

export interface DashboardSeriesPoint {
  date: string;
  label: string;
  value: number;
}

export interface DashboardBacklogBucket {
  bucket: '0-2d' | '3-7d' | '8-14d' | '+14d' | string;
  value: number;
}

export interface DashboardSeriesV2 {
  creadas: DashboardSeriesPoint[];
  finalizadas: DashboardSeriesPoint[];
  cumplimiento: DashboardSeriesPoint[];
  backlogAging: DashboardBacklogBucket[];
}

export interface DashboardProximaEntregaV2 {
  id: string;
  tipo_orden: DashboardScope;
  numero_orden: string;
  cliente_nombre: string;
  fecha_estimada_entrega: string;
  dias_restantes: number;
  estado: string;
  nivel_urgencia: NivelUrgencia;
}

export interface DashboardActividadV2 {
  id: string;
  tipo: 'orden' | 'produccion';
  tipo_orden?: DashboardScope;
  tipo_evento: TipoEventoHistorial | TipoEventoProduccion | string;
  descripcion: string;
  orden_numero: string;
  orden_id: string;
  usuario_nombre: string | null;
  created_at: string;
  detalle_extra?: string | null;
}

export interface DashboardOperativoV2 {
  proximasEntregas: DashboardProximaEntregaV2[];
  actividadReciente: DashboardActividadV2[];
}
