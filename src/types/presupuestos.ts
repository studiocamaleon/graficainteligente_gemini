/**
 * Types e interfaces para el Módulo de Negociación (Presupuestos)
 */

// ============================================================================
// ENUMS Y TIPOS
// ============================================================================

export type EstadoPresupuesto =
  | 'borrador'
  | 'pendiente'
  | 'enviado'
  | 'aprobado'
  | 'rechazado'
  | 'convertido'
  | 'vencido';

export type CanalVenta = 'Web' | 'WhatsApp' | 'Mostrador' | 'App Mobile';

export type TipoItemPresupuesto = 'producto_sistema' | 'item_personalizado' | 'centro_copiado';

export type AccionHistorial =
  | 'creado'
  | 'modificado'
  | 'cambio_estado'
  | 'enviado'
  | 'aprobado'
  | 'rechazado'
  | 'convertido'
  | 'vencido'
  | 'eliminado';

// ============================================================================
// INTERFACE: Presupuesto
// ============================================================================

export interface Presupuesto {
  id: string;
  company_id: string;
  cliente_id: string;
  numero_presupuesto: string;
  vendedor_id: string;
  canal_venta: CanalVenta;
  estado: EstadoPresupuesto;

  // Fechas
  fecha_creacion: string;
  fecha_validez?: string;
  fecha_enviado?: string;
  fecha_respuesta?: string;
  fecha_vencimiento_auto?: string;

  // Tracking
  tracking_token?: string;

  // Montos
  subtotal: number;
  total_descuentos: number;
  total: number;

  // Textos
  condiciones_comerciales?: string;
  notas_internas?: string;
  observaciones_cliente?: string;

  // Conversión
  orden_trabajo_id?: string;

  // Archivos
  pdf_path?: string;
  pdf_url?: string;

  // Auditoría
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// INTERFACE: PresupuestoConRelaciones (para queries con joins)
// ============================================================================

export interface PresupuestoConRelaciones extends Presupuesto {
  cliente?: {
    id: string;
    razon_social: string;
    nombre_fantasia?: string;
    email?: string;
    whatsapp?: string;
  };
  vendedor?: {
    id: string;
    full_name: string;
    email: string;
  };
  orden_trabajo?: {
    id: string;
    numero_orden: string;
    estado: string;
  };
  items_count?: number;
  archivos_count?: number;
}

// ============================================================================
// INTERFACE: PresupuestoItem
// ============================================================================

export interface PresupuestoItem {
  id: string;
  presupuesto_id: string;
  tipo_item: TipoItemPresupuesto;

  // Producto
  producto_id?: string;
  producto_nombre: string;
  producto_categoria?: string;

  // Configuración (estructura varía según tipo de producto)
  configuracion: Record<string, any>;

  // Cantidades y precios
  cantidad: number;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number | null; // NULL indica pendiente de cotización
  precio_total: number | null; // NULL indica pendiente de cotización

  // Adicionales
  descripcion?: string;
  tiempo_produccion_dias?: number;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// INTERFACE: PresupuestoItemConProducto
// ============================================================================

export interface PresupuestoItemConProducto extends PresupuestoItem {
  producto?: {
    id: string;
    nombre: string;
    categoria: string;
    is_active: boolean;
  };
}

// ============================================================================
// INTERFACE: CondicionComercial
// ============================================================================

export interface CondicionComercial {
  id: string;
  company_id: string;
  nombre: string;
  contenido: string;
  es_default: boolean;
  orden: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// INTERFACE: PresupuestoArchivo
// ============================================================================

export interface PresupuestoArchivo {
  id: string;
  presupuesto_id?: string;
  company_id: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  descripcion?: string;
  uploaded_by: string;
  created_at: string;

