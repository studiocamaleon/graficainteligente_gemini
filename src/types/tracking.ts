export type TrackingEstadoOrden = 'pendiente' | 'en_proceso' | 'finalizada' | 'entregada' | 'cancelada';

export type TrackingEstadoPaso = 'pendiente' | 'en_proceso' | 'completado' | 'omitido' | 'pausado';

export type TrackingTipoEtapa = 'pre_prensa' | 'principal' | 'post_prensa' | 'instalacion';

export type CategoriaPausa = 'cliente' | 'materiales' | 'maquinaria' | 'personal' | 'externo' | 'otro';

export interface PausaInfo {
  esta_pausado: boolean;
  categoria_motivo?: CategoriaPausa;
  fecha_inicio_pausa?: string;
  tiempo_pausado_horas?: number;
}

export interface TrackingPaso {
  id: string;
  paso_nombre: string;
  tipo_etapa: TrackingTipoEtapa;
  orden: number;
  estado_paso: TrackingEstadoPaso;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  cantidad_pausas?: number;
  pausa_info?: PausaInfo;
}

export interface TrackingItem {
  id: string;
  producto_nombre: string;
  producto_categoria: string | null;
  cantidad: number;
  precio_unitario?: number | null;
  precio_total?: number | null;
  detalle?: Record<string, unknown> | null;
  estado: 'pendiente' | 'en_proceso' | 'finalizado';
  pasos: TrackingPaso[];
}

export interface CompanyBusinessHours {
  day_of_week: number;
  day_name: string;
  is_open: boolean;
  opening_time_1: string | null;
  closing_time_1: string | null;
  opening_time_2: string | null;
  closing_time_2: string | null;
}

export interface TrackingData {
  numero_orden: string;
  estado: TrackingEstadoOrden;
  fecha_creacion: string;
  fecha_estimada_entrega: string | null;
  cliente_nombre: string;
  company_id: string;
  company_address: string | null;
  company_phone: string | null;
  company_business_hours: CompanyBusinessHours[];
  items: TrackingItem[];
}

export interface TrackingError {
  error: string;
  message: string;
}

export type TrackingResponse = TrackingData | TrackingError;

export function isTrackingError(response: TrackingResponse): response is TrackingError {
  return 'error' in response;
}

export function getEstadoLabel(estado: TrackingEstadoOrden): string {
  const labels: Record<TrackingEstadoOrden, string> = {
    pendiente: 'Pendiente',
    en_proceso: 'En Producción',
    finalizada: 'Finalizada',
    entregada: 'Entregada',
    cancelada: 'Cancelada',
  };
  return labels[estado];
}

export function getEstadoPasoLabel(estado: TrackingEstadoPaso): string {
  const labels: Record<TrackingEstadoPaso, string> = {
    pendiente: 'Pendiente',
    en_proceso: 'En Proceso',
    completado: 'Completado',
    omitido: 'Omitido',
    pausado: 'Pausado',
  };
  return labels[estado];
}

export function getEtapaLabel(etapa: TrackingTipoEtapa): string {
  const labels: Record<TrackingTipoEtapa, string> = {
    pre_prensa: 'Pre-prensa',
    principal: 'Producción',
    post_prensa: 'Terminación',
    instalacion: 'Instalación',
  };
  return labels[etapa];
}

export function getCategoriaPausaLabel(categoria: CategoriaPausa): string {
  const labels: Record<CategoriaPausa, string> = {
    cliente: 'Esperando respuesta del cliente',
    materiales: 'Esperando materiales',
    maquinaria: 'Problema con maquinaria',
    personal: 'Problema de personal',
    externo: 'Factor externo',
    otro: 'Motivo de pausa',
  };
  return labels[categoria];
}

export function getCategoriaPausaIcon(categoria: CategoriaPausa): string {
  const icons: Record<CategoriaPausa, string> = {
    cliente: '👤',
    materiales: '📦',
    maquinaria: '⚙️',
    personal: '👥',
    externo: '🌐',
    otro: '⏸️',
  };
  return icons[categoria];
}

export function calculateItemProgress(pasos: TrackingPaso[]): {
  completados: number;
  total: number;
  porcentaje: number;
} {
  const total = pasos.length;
  const completados = pasos.filter((p) => p.estado_paso === 'completado').length;
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

  return { completados, total, porcentaje };
}
