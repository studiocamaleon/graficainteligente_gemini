import { EstadoOrdenTrabajo, TipoEventoHistorial, TasaCumplimiento } from './database';

export interface DashboardStats {
  ordenesPendientes: number;
  ordenesEnProceso: number;
  entregasHoy: number;
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

export interface ActividadReciente {
  id: string;
  tipo_evento: TipoEventoHistorial;
  descripcion: string;
  orden_numero: string;
  orden_id: string;
  usuario_nombre: string | null;
  tiempo_relativo: string;
  created_at: string;
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