  // Temporales
  presupuesto_temporal_id?: string;
  temporal_creado_en?: string;
}

// ============================================================================
// INTERFACE: PresupuestoHistorial
// ============================================================================

export interface PresupuestoHistorial {
  id: string;
  presupuesto_id: string;
  accion: AccionHistorial;
  estado_anterior?: string;
  estado_nuevo?: string;
  usuario_id?: string;
  detalles?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// INTERFACE: PresupuestoHistorialConUsuario
// ============================================================================

export interface PresupuestoHistorialConUsuario extends PresupuestoHistorial {
  usuario?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// ============================================================================
// DTOs PARA CREAR/ACTUALIZAR
// ============================================================================

export interface CreatePresupuestoData {
  cliente_id: string;
  vendedor_id: string;
  canal_venta: CanalVenta;
  fecha_entrega_estimada?: string;
  fecha_validez?: string;
  condiciones_comerciales?: string;
  notas_internas?: string;
  estado?: EstadoPresupuesto; // Opcional, default 'borrador'
}

export interface UpdatePresupuestoData {
  fecha_validez?: string;
  condiciones_comerciales?: string;
  notas_internas?: string;
  observaciones_cliente?: string;
  estado?: EstadoPresupuesto;
  pdf_path?: string;
  pdf_url?: string;
  total_descuentos?: number;
}

export interface CreatePresupuestoItemData {
  presupuesto_id: string;
  tipo_item: TipoItemPresupuesto;
  producto_id?: string;
  producto_nombre: string;
  producto_categoria?: string;
  configuracion: Record<string, any>;
  cantidad: number;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number | null; // Puede ser null para cotización pendiente
  precio_total: number | null; // Puede ser null para cotización pendiente
  descripcion?: string;
  tiempo_produccion_dias?: number;
}

export interface UpdatePresupuestoItemData {
  cantidad?: number;
  precio_base?: number;
  precio_servicios?: number;
  precio_acabados?: number;
  precio_unitario_final?: number | null;
  precio_total?: number | null;
  descripcion?: string;
  tiempo_produccion_dias?: number;
  configuracion?: Record<string, any>;
}

export interface CreateItemPersonalizadoData {
  presupuesto_id: string;
  producto_nombre: string;
  descripcion: string;
  cantidad: number;
  precio_unitario_final?: number | null; // Opcional, puede dejarse para cotizar después
  tiempo_produccion_dias?: number;
}

export interface CreateCondicionComercialData {
  nombre: string;
  contenido: string;
  es_default?: boolean;
  orden?: number;
  is_active?: boolean;
}

export interface UpdateCondicionComercialData {
  nombre?: string;
  contenido?: string;
  es_default?: boolean;
  orden?: number;
  is_active?: boolean;
}

export interface CreatePresupuestoArchivoData {
  presupuesto_id?: string;
  presupuesto_temporal_id?: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  descripcion?: string;
}

// ============================================================================
// INTERFACE: ConvertirPresupuestoData
// ============================================================================

export interface ConvertirPresupuestoData {
  presupuesto_id: string;
  fecha_entrega_estimada?: string;
  notas_adicionales?: string;
}

export interface ConvertirPresupuestoResult {
  success: boolean;
  orden_trabajo_id?: string;
  numero_orden?: string;
  items_copiados: number;
  items_personalizados_no_copiados: number;
  mensaje?: string;
  error?: string;
}

// ============================================================================
// COTIZACIONES PENDIENTES
// ============================================================================

export interface ItemPendienteCotizacion {
  id: string;
  producto_nombre: string;
  descripcion?: string;
  cantidad: number;
  configuracion?: Record<string, any>;
}

export interface TotalesPresupuesto {
  subtotal: number;
  totalItems: number;
  totalUnidades: number;
  itemsCompletos: number;
  itemsPendientes: number;
  tienePendientes: boolean;
}

export interface PresupuestoValidationState {
  puedeEnviar: boolean;
  mensajeValidacion: string | null;
  porcentajeCompletitud: number;
  esCompleto: boolean;
}

// ============================================================================
// FILTROS Y BÚSQUEDA
// ============================================================================

export interface PresupuestosFilters {
  search?: string; // Búsqueda por número o cliente
  estado?: EstadoPresupuesto | EstadoPresupuesto[];
  canal_venta?: CanalVenta | CanalVenta[];
  vendedor_id?: string;
  cliente_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_vencidos?: boolean;
  solo_pendientes_respuesta?: boolean;
}

export interface PresupuestosPaginacion {
  page?: number;
  limit?: number;
  order_by?: 'fecha_creacion' | 'numero_presupuesto' | 'total' | 'estado';
  order_direction?: 'asc' | 'desc';
}

// ============================================================================
// RESPUESTAS DE API
// ============================================================================

export interface PresupuestosResponse {
  presupuestos: PresupuestoConRelaciones[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============================================================================
// ESTADÍSTICAS Y MÉTRICAS
// ============================================================================

export interface PresupuestosStats {
  total_presupuestos: number;
  por_estado: Record<EstadoPresupuesto, number>;
  valor_total_en_negociacion: number;
  tasa_conversion: number; // % de aprobados vs enviados
  tiempo_promedio_respuesta_horas: number;
  presupuestos_por_vencer_7_dias: number;
  presupuestos_pendientes_cotizar: number; // Presupuestos en borrador con items sin precio
}

// ============================================================================
// TRACKING PÚBLICO
// ============================================================================

export interface PresupuestoTrackingPublico {
  id: string;
  numero_presupuesto: string;
  estado: EstadoPresupuesto;
  fecha_creacion: string;
  fecha_validez?: string;
  fecha_enviado?: string;
  subtotal: number;
  total: number;
  condiciones_comerciales?: string;
  pdf_url?: string;

  // Info de la empresa
  company_name: string;
  company_address?: string;
  company_phone?: string;

  // Items
  items: Array<{
    producto_nombre: string;
    producto_categoria?: string;
    cantidad: number;
    precio_unitario_final: number | null;
    precio_total: number | null;
    descripcion?: string;
    tiempo_produccion_dias?: number;
  }>;

  // Permisos de acción para el cliente
  puede_aprobar: boolean;
  puede_rechazar: boolean;
}

// ============================================================================
// ACCIONES DEL CLIENTE (TRACKING PÚBLICO)
// ============================================================================

export interface AprobarPresupuestoData {
  tracking_token: string;
  observaciones?: string;
}

export interface RechazarPresupuestoData {
  tracking_token: string;
  motivo_rechazo: string;
  observaciones?: string;
}

// ============================================================================
// NOTIFICACIONES WHATSAPP
// ============================================================================

export interface NotificacionPresupuestoData {
  presupuesto_id: string;
  tipo_notificacion:
  | 'presupuesto_creado'
  | 'presupuesto_listo'
  | 'presupuesto_enviado'
  | 'presupuesto_aprobado'
  | 'presupuesto_rechazado'
  | 'presupuesto_vencido';
  telefono_destino: string;
  datos_adicionales?: Record<string, any>;
}

// ============================================================================
// VALIDACIONES
// ============================================================================

export interface PresupuestoValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ItemValidationResult {
  isValid: boolean;
  errors: string[];
}
