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
