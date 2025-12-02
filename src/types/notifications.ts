/**
 * Tipos para el Sistema de Notificaciones Internas
 * Incluye notificaciones de pausas prolongadas, pasos completados, etc.
 */

export type TipoNotificacion =
  | 'pausa_prolongada'
  | 'paso_completado'
  | 'orden_finalizada'
  | 'alerta_produccion'
  | 'sistema'
  | 'presupuesto_aprobado'
  | 'presupuesto_rechazado'
  | 'presupuesto_por_vencer'
  | 'presupuesto_vencido';

export type ReferenciaNotificacion =
  | 'orden_trabajo'
  | 'orden_item'
  | 'ruta_paso'
  | 'pausa'
  | 'presupuesto';

export interface NotificacionMetadata {
  orden_id?: string;
  orden_numero?: string;
  item_id?: string;
  ruta_id?: string;
  paso_nombre?: string;
  motivo_nombre?: string;
  categoria_motivo?: string;
  horas_pausado?: number;
  descripcion_pausa?: string;
  presupuesto_id?: string;
  numero_presupuesto?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  motivo_rechazo?: string;
  observaciones?: string;
  total?: number;
  [key: string]: any;
}

export interface Notificacion {
  id: string;
  company_id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  referencia_tipo: ReferenciaNotificacion | null;
  referencia_id: string | null;
  metadata: NotificacionMetadata;
  leida: boolean;
  leida_at: string | null;
  created_at: string;
}
