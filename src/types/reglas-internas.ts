export type ReglaInternaEstado = 'borrador' | 'publicada';

export interface ReglaInternaSeccion {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReglaInternaItem {
  id: string;
  company_id: string;
  seccion_id: string;
  titulo: string;
  contenido: string;
  estado: ReglaInternaEstado;
  es_critica: boolean;
  version_publicada: number;
  orden: number;
  is_active: boolean;
  aplica_roles: string[] | null;
  fecha_vigencia_desde: string | null;
  fecha_vigencia_hasta: string | null;
  publicado_por: string | null;
  publicado_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReglaInternaAck {
  id: string;
  company_id: string;
  regla_id: string;
  regla_version: number;
  usuario_id: string;
  ack_at: string;
}

export interface ReglaInternaAckAdminView extends ReglaInternaAck {
  usuario_nombre: string;
  usuario_email: string;
  usuario_role: string;
}

export interface ReglaInternaListadoRow {
  seccion_id: string;
  seccion_nombre: string;
  seccion_descripcion: string | null;
  seccion_orden: number;
  regla_id: string;
  titulo: string;
  contenido: string;
  estado: ReglaInternaEstado;
  es_critica: boolean;
  version_publicada: number;
  regla_orden: number;
  aplica_roles: string[] | null;
  fecha_vigencia_desde: string | null;
  fecha_vigencia_hasta: string | null;
  publicado_at: string | null;
  actualizado_at: string;
}

export interface ReglaInternaPendiente {
  regla_id: string;
  seccion_nombre: string;
  titulo: string;
  contenido: string;
  version_publicada: number;
  publicado_at: string | null;
  aplica_roles: string[] | null;
}
