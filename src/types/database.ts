export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer';

export type CompanyStatus = 'active' | 'suspended' | 'cancelled';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export type DocumentType = 'DNI' | 'CUIT' | 'CUIL';

export type TaxCondition =
  | 'Responsable Inscripto'
  | 'Monotributo'
  | 'Exento'
  | 'Consumidor Final'
  | 'Responsable No Inscripto';

export type PaymentTerm = 'Semanal' | 'Quincenal' | 'Mensual';

export type AccountType = 'Caja de Ahorro' | 'Cuenta Corriente';

export type BankIdentifierType = 'CBU' | 'CVU' | 'Alias';

export interface Bank {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  company_id: string;
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: DocumentType;
  numero_documento: string;
  whatsapp: string | null;
  email: string | null;
  domicilio: string | null;
  country_id: string | null;
  province_id: string | null;
  city_id: string | null;
  codigo_postal: string | null;
  banco: string | null;
  tipo_cuenta: AccountType | null;
  tipo_identificador_bancario: BankIdentifierType | null;
  identificador_bancario: string | null;
  acepta_transferencias: boolean;
  acepta_cheques: boolean;
  acepta_tarjetas_credito: boolean;
  acepta_otros: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderFormData {
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: DocumentType;
  numero_documento: string;
  whatsapp: string;
  email: string;
  domicilio: string;
  country_id: string;
  province_id: string;
  city_id: string;
  codigo_postal: string;
  banco: string;
  tipo_cuenta: AccountType | '';
  tipo_identificador_bancario: BankIdentifierType | '';
  identificador_bancario: string;
  acepta_transferencias: boolean;
  acepta_cheques: boolean;
  acepta_tarjetas_credito: boolean;
  acepta_otros: boolean;
}

export interface Country {
  id: string;
  name: string;
  iso_code: string;
  phone_code: string;
  is_active: boolean;
  company_id: string | null;
  is_global: boolean;
  created_at: string;
}

export interface Province {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  company_id: string | null;
  is_global: boolean;
  created_at: string;
}

export interface City {
  id: string;
  province_id: string;
  name: string;
  postal_code: string | null;
  is_active: boolean;
  company_id: string | null;
  is_global: boolean;
  created_at: string;
}

export interface CountryFormData {
  name: string;
  iso_code: string;
  phone_code: string;
}

export interface ProvinceFormData {
  country_id: string;
  name: string;
  code: string;
}

export interface CityFormData {
  province_id: string;
  name: string;
  postal_code: string;
}

export interface Client {
  id: string;
  company_id: string;
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: DocumentType;
  numero_documento: string;
  whatsapp: string | null;
  email: string | null;
  domicilio: string | null;
  country_id: string | null;
  province_id: string | null;
  city_id: string | null;
  codigo_postal: string | null;
  tiene_cuenta_corriente: boolean;
  acuerdo_pago: PaymentTerm | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  status: CompanyStatus;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  address: string | null;
  country_id: string | null;
  province_id: string | null;
  city_id: string | null;
  postal_code: string | null;
  legal_name: string | null;
  tax_id_type: DocumentType | null;
  tax_id_number: string | null;
  tax_condition: TaxCondition | null;
  timezone: string;
  currency: string;
  language: string;
  description: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  name: string;
  logo_url: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  address: string;
  country_id: string;
  province_id: string;
  city_id: string;
  postal_code: string;
  legal_name: string;
  tax_id_type: DocumentType | '';
  tax_id_number: string;
  tax_condition: TaxCondition | '';
  timezone: string;
  currency: string;
  language: string;
  description: string;
  industry: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  company_id: string | null;
  role: UserRole;
  custom_role_id: string | null;
  last_login: string | null;
  last_ip: string | null;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  features: string[];
  limits: {
    max_users: number;
    max_orders_per_month: number;
    storage_gb: number;
    support: string;
    api_access?: boolean;
    automations?: boolean;
    training?: boolean;
    sla?: boolean;
  };
  is_active: boolean;
  created_at: string;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  started_at: string;
  ends_at: string | null;
  created_at: string;
}

export interface CustomRole {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface UserIPRestriction {
  id: string;
  user_id: string;
  ip_address: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  module_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}

export type TintaType = 'K' | 'CMYK' | 'CMYK+W' | 'CMYK+V' | 'CMYK+W+V';

export type UnidadEspesor = 'gr' | 'mm';

export type EtapaPaso = 'Pre-prensa' | 'Produccion' | 'Terminacion' | 'Instalacion' | 'Entrega';

export type TipoImpactoPrecio =
  | 'sin_impacto'
  | 'precio_fijo'
  | 'por_unidad'
  | 'por_minuto'
  | 'porcentual'
  | 'por_mt2'
  | 'por_mt_lineal'
  | 'fijo_porcentual'
  | 'fijo_mt2'
  | 'fijo_mt_lineal'
  | 'fijo_minuto';

export type TipoMedida = 'medida_unica' | 'medidas_multiples' | 'ancho_maximo' | 'sin_medida';

export type CaraImpresa = 'solo_frente' | 'frente_y_dorso';

export interface MedidaDisponible {
  ancho: number;
  alto: number;
}

export interface EstacionTrabajo {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tecnologia {
  id: string;
  company_id: string;
  nombre: string;
  tintas: TintaType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TecnologiaTintaPaso {
  id: string;
  tecnologia_id: string;
  tinta: TintaType;
  paso_id: string;
  created_at: string;
  updated_at: string;
}

export interface TecnologiaTintaPasoFormData {
  tinta: TintaType;
  paso_id: string | null;
}

export type TipoCondicionRuta =
  | 'sin_condicion'
  | 'servicio_sin_nivel'
  | 'servicio_con_nivel'
  | 'acabado_sin_nivel'
  | 'acabado_con_nivel'
  | 'tecnologia_tinta';

export interface ConfiguracionCondicionServicioSinNivel {
  servicio_id: string;
}

export interface ConfiguracionCondicionServicioConNivel {
  servicio_id: string;
  mapeo_niveles: Record<string, string>;
}

export interface ConfiguracionCondicionAcabadoSinNivel {
  acabado_id: string;
}

export interface ConfiguracionCondicionAcabadoConNivel {
  acabado_id: string;
  mapeo_niveles: Record<string, string>;
}

export interface ConfiguracionCondicionTecnologiaTinta {
  tecnologia_id: string;
  tinta: TintaType;
}

export type ConfiguracionCondicion =
  | ConfiguracionCondicionServicioSinNivel
  | ConfiguracionCondicionServicioConNivel
  | ConfiguracionCondicionAcabadoSinNivel
  | ConfiguracionCondicionAcabadoConNivel
  | ConfiguracionCondicionTecnologiaTinta
  | Record<string, never>;

export interface RutaProduccion {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pasos_count?: number;
}

export interface RutaProduccionPaso {
  id: string;
  ruta_id: string;
  etapa: EtapaPaso;
  paso_id: string | null;
  orden: number;
  es_obligatorio: boolean;
  tipo_condicion: TipoCondicionRuta | null;
  configuracion_condicion: ConfiguracionCondicion;
  created_at: string;
  updated_at: string;
  paso?: {
    id: string;
    nombre: string;
    estacion_id: string;
  } | null;
  servicio?: {
    id: string;
    nombre: string;
  } | null;
  acabado?: {
    id: string;
    nombre: string;
  } | null;
  tecnologia?: {
    id: string;
    nombre: string;
  } | null;
}

export interface RutaProduccionFormData {
  nombre: string;
  descripcion: string;
}

export interface RutaProduccionPasoFormData {
  etapa: EtapaPaso;
  paso_id: string | null;
  orden: number;
  es_obligatorio: boolean;
  tipo_condicion: TipoCondicionRuta | null;
  configuracion_condicion: ConfiguracionCondicion;
}

export interface MaterialVariante {
  nombre: string;
  espesores: number[];
}

export interface Material {
  id: string;
  company_id: string;
  nombre: string;
  aplica_espesor: boolean;
  unidad_espesor: UnidadEspesor | null;
  variantes: MaterialVariante[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paso {
  id: string;
  company_id: string;
  nombre: string;
  etapa: EtapaPaso;
  estacion_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: string;
  company_id: string | null;
  nombre: string;
  descripcion: string | null;
  color: string;
  is_system_category: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NivelPrecio {
  id: string;
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  valor_impacto_secundario: number | null;
  paso_id: string | null;
  orden: number;
}

export interface Servicio {
  id: string;
  company_id: string;
  nombre: string;
  estacion_id: string;
  disponible_independiente: boolean;
  tiene_niveles_precio: boolean;
  tipo_impacto: TipoImpactoPrecio | null;
  valor_impacto: number | null;
  valor_impacto_secundario: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServicioCategoria {
  id: string;
  servicio_id: string;
  categoria_id: string;
  created_at: string;
}

export interface ServicioNivelPrecio {
  id: string;
  servicio_id: string;
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  valor_impacto_secundario: number | null;
  paso_id: string | null;
  orden: number;
  created_at: string;
}

export interface ServicioPaso {
  id: string;
  servicio_id: string;
  paso_id: string;
  created_at: string;
}

export interface Acabado {
  id: string;
  company_id: string;
  nombre: string;
  estacion_id: string;
  disponible_independiente: boolean;
  tiene_niveles_precio: boolean;
  tipo_impacto: TipoImpactoPrecio | null;
  valor_impacto: number | null;
  valor_impacto_secundario: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcabadoCategoria {
  id: string;
  acabado_id: string;
  categoria_id: string;
  created_at: string;
}

export interface AcabadoNivelPrecio {
  id: string;
  acabado_id: string;
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  valor_impacto_secundario: number | null;
  paso_id: string | null;
  orden: number;
  created_at: string;
}

export interface AcabadoPaso {
  id: string;
  acabado_id: string;
  paso_id: string;
  created_at: string;
}

export interface Producto {
  id: string;
  company_id: string;
  categoria_id: string;
  nombre: string;
  medidas_ancho: number;
  medidas_alto: number;
  tipo_medida: TipoMedida;
  medidas_disponibles: MedidaDisponible[] | null;
  ancho_maximo?: number | null;
  caras_impresas: CaraImpresa[];
  producto_impreso: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductoTipo = 'laser' | 'gran_formato' | 'materiales_rigidos';

export interface ProductoImpresionLaser {
  id: string;
  company_id: string;
  nombre: string;
  medidas_disponibles: MedidaDisponible[];
  caras_impresas: CaraImpresa[];
  producto_impreso: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TipoVenta = 'mt2' | 'mt_lineal';

export interface ProductoGranFormato {
  id: string;
  company_id: string;
  nombre: string;
  tipo_venta: TipoVenta;
  anchos_disponibles: number[];
  impuesto_iva: number;
  rango_precio_id: string | null;
  ruta_produccion_id: string | null;
  cantidad_minima: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductoGranFormatoTecnologia {
  id: string;
  producto_gran_formato_id: string;
  tecnologia_id: string;
  tecnologia_nombre: string;
  tintas: string[];
}

export interface ProductoGranFormatoMaterial {
  id: string;
  producto_gran_formato_id: string;
  material_id: string;
  material_nombre: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
}

export interface ProductoGranFormatoServicio {
  id: string;
  producto_gran_formato_id: string;
  servicio_id: string;
  servicio_nombre: string;
  is_active: boolean;
}

export interface ProductoGranFormatoAcabado {
  id: string;
  producto_gran_formato_id: string;
  acabado_id: string;
  acabado_nombre: string;
  is_active: boolean;
}

export interface ProductoGranFormatoConRelaciones extends ProductoGranFormato {
  tecnologias: ProductoGranFormatoTecnologia[];
  materiales: ProductoGranFormatoMaterial[];
  servicios: ProductoGranFormatoServicio[];
  acabados: ProductoGranFormatoAcabado[];
  rango_precio?: {
    id: string;
    nombre: string;
    unidad_medida: string;
  } | null;
}

export interface TecnologiaTintasData {
  tecnologia_id: string;
  tintas: string[];
}

export interface CreateProductoGranFormatoData {
  nombre: string;
  tipo_venta: TipoVenta;
  anchos_disponibles: number[];
  impuesto_iva: number;
  rango_precio_id?: string;
  ruta_produccion_id?: string;
  cantidad_minima?: number;
  tecnologias_tintas: TecnologiaTintasData[];
  material_id: string;
  variante_nombre: string;
  espesor?: number;
  servicios: string[];
  acabados: string[];
}

export interface ProductoMaterialesRigidos {
  id: string;
  company_id: string;
  nombre: string;
  tipo_venta: TipoVenta;
  caras_impresas: CaraImpresa[];
  producto_impreso: boolean;
  cantidad_minima: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductoEspecifico = ProductoImpresionLaser | ProductoGranFormato | ProductoMaterialesRigidos;

export interface ProductoConTipo {
  producto_tipo: ProductoTipo;
  producto: ProductoEspecifico;
}

export interface ProductoTecnologia {
  id: string;
  producto_tipo: ProductoTipo;
  producto_id: string;
  tecnologia_id: string;
  tintas: string[];
  created_at: string;
}

export interface ProductoMaterialRel {
  id: string;
  producto_tipo: ProductoTipo;
  producto_id: string;
  material_id: string;
  variante_nombre: string;
  espesores: any[];
  created_at: string;
}

export interface ProductoServicio {
  id: string;
  producto_tipo: ProductoTipo;
  producto_id: string;
  servicio_id: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductoAcabado {
  id: string;
  producto_tipo: ProductoTipo;
  producto_id: string;
  acabado_id: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductoPrecio {
  id: string;
  company_id: string;
  producto_tipo: ProductoTipo;
  producto_id: string;
  tecnologia_id: string | null;
  tipo_tinta: string | null;
  cara_impresion: CaraImpresa | null;
  material_id: string | null;
  variante_nombre: string | null;
  cantidad: number;
  rango_min: number | null;
  rango_max: number | null;
  precio_venta: number;
  created_at: string;
  updated_at: string;
}

export interface RangoPrecio {
  id: string;
  company_id: string;
  nombre: string;
  rangos: Array<{ min: number; max: number; descuento: number }>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TipoEtapaRuta = 'pre_prensa' | 'principal' | 'post_prensa';

export type TipoCondicion =
  | 'condicional_servicio_nivel'
  | 'condicional_servicio_simple'
  | 'condicional_acabado_nivel'
  | 'condicional_acabado_simple'
  | 'condicional_tecnologia'
  | 'condicional_tintas'
  | 'condicional_tecnologia_tinta'
  | 'condicional_material_variante'
  | 'condicional_compuesto';

export interface CondicionConfig {
  tipo: TipoCondicion;
  servicio_id?: string;
  acabado_id?: string;
  tecnologia_id?: string;
  material_id?: string;
  nivel_id?: string;
  requiere_nivel?: boolean;
  paso_por_nivel?: Record<string, string>;
  paso_por_tinta?: Record<string, string>;
  tintas?: string[];
  variante_nombre?: string;
  condiciones?: CondicionConfig[];
  operador?: 'AND' | 'OR';
}

export interface ProductoRutaPlantilla {
  id: string;
  producto_id: string;
  tipo_etapa: TipoEtapaRuta;
  orden: number;
  es_condicional: boolean;
  condicion_tipo: TipoCondicion | null;
  condicion_config: CondicionConfig;
  paso_id: string | null;
  paso_plantilla: string | null;
  nombre_display: string | null;
  created_at: string;
  updated_at: string;
}

export type EstadoPedido = 'borrador' | 'confirmado' | 'en_produccion' | 'completado' | 'cancelado';

export type TipoOpcionPedido = 'servicio' | 'acabado' | 'tecnologia' | 'material';

export interface OpcionServicio {
  servicio_id: string;
  servicio_nombre?: string;
  tiene_nivel: boolean;
  nivel_id?: string;
  nivel_nombre?: string;
}

export interface OpcionAcabado {
  acabado_id: string;
  acabado_nombre?: string;
  tiene_nivel: boolean;
  nivel_id?: string;
  nivel_nombre?: string;
}

export interface OpcionTecnologia {
  tecnologia_id: string;
  tecnologia_nombre?: string;
  tintas: string[];
}

export interface OpcionMaterial {
  material_id: string;
  material_nombre?: string;
  variante_nombre: string;
  espesor?: number;
}

export interface OpcionesSeleccionadas {
  servicios?: OpcionServicio[];
  acabados?: OpcionAcabado[];
  tecnologia?: OpcionTecnologia;
  materiales?: OpcionMaterial[];
}

export interface Pedido {
  id: string;
  company_id: string;
  producto_id: string;
  cliente_id: string;
  numero_pedido: string;
  cantidad: number;
  estado: EstadoPedido;
  fecha_pedido: string;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  opciones_seleccionadas: OpcionesSeleccionadas;
  notas: string | null;
  precio_total: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoOpcion {
  id: string;
  pedido_id: string;
  tipo_opcion: TipoOpcionPedido;
  opcion_id: string;
  opcion_nombre: string;
  tiene_nivel: boolean;
  nivel_id: string | null;
  nivel_nombre: string | null;
  valores_adicionales: Record<string, any>;
  created_at: string;
}

export type EstadoPaso = 'pendiente' | 'en_proceso' | 'completado' | 'omitido';

export interface OrigenCondicion {
  tipo: string;
  plantilla_id?: string;
  condicion_config?: CondicionConfig;
}

export interface PedidoRutaResuelta {
  id: string;
  pedido_id: string;
  tipo_etapa: TipoEtapaRuta;
  paso_id: string | null;
  paso_nombre: string;
  orden: number;
  estado_paso: EstadoPaso;
  origen_condicion: OrigenCondicion;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type CanalVenta = 'Web' | 'WhatsApp' | 'Mostrador';

export type EstadoOrdenTrabajo = 'borrador' | 'pendiente' | 'en_proceso' | 'finalizada' | 'entregada' | 'cancelada';

export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta Credito' | 'Tarjeta Debito' | 'Cheque' | 'Otro';

export type TipoEventoHistorial =
  | 'creacion'
  | 'modificacion'
  | 'cambio_estado'
  | 'pago_registrado'
  | 'nota_agregada'
  | 'item_agregado'
  | 'item_modificado'
  | 'item_eliminado'
  | 'cotizacion_enviada'
  | 'orden_confirmada'
  | 'orden_cancelada';

export interface ItemConfiguracion {
  tecnologia_id?: string;
  tecnologia_nombre?: string;
  tipo_tinta?: string;
  cara_impresion?: string;
  material_id?: string;
  material_nombre?: string;
  variante_nombre?: string;
  espesor?: number;
  unidad_espesor?: string;
  medida_seleccionada?: {
    ancho: number;
    alto: number;
  };
  mt2_total?: number;
  mt_lineal_total?: number;
  observaciones_cliente?: string;
  servicios_seleccionados?: Array<{
    servicio_id: string;
    servicio_nombre: string;
    nivel_precio_id?: string;
    nivel_nombre?: string;
    precio_impacto: number;
  }>;
  acabados_seleccionados?: Array<{
    acabado_id: string;
    acabado_nombre: string;
    nivel_precio_id?: string;
    nivel_nombre?: string;
    precio_impacto: number;
  }>;
}

export interface MaterialVarianteInfo {
  variante_nombre: string;
  espesores: number[];
}

export interface WizardItemData {
  producto_id: string;
  producto_nombre: string;
  categoria_id?: string;
  tipo_medida: TipoMedida;
  unidad_pricing: 'por_unidad' | 'cantidades_fijas' | 'mt2' | 'mt_lineal';
  tiene_descuento: boolean;
  cantidades_fijas: number[];
  rango_precio_id?: string;
  producto_impreso: boolean;
  caras_impresas_disponibles: CaraImpresa[];
  tecnologias_disponibles: Array<{
    id: string;
    nombre: string;
    tintas: string[];
  }>;
  material_info?: {
    id: string;
    nombre: string;
    variante_nombre: string;
    espesores: number[];
    aplica_espesor: boolean;
    unidad_espesor?: string;
  };
  material_variantes?: MaterialVarianteInfo[];
  servicios_disponibles: Array<{
    id: string;
    nombre: string;
    tiene_niveles: boolean;
    niveles?: Array<{
      id: string;
      nombre: string;
      tipo_impacto: TipoImpactoPrecio;
      valor_impacto: number;
      valor_impacto_secundario: number | null;
    }>;
    tipo_impacto?: TipoImpactoPrecio;
    valor_impacto?: number;
    valor_impacto_secundario?: number | null;
  }>;
  acabados_disponibles: Array<{
    id: string;
    nombre: string;
    tiene_niveles: boolean;
    niveles?: Array<{
      id: string;
      nombre: string;
      tipo_impacto: TipoImpactoPrecio;
      valor_impacto: number;
      valor_impacto_secundario: number | null;
    }>;
    tipo_impacto?: TipoImpactoPrecio;
    valor_impacto?: number;
    valor_impacto_secundario?: number | null;
  }>;
  medidas_disponibles?: MedidaDisponible[];
  ancho_maximo?: number;
  medida_unica?: {
    ancho: number;
    alto: number;
  };
}

export interface OrdenTrabajo {
  id: string;
  company_id: string;
  cliente_id: string;
  numero_orden: string;
  vendedor_id: string;
  canal_venta: CanalVenta;
  estado: EstadoOrdenTrabajo;
  fecha_creacion: string;
  fecha_estimada_entrega: string | null;
  notas_internas: string | null;
  subtotal: number;
  total_descuentos: number;
  total: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdenTrabajoItem {
  id: string;
  orden_id: string;
  producto_id: string;
  cantidad: number;
  configuracion: ItemConfiguracion;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number;
  precio_total: number;
  created_at: string;
  updated_at: string;
}

export interface OrdenTrabajoServicioItem {
  id: string;
  orden_item_id: string;
  servicio_id: string;
  nivel_precio_id: string | null;
  precio_aplicado: number;
  created_at: string;
}

export interface OrdenTrabajoAcabadoItem {
  id: string;
  orden_item_id: string;
  acabado_id: string;
  nivel_precio_id: string | null;
  precio_aplicado: number;
  created_at: string;
}

export interface OrdenTrabajoPago {
  id: string;
  orden_id: string;
  fecha_pago: string;
  monto: number;
  metodo_pago: MetodoPago;
  referencia_pago: string | null;
  comprobante_url: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdenTrabajoHistorial {
  id: string;
  orden_id: string;
  usuario_id: string | null;
  tipo_evento: TipoEventoHistorial;
  descripcion: string;
  metadata: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface OrdenItemRuta {
  id: string;
  company_id: string;
  orden_item_id: string;
  tipo_etapa: TipoEtapaRuta;
  paso_id: string | null;
  paso_nombre: string;
  orden: number;
  es_modificado: boolean;
  origen_plantilla_id: string | null;
  comentario_vendedor: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: Omit<Company, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Company, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      subscription_plans: {
        Row: SubscriptionPlan;
        Insert: Omit<SubscriptionPlan, 'id' | 'created_at'>;
        Update: Partial<Omit<SubscriptionPlan, 'id' | 'created_at'>>;
      };
      company_subscriptions: {
        Row: CompanySubscription;
        Insert: Omit<CompanySubscription, 'id' | 'created_at'>;
        Update: Partial<Omit<CompanySubscription, 'id' | 'created_at'>>;
      };
      countries: {
        Row: Country;
        Insert: Omit<Country, 'id' | 'created_at'>;
        Update: Partial<Omit<Country, 'id' | 'created_at'>>;
      };
      provinces: {
        Row: Province;
        Insert: Omit<Province, 'id' | 'created_at'>;
        Update: Partial<Omit<Province, 'id' | 'created_at'>>;
      };
      cities: {
        Row: City;
        Insert: Omit<City, 'id' | 'created_at'>;
        Update: Partial<Omit<City, 'id' | 'created_at'>>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>;
        Update: Partial<Omit<Client, 'id' | 'created_at' | 'company_id' | 'created_by'>>;
      };
      providers: {
        Row: Provider;
        Insert: Omit<Provider, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>;
        Update: Partial<Omit<Provider, 'id' | 'created_at' | 'company_id' | 'created_by'>>;
      };
      banks: {
        Row: Bank;
        Insert: Omit<Bank, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Bank, 'id' | 'created_at'>>;
      };
      estaciones_trabajo: {
        Row: EstacionTrabajo;
        Insert: Omit<EstacionTrabajo, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<EstacionTrabajo, 'id' | 'created_at' | 'company_id'>>;
      };
      tecnologias: {
        Row: Tecnologia;
        Insert: Omit<Tecnologia, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Tecnologia, 'id' | 'created_at' | 'company_id'>>;
      };
      materiales: {
        Row: Material;
        Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Material, 'id' | 'created_at' | 'company_id'>>;
      };
      pasos: {
        Row: Paso;
        Insert: Omit<Paso, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Paso, 'id' | 'created_at' | 'company_id'>>;
      };
      grupos_pasos: {
        Row: GrupoPaso;
        Insert: Omit<GrupoPaso, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GrupoPaso, 'id' | 'created_at' | 'company_id'>>;
      };
      grupos_pasos_items: {
        Row: GrupoPasoItem;
        Insert: Omit<GrupoPasoItem, 'id' | 'created_at'>;
        Update: Partial<Omit<GrupoPasoItem, 'id' | 'created_at'>>;
      };
      categorias: {
        Row: Categoria;
        Insert: Omit<Categoria, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Categoria, 'id' | 'created_at' | 'company_id'>>;
      };
      servicios: {
        Row: Servicio;
        Insert: Omit<Servicio, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Servicio, 'id' | 'created_at' | 'company_id'>>;
      };
      servicios_niveles_precio: {
        Row: ServicioNivelPrecio;
        Insert: Omit<ServicioNivelPrecio, 'id' | 'created_at'>;
        Update: Partial<Omit<ServicioNivelPrecio, 'id' | 'created_at'>>;
      };
      servicios_pasos: {
        Row: ServicioPaso;
        Insert: Omit<ServicioPaso, 'id' | 'created_at'>;
        Update: Partial<Omit<ServicioPaso, 'id' | 'created_at'>>;
      };
      acabados: {
        Row: Acabado;
        Insert: Omit<Acabado, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Acabado, 'id' | 'created_at' | 'company_id'>>;
      };
      acabados_niveles_precio: {
        Row: AcabadoNivelPrecio;
        Insert: Omit<AcabadoNivelPrecio, 'id' | 'created_at'>;
        Update: Partial<Omit<AcabadoNivelPrecio, 'id' | 'created_at'>>;
      };
      acabados_pasos: {
        Row: AcabadoPaso;
        Insert: Omit<AcabadoPaso, 'id' | 'created_at'>;
        Update: Partial<Omit<AcabadoPaso, 'id' | 'created_at'>>;
      };
      custom_roles: {
        Row: CustomRole;
        Insert: Omit<CustomRole, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CustomRole, 'id' | 'created_at'>>;
      };
      role_permissions: {
        Row: RolePermission;
        Insert: Omit<RolePermission, 'id' | 'created_at'>;
        Update: Partial<Omit<RolePermission, 'id' | 'created_at'>>;
      };
      user_ip_restrictions: {
        Row: UserIPRestriction;
        Insert: Omit<UserIPRestriction, 'id' | 'created_at'>;
        Update: Partial<Omit<UserIPRestriction, 'id' | 'created_at'>>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: Partial<Omit<AuditLog, 'id' | 'created_at'>>;
      };
      user_sessions: {
        Row: UserSession;
        Insert: Omit<UserSession, 'id' | 'created_at'>;
        Update: Partial<Omit<UserSession, 'id' | 'created_at'>>;
      };
      login_attempts: {
        Row: LoginAttempt;
        Insert: Omit<LoginAttempt, 'id' | 'created_at'>;
        Update: Partial<Omit<LoginAttempt, 'id' | 'created_at'>>;
      };
      productos: {
        Row: Producto;
        Insert: Omit<Producto, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Producto, 'id' | 'created_at' | 'company_id'>>;
      };
      rangos_precio: {
        Row: RangoPrecio;
        Insert: Omit<RangoPrecio, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RangoPrecio, 'id' | 'created_at' | 'company_id'>>;
      };
      productos_rutas_plantillas: {
        Row: ProductoRutaPlantilla;
        Insert: Omit<ProductoRutaPlantilla, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProductoRutaPlantilla, 'id' | 'created_at' | 'producto_id'>>;
      };
      pedidos: {
        Row: Pedido;
        Insert: Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'numero_pedido'>;
        Update: Partial<Omit<Pedido, 'id' | 'created_at' | 'company_id' | 'numero_pedido'>>;
      };
      pedidos_opciones: {
        Row: PedidoOpcion;
        Insert: Omit<PedidoOpcion, 'id' | 'created_at'>;
        Update: Partial<Omit<PedidoOpcion, 'id' | 'created_at' | 'pedido_id'>>;
      };
      pedidos_rutas_resueltas: {
        Row: PedidoRutaResuelta;
        Insert: Omit<PedidoRutaResuelta, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PedidoRutaResuelta, 'id' | 'created_at' | 'pedido_id'>>;
      };
      tecnologias_tintas_pasos: {
        Row: TecnologiaTintaPaso;
        Insert: Omit<TecnologiaTintaPaso, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TecnologiaTintaPaso, 'id' | 'created_at' | 'tecnologia_id'>>;
      };
      rutas_produccion: {
        Row: RutaProduccion;
        Insert: Omit<RutaProduccion, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RutaProduccion, 'id' | 'created_at' | 'company_id'>>;
      };
      rutas_produccion_pasos: {
        Row: RutaProduccionPaso;
        Insert: Omit<RutaProduccionPaso, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RutaProduccionPaso, 'id' | 'created_at' | 'ruta_id'>>;
      };
    };
  };
}
