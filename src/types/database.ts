export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operador_diseno' | 'operador_taller' | 'viewer';

export type CompanyStatus = 'active' | 'suspended' | 'cancelled';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
import type { Egreso } from './tesoreria';
import type { Presupuesto, PresupuestoItem, CondicionComercial, PresupuestoHistorial } from './presupuestos';


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
  tipo_egreso_id: string | null;
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
  tipo_egreso_id?: string;
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
  dia_cierre_semanal: number | null;
  dia_cierre_mensual: number | null;
  usa_ultimo_dia_mes: boolean;
  dias_vencimiento: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  app_pin: string | null;
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
  whatsapp_notifications_enabled?: boolean;
  whatsapp_instance_id?: string | null;
  wati_enabled?: boolean;
  wati_api_endpoint?: string | null;
  wati_access_token?: string | null;
  wati_channel_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  name: string;
  logo_url: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  business_hours?: string;
  google_review_url?: string;
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

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BusinessHours {
  id: string;
  company_id: string;
  day_of_week: DayOfWeek;
  is_open: boolean;
  opening_time_1: string | null;
  closing_time_1: string | null;
  opening_time_2: string | null;
  closing_time_2: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessHoursFormData {
  day_of_week: DayOfWeek;
  is_open: boolean;
  opening_time_1: string;
  closing_time_1: string;
  opening_time_2: string;
  closing_time_2: string;
}

export interface DaySchedule {
  day_of_week: DayOfWeek;
  day_name: string;
  is_open: boolean;
  opening_time_1: string;
  closing_time_1: string;
  opening_time_2: string;
  closing_time_2: string;
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

export type EtapaPaso = 'Pre-prensa' | 'Produccion' | 'Terminacion' | 'Instalacion';

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
  | 'fijo_minuto'
  | 'por_mt2_manual'
  | 'fijo_mt2_manual';

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
  categoria_id: string | null;
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

export type ConfiguracionCondicionTecnologiaTinta = Record<string, never>;

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

export type ProductoTipo = 'laser' | 'gran_formato' | 'materiales_rigidos' | 'plotter_corte';

export type ColorPlotter = 'Blanco' | 'Negro' | 'Color' | 'Esmerilado Gris' | 'Esmerilado Blanco' | 'Otro';

export type MarcaPlotter = 'Avery' | 'Oracal' | 'Ritrama' | 'McCal' | 'Orajet' | 'Importado';

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

export type TipoVenta = 'mt2' | 'mt_lineal' | 'unidades';

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

export interface ProductoPlotterCorte {
  id: string;
  company_id: string;
  nombre: string;
  unidad_venta: 'mt_lineal';
  material_id: string;
  variante_nombre: string;
  espesor: number | null;
  anchos_disponibles: number[];
  cantidad_minima: number | null;
  color: ColorPlotter;
  marca: MarcaPlotter | null;
  impuesto_iva: number;
  rango_precio_id: string | null;
  ruta_produccion_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductoPlotterCorteMaterial {
  id: string;
  producto_plotter_corte_id: string;
  material_id: string;
  material_nombre: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
}

export interface ProductoPlotterCorteServicio {
  id: string;
  producto_plotter_corte_id: string;
  servicio_id: string;
  servicio_nombre: string;
  is_active: boolean;
}

export interface ProductoPlotterCorteAcabado {
  id: string;
  producto_plotter_corte_id: string;
  acabado_id: string;
  acabado_nombre: string;
  is_active: boolean;
}

export interface ProductoPlotterCorteConRelaciones extends ProductoPlotterCorte {
  servicios: ProductoPlotterCorteServicio[];
  acabados: ProductoPlotterCorteAcabado[];
  rango_precio?: {
    id: string;
    nombre: string;
    unidad_medida: string;
  } | null;
}

export interface CreateProductoPlotterCorteData {
  nombre: string;
  material_id: string;
  variante_nombre: string;
  espesor?: number;
  anchos_disponibles: number[];
  cantidad_minima?: number;
  color: ColorPlotter;
  marca?: MarcaPlotter;
  impuesto_iva: number;
  rango_precio_id?: string;
  ruta_produccion_id?: string;
  servicios: string[];
  acabados: string[];
}

export interface ProductoPlotterCortePrecio {
  id: string;
  producto_id: string;
  ancho: number;
  cantidad_desde: number;
  cantidad_hasta: number | null;
  precio: number;
  created_at: string;
  updated_at: string;
}

export type TipoProductoSello = 'sello' | 'repuesto' | 'polimero' | 'tinta' | 'accesorios';
export type TipoSello = 'manual' | 'automatico';
export type MarcaSello = 'Trodat' | 'ColoP' | 'Shiny';
export type TipoTinta = 'textil' | 'papel';

export interface ProductoSello {
  id: string;
  company_id: string;
  nombre: string;
  tipo_producto: TipoProductoSello;
  tipo_sello: TipoSello | null;
  marca: MarcaSello | null;
  medida_ancho: number | null;
  medida_alto: number | null;
  tipo_tinta: TipoTinta | null;
  impuesto_iva: number;
  ruta_produccion_id: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductoSelloConRelaciones extends ProductoSello {
  ruta_produccion?: {
    id: string;
    nombre: string;
  } | null;
}

export interface CreateProductoSelloData {
  nombre: string;
  tipo_producto: TipoProductoSello;
  tipo_sello?: TipoSello;
  marca?: MarcaSello;
  medida_ancho?: number;
  medida_alto?: number;
  tipo_tinta?: TipoTinta;
  impuesto_iva: number;
  ruta_produccion_id?: string;
}

export interface UpdateProductoSelloData extends Partial<CreateProductoSelloData> {
  is_active?: boolean;
}

export interface ProductoSelloPrecio {
  id: string;
  producto_id: string;
  precio_unitario: number;
  created_at: string;
  updated_at: string;
}

export interface ProductoPortabanner {
  id: string;
  company_id: string;
  nombre: string;
  ancho_cm: number;
  alto_cm: number;
  tecnologia_id: string;
  tintas: string[];
  impuesto_iva: number;
  rango_precio_id: string | null;
  ruta_produccion_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductoPortabannerServicio {
  id: string;
  producto_id: string;
  servicio_id: string;
  servicio_nombre: string;
}

export interface ProductoPortabannerAcabado {
  id: string;
  producto_id: string;
  acabado_id: string;
  acabado_nombre: string;
}

export interface ProductoPortabannerTecnologia {
  id: string;
  producto_id: string;
  tecnologia_id: string;
  tecnologia_nombre: string;
  created_at: string;
}

export interface ProductoPortabannerConRelaciones extends ProductoPortabanner {
  servicios: ProductoPortabannerServicio[];
  acabados: ProductoPortabannerAcabado[];
  tecnologias: ProductoPortabannerTecnologia[];
  rango_precio?: {
    id: string;
    nombre: string;
    unidad_medida: string;
  } | null;
  tecnologia?: {
    id: string;
    nombre: string;
  } | null;
}

export interface CreateProductoPortabannerData {
  nombre: string;
  ancho_cm: number;
  alto_cm: number;
  tecnologia_id: string;
  tecnologias_ids: string[];
  impuesto_iva: number;
  rango_precio_id?: string;
  ruta_produccion_id?: string;
  servicios: string[];
  acabados: string[];
}

export interface ProductoPortabannerPrecio {
  id: string;
  company_id: string;
  producto_id: string;
  ancho_cm: number;
  alto_cm: number;
  cantidad_desde: number;
  cantidad_hasta: number | null;
  precio: number;
  tecnologia_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductoEspecifico = ProductoImpresionLaser | ProductoGranFormato | ProductoMaterialesRigidos | ProductoPlotterCorte | ProductoSello | ProductoPortabanner;

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

export type TipoEtapaRuta = 'pre_prensa' | 'principal' | 'post_prensa' | 'instalacion';

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

export type EstadoPaso = 'pendiente' | 'en_proceso' | 'pausado' | 'completado' | 'omitido';

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

export type CanalVenta = 'Web' | 'WhatsApp' | 'Mostrador' | 'App Mobile';

export type EstadoOrdenTrabajo = 'pendiente' | 'en_proceso' | 'finalizada' | 'entregada' | 'cancelada';

export type EstadoOrdenItem = 'pendiente' | 'en_proceso' | 'finalizado';

export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Tarjeta Credito' | 'Tarjeta Debito' | 'Cheque' | 'Otro';

export type TipoEventoHistorial =
  | 'creacion'
  | 'modificacion'
  | 'cambio_estado'
  | 'pago_registrado'
  | 'pago_editado'
  | 'pago_eliminado'
  | 'nota_agregada'
  | 'item_agregado'
  | 'item_modificado'
  | 'item_eliminado'
  | 'cotizacion_enviada'
  | 'orden_confirmada'
  | 'orden_cancelada';

export interface ItemConfiguracion {
  categoria_id?: string | null;
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
  fecha_completado: string | null;
  notas_internas: string | null;
  subtotal: number;
  total_descuentos: number;
  total: number;
  tracking_token: string | null;
  // Campos de envío
  requiere_despacho: boolean;
  fecha_despacho: string | null;
  transporte: string | null;
  numero_guia: string | null;
  estado_envio: 'pendiente' | 'enviado' | 'entregado';
  // Campos de facturación
  requiere_factura: boolean;
  subtotal_iva: number;
  facturada: boolean;
  fecha_facturacion: string | null;
  numero_factura: string | null;
  factura_storage_path: string | null;
  // Campos de auditoría
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdenTrabajoItem {
  id: string;
  orden_id: string;
  producto_id: string;
  categoria_id?: string | null;
  producto_nombre: string | null;
  producto_categoria: string | null;
  cantidad: number;
  configuracion: ItemConfiguracion;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number;
  precio_total: number;
  estado: EstadoOrdenItem;
  tipo_item?: 'standard' | 'centro_copiado';
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
  estado_paso: EstadoPaso;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_id: string | null;
  responsable_nombre?: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
  global_task_id?: string | null;
  cantidad_pausas?: number;
  tiempo_pausado_total?: any; // Postgres interval or number
  tiempo_trabajo_efectivo?: any; // Postgres interval or number
}

export interface PresupuestoItemRuta {
  id: string;
  company_id: string;
  presupuesto_item_id: string;
  tipo_etapa: string;
  paso_id: string | null;
  paso_nombre: string;
  orden: number;
  es_modificado: boolean;
  origen_plantilla_id: string | null;
  comentario_vendedor: string | null;
  source_service_id: string | null;
  global_task_id: string | null;
  created_at: string;
}

// ============================================================================
// CENTRO DE COPIADO - Types
// ============================================================================

export type TipoTintaCopiado = 'CMYK' | 'K';
export type CaraImpresaCopiado = 'frente' | 'frente_y_dorso';
export type TipoAnillado = 'ring_wire' | 'plastico';
export type TipoPlastificado = 'A4' | 'SRA3' | 'Carnet';
export type TipoItemCopiado = 'impresion' | 'anillado' | 'plastificado' | 'guillotinado';
export type EstadoOrdenCopiado = 'pendiente' | 'en_proceso' | 'finalizada' | 'entregada' | 'cancelada';

export interface CentroCopiadoTamanioPapel {
  id: string;
  company_id: string;
  nombre: string;
  ancho_mm: number;
  alto_mm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoPapel {
  id: string;
  company_id: string;
  material_id: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoRangoAnillado {
  id: string;
  company_id: string;
  hojas_desde: number;
  hojas_hasta: number | null;
  precio_ring_wire: number;
  precio_plastico: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoPlastificado {
  id: string;
  company_id: string;
  tipo: TipoPlastificado;
  precio: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoRangoGuillotinado {
  id: string;
  company_id: string;
  hojas_desde: number;
  hojas_hasta: number | null;
  precio: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoRangoPrecioImpresion {
  id: string;
  company_id: string;
  nombre: string;
  hojas_desde: number;
  hojas_hasta: number | null;
  orden: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoPrecioImpresion {
  id: string;
  company_id: string;
  tamanio_papel_id: string;
  papel_id: string;
  tipo_tinta: TipoTintaCopiado;
  rango_precio_id: string;
  cara_impresa: CaraImpresaCopiado;
  precio: number;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoPloteoCADPrecio {
  id: string;
  company_id: string;
  tipo_papel: string;
  ancho_cm: 60 | 90;
  precio_metro_lineal: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoOrden {
  id: string;
  company_id: string;
  numero_orden: string;
  orden_trabajo_id: string | null;
  cliente_id: string | null;
  estado: EstadoOrdenCopiado;
  fecha_solicitud: string;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  total: number;
  observaciones: string | null;
  requiere_factura: boolean;
  numero_factura: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  canal_venta: CanalVenta;
  subtotal: number;
  total_descuentos: number;
}

export interface CentroCopiadoOrdenItem {
  id: string;
  orden_copiado_id: string;
  tipo_item: TipoItemCopiado;
  tamanio_papel_id: string | null;
  papel_id: string | null;
  tipo_tinta: TipoTintaCopiado | null;
  cara_impresa: CaraImpresaCopiado | null;
  cantidad_hojas: number | null;
  tipo_anillado: TipoAnillado | null;
  tipo_plastificado: TipoPlastificado | null;
  con_guillotinado: boolean;
  cantidad_unidades: number;
  precio_unitario: number;
  subtotal: number;
  es_ploteo_cad?: boolean;
  ploteo_cad_tipo_papel?: string | null;
  ploteo_cad_ancho_rollo?: number | null;
  ploteo_cad_metros_lineales?: number | null;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoOrdenArchivo {
  id: string;
  orden_copiado_id: string;
  company_id: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  paginas_detectadas: number | null;
  item_generado_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface CentroCopiadoOrdenPago {
  id: string;
  orden_copiado_id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago: string | null;
  comision_aplicada: number;
  fecha_liberacion_estimada: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types for consolidated orders
export interface CentroCopiadoOrdenResumida {
  id: string;
  numero_orden: string;
  estado: EstadoOrdenCopiado;
  total: number;
  items: CentroCopiadoOrdenItem[];
  orden_trabajo_numero?: string;
  requiere_factura?: boolean;
}

export interface TotalesConsolidadosOrden {
  subtotalItems: number;
  subtotalOrdenesCopiado: number;
  subtotalTotal: number;
  descuentos: number;
  subtotalConDescuentos: number;
  iva: number;
  totalFinal: number;
}

// Form Data Types
export interface CentroCopiadoTamanioPapelFormData {
  nombre: string;
  ancho_mm: number;
  alto_mm: number;
}

export interface CentroCopiadoPapelFormData {
  material_id: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
}

export interface CentroCopiadoRangoAnilladoFormData {
  hojas_desde: number;
  hojas_hasta: number | null;
  precio_ring_wire: number;
  precio_plastico: number;
}

export interface CentroCopiadoPlastificadoFormData {
  tipo: TipoPlastificado;
  precio: number;
}

export interface CentroCopiadoRangoGuillotinadoFormData {
  hojas_desde: number;
  hojas_hasta: number | null;
  precio: number;
}

export interface CentroCopiadoRangoPrecioImpresionFormData {
  nombre: string;
  hojas_desde: number;
  hojas_hasta: number | null;
  orden: number;
}

export interface CentroCopiadoPrecioImpresionFormData {
  tamanio_papel_id: string;
  papel_id: string;
  tipo_tinta: TipoTintaCopiado;
  rango_precio_id: string;
  cara_impresa: CaraImpresaCopiado;
  precio: number;
}

export interface Database {
  public: {
    Tables: {
      presupuestos: {
        Row: Presupuesto;
        Insert: Omit<Presupuesto, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Presupuesto, 'id' | 'created_at'>>;
      };
      presupuestos_items: {
        Row: PresupuestoItem;
        Insert: Omit<PresupuestoItem, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PresupuestoItem, 'id' | 'created_at'>>;
      };
      presupuestos_items_rutas: {
        Row: PresupuestoItemRuta;
        Insert: Omit<PresupuestoItemRuta, 'id' | 'created_at'>;
        Update: Partial<Omit<PresupuestoItemRuta, 'id' | 'created_at'>>;
      };
      presupuestos_historial: {
        Row: PresupuestoHistorial;
        Insert: Omit<PresupuestoHistorial, 'id' | 'created_at'>;
        Update: Partial<Omit<PresupuestoHistorial, 'id' | 'created_at'>>;
      };
      presupuestos_condiciones_comerciales: {
        Row: CondicionComercial;
        Insert: Omit<CondicionComercial, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CondicionComercial, 'id' | 'created_at'>>;
      };
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
      visitas: {
        Row: Visita;
        Insert: Omit<Visita, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Visita, 'id' | 'created_at' | 'updated_at'>>;
      };
      visitas_config: {
        Row: VisitasConfig;
        Insert: Omit<VisitasConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VisitasConfig, 'id' | 'created_at' | 'updated_at'>>;
      };
      providers: {
        Row: Provider;
        Insert: Omit<Provider, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>;
        Update: Partial<Omit<Provider, 'id' | 'created_at' | 'company_id' | 'created_by'>>;
      };
      egresos: {
        Row: Egreso;
        Insert: Omit<Egreso, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Egreso, 'id' | 'created_at'>>;
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
      recurring_expenses: {
        Row: RecurringExpense;
        Insert: Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<RecurringExpense, 'id' | 'created_at' | 'company_id'>>;
      };
      cheques_cartera: {
        Row: Cheque;
        Insert: Omit<Cheque, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Cheque, 'id' | 'created_at' | 'company_id'>>;
      };
      servicios_categorias: {
        Row: ServicioCategoria;
        Insert: Omit<ServicioCategoria, 'id' | 'created_at'>;
        Update: Partial<Omit<ServicioCategoria, 'id' | 'created_at'>>;
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
      acabados_categorias: {
        Row: AcabadoCategoria;
        Insert: Omit<AcabadoCategoria, 'id' | 'created_at'>;
        Update: Partial<Omit<AcabadoCategoria, 'id' | 'created_at'>>;
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
      ordenes_trabajo_items_rutas: {
        Row: OrdenItemRuta;
        Insert: Omit<OrdenItemRuta, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrdenItemRuta, 'id' | 'created_at' | 'updated_at'>>;
      };
      centro_copiado_tamanios_papel: {
        Row: CentroCopiadoTamanioPapel;
        Insert: Omit<CentroCopiadoTamanioPapel, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoTamanioPapel, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_papeles: {
        Row: CentroCopiadoPapel;
        Insert: Omit<CentroCopiadoPapel, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoPapel, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_rangos_anillado: {
        Row: CentroCopiadoRangoAnillado;
        Insert: Omit<CentroCopiadoRangoAnillado, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoRangoAnillado, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_plastificados: {
        Row: CentroCopiadoPlastificado;
        Insert: Omit<CentroCopiadoPlastificado, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoPlastificado, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_rangos_guillotinado: {
        Row: CentroCopiadoRangoGuillotinado;
        Insert: Omit<CentroCopiadoRangoGuillotinado, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoRangoGuillotinado, 'id' | 'created_at' | 'company_id'>>;
      };

      centro_copiado_rangos_precio_impresion: {
        Row: CentroCopiadoRangoPrecioImpresion;
        Insert: Omit<CentroCopiadoRangoPrecioImpresion, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoRangoPrecioImpresion, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_precios_impresion: {
        Row: CentroCopiadoPrecioImpresion;
        Insert: Omit<CentroCopiadoPrecioImpresion, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoPrecioImpresion, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_ploteo_cad_precios: {
        Row: CentroCopiadoPloteoCADPrecio;
        Insert: Omit<CentroCopiadoPloteoCADPrecio, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoPloteoCADPrecio, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_ordenes: {
        Row: CentroCopiadoOrden;
        Insert: Omit<CentroCopiadoOrden, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoOrden, 'id' | 'created_at' | 'company_id'>>;
      };
      centro_copiado_ordenes_items: {
        Row: CentroCopiadoOrdenItem;
        Insert: Omit<CentroCopiadoOrdenItem, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoOrdenItem, 'id' | 'created_at'>>;
      };
      centro_copiado_ordenes_pagos: {
        Row: CentroCopiadoOrdenPago;
        Insert: Omit<CentroCopiadoOrdenPago, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CentroCopiadoOrdenPago, 'id' | 'created_at'>>;
      };
      ordenes_trabajo_pagos: {
        Row: OrdenTrabajoPago;
        Insert: Omit<OrdenTrabajoPago, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrdenTrabajoPago, 'id' | 'created_at'>>;
      };
      tarjetas_credito: {
        Row: TarjetaCredito;
        Insert: Omit<TarjetaCredito, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TarjetaCredito, 'id' | 'created_at'>>;
      };
      tarjetas_resumenes: {
        Row: TarjetaResumen;
        Insert: Omit<TarjetaResumen, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TarjetaResumen, 'id' | 'created_at'>>;
      };
      tarjetas_consumos: {
        Row: TarjetaConsumo;
        Insert: Omit<TarjetaConsumo, 'id' | 'created_at'>;
        Update: Partial<Omit<TarjetaConsumo, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      fn_get_clientes_con_saldo: {
        Args: {
          p_company_id: string;
          p_search_term?: string;
          p_estado_filter?: string | null;
        };
        Returns: {
          id: string;
          nombre_fantasia: string;
          razon_social: string;
          numero_documento: string;
          acuerdo_pago: string;
          dia_cierre_semanal: number;
          dia_cierre_mensual: number;
          usa_ultimo_dia_mes: boolean;
          dias_vencimiento_config: number;
          tiene_cuenta_corriente: boolean;
          saldo_actual: number;
          estado_cc: string;
          dias_vencimiento: number | null;
          fecha_ultima_liquidacion: string | null;
        }[];
      };
      fn_get_cashflow_projection: {
        Args: {
          p_company_id: string;
          p_days_to_project?: number;
        };
        Returns: {
          fecha: string;
          ingresos: number;
          egresos: number;
          saldo_diario: number;
          saldo_acumulado: number;
        }[];
      };
      fn_calcular_saldo_cuenta_corriente: {
        Args: {
          p_cliente_id: string;
          p_fecha_hasta: string;
        };
        Returns: number;
      };
      get_visitas_config_public: {
        Args: {
          p_company_id: string;
        };
        Returns: any; // JSON
      };
      get_busy_slots_public: {
        Args: {
          p_company_id: string;
          p_start: string;
          p_end: string;
        };
        Returns: {
          fecha_inicio: string;
          fecha_fin: string;
        }[];
      };
      create_public_visit: {
        Args: {
          p_company_id: string;
          p_cliente_nombre: string;
          p_cliente_whatsapp: string;
          p_domicilio: string;
          p_fecha_inicio: string;
          p_fecha_fin: string;
          p_titulo: string;
          p_notas: string;
        };
        Returns: {
          id: string;
          status: string;
        };
      };
    };
  };
}

// =====================================================
// TIPOS PARA ACTIVIDAD Y RENDIMIENTO DE USUARIOS
// =====================================================

export interface ActividadUsuario {
  ruta_id: string;
  orden_item_id: string;
  estado_paso: 'completado' | 'omitido';
  fecha_inicio: string;
  fecha_fin: string;
  responsable_id: string;
  notas: string | null;
  paso_nombre: string;
  tipo_etapa: TipoEtapaRuta;
  orden_paso: number;
  duracion_minutos: number | null;
  responsable_nombre: string;
  responsable_email: string;
  responsable_role: UserRole;
  responsable_avatar: string | null;
  producto_nombre: string;
  producto_categoria: string | null;
  producto_cantidad: number;
  item_estado: EstadoOrdenItem;
  orden_id: string;
  numero_orden: string;
  orden_fecha_creacion: string;
  company_id: string;
  cliente_nombre: string | null;
  estacion_id: string | null;
  estacion_nombre: string | null;
}

export interface MetricasRendimientoOperador {
  responsable_id: string;
  responsable_nombre: string;
  responsable_email: string;
  responsable_avatar: string | null;
  total_pasos_completados: number;
  total_pasos_omitidos: number;
  total_pasos: number;
  tasa_completitud: number;
  tiempo_total_minutos: number;
  tiempo_total_horas: number;
  tiempo_promedio_minutos: number;
  pasos_prensa: number;
  pasos_post_prensa: number;
  pasos_terminacion: number;
}

export interface ResumenActividadEquipo {
  total_pasos_ejecutados: number | null;
  total_operadores_activos: number | null;
  promedio_pasos_por_operador: number | null;
  tiempo_promedio_por_paso: number | null;
  tasa_completitud_equipo: number | null;
  total_horas_trabajadas: number | null;
}

export interface FiltrosActividad {
  fecha_desde: Date | null;
  fecha_hasta: Date | null;
  responsables: string[];
  estaciones: string[];
  estados: ('completado' | 'omitido')[];
  tipo_etapa: TipoEtapaRuta | null;
}

// =====================================================
// TIPOS PARA CUENTAS CORRIENTES Y LIQUIDACIONES
// =====================================================

export type TipoMovimientoCC = 'cargo' | 'pago' | 'ajuste' | 'nota_credito' | 'nota_debito';
export type EstadoLiquidacion = 'pendiente' | 'pagada_parcial' | 'pagada_total' | 'vencida' | 'cancelada';

export interface CuentaCorrienteMovimiento {
  id: string;
  company_id: string;
  cliente_id: string;
  tipo_movimiento: TipoMovimientoCC;
  fecha: string;
  orden_id: string | null;
  pago_id: string | null;
  liquidacion_id: string | null;
  descripcion: string;
  monto_debe: number;
  monto_haber: number;
  saldo_acumulado: number;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Liquidacion {
  id: string;
  company_id: string;
  cliente_id: string;
  numero_liquidacion: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  estado: EstadoLiquidacion;
  subtotal_ordenes: number;
  total_ajustes: number;
  total_general: number;
  total_pagado: number;
  saldo_pendiente: number;
  notas: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiquidacionItem {
  id: string;
  liquidacion_id: string;
  orden_id: string;
  descripcion: string;
  fecha_orden: string;
  numero_orden: string;
  monto: number;
  created_at: string;
}

export interface LiquidacionPago {
  id: string;
  liquidacion_id: string;
  pago_id: string;
  monto_aplicado: number;
  created_at: string;
}

export interface LiquidacionConDetalles extends Liquidacion {
  cliente_nombre: string;
  cliente_documento: string;
  items: LiquidacionItem[];
  pagos: Array<{
    id: string;
    fecha_pago: string;
    monto: number;
    medio_cobro_nombre: string | null;
  }>;
}

export interface EstadoCuentaMovimiento {
  id: string;
  fecha: string;
  tipo_movimiento: TipoMovimientoCC;
  descripcion: string;
  orden_id: string | null;
  numero_orden: string | null;
  monto_debe: number;
  monto_haber: number;
  saldo_acumulado: number;
}

export interface ClienteConSaldo {
  id: string;
  nombre_fantasia: string;
  razon_social: string;
  numero_documento: string;
  acuerdo_pago: string | null;
  dia_cierre_semanal: number | null;
  dia_cierre_mensual: number | null;
  usa_ultimo_dia_mes: boolean;
  dias_vencimiento_config: number;
  saldo_actual: number;
  dias_vencimiento: number | null;
  estado_cc: 'al_dia' | 'proximo_vencer' | 'vencido';
  tiene_cuenta_corriente: boolean;
}

export interface PeriodoLiquidacion {
  tipo_acuerdo: PaymentTerm;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_vencimiento: string;
  descripcion_periodo: string;
  dias_vencimiento: number;
}

export interface OrdenParaLiquidar {
  orden_id: string;
  numero_orden: string;
  fecha_completado: string;
  total: number;
  descripcion: string;
}

// =====================================================
// TIPOS PARA TASA DE CUMPLIMIENTO
// =====================================================

export interface TasaCumplimiento {
  total_ordenes_evaluadas: number;
  ordenes_a_tiempo: number;
  ordenes_retrasadas: number;
  tasa_cumplimiento: number;
  promedio_dias_adelanto: number;
  promedio_dias_retraso: number;
  ordenes_sin_fecha_estimada: number;
}

export interface EvolutivoTasaCumplimiento {
  periodo: string;
  periodo_label: string;
  total_ordenes: number;
  ordenes_a_tiempo: number;
  ordenes_retrasadas: number;
  tasa_cumplimiento: number;
  tendencia: 'up' | 'down' | 'neutral';
}
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringExpense {
  id: string;
  company_id: string;
  description: string;
  amount: number;
  currency: string;
  provider_id: string | null;
  tipo_egreso_id: string;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpenseFormData {
  description: string;
  amount: number;
  provider_id: string | null;
  tipo_egreso_id: string;
  frequency: RecurringFrequency;
  day_of_month?: number;
  day_of_week?: number;
  start_date: string;
  end_date?: string | null;
}

export type ChequeType = 'fisico' | 'echeq';
export type ChequeStatus = 'pendiente' | 'pagado' | 'anulado' | 'vencido';
export type ChequeDirection = 'emitido' | 'recibido';

export interface Cheque {
  id: string;
  company_id: string;
  tipo: ChequeType;
  direction: ChequeDirection;
  numero_cheque: string;
  banco: string;
  fecha_emision: string;
  fecha_pago: string;
  monto: number;
  destinatario: string | null;
  proveedor_id: string | null;
  client_id: string | null;
  orden_id: string | null;
  estado: ChequeStatus;
  descripcion: string | null;
  comprobante_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  provider?: {
    id: string;
    nombre_fantasia: string;
    razon_social: string;
  };
  client?: {
    id: string;
    nombre_fantasia: string;
    razon_social: string;
  };
}

export interface TarjetaCredito {
  id: string;
  company_id: string;
  nombre: string;
  banco: string;
  ultimos_4_digitos: string | null;
  dia_cierre: number;
  dia_vencimiento: number;
  color: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TarjetaResumen {
  id: string;
  tarjeta_id: string;
  company_id: string;
  periodo: string; // "MM/YYYY"
  fecha_cierre: string;
  fecha_vencimiento: string;
  estado: 'abierto' | 'cerrado' | 'pagado';
  total_consumos: number;
  total_pagado: number;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface TarjetaConsumo {
  id: string;
  resumen_id: string;
  tarjeta_id: string;
  company_id: string;
  fecha_compra: string;
  descripcion: string;
  monto_original: number;
  monto_cuota: number;
  cuotas_total: number;
  nro_cuota: number;
  comprobante_url: string | null;
  categoria_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VisitasConfig {
  id: string;
  company_id: string;
  dias_habilitados: number[]; // 0=Sun, 1=Mon, etc.
  hora_inicio?: string; // Legacy
  hora_fin?: string; // Legacy
  horarios_disponibles?: { inicio: string; fin: string }[] | null; // Allow null for Json compatibility
  duracion_slot: number; // minutes
  deshabilitar_visitas_hoy?: boolean;
  bloqueos?: {
    id: string;
    fecha: string; // YYYY-MM-DD
    todo_el_dia: boolean;
    hora_inicio?: string;
    hora_fin?: string;
    motivo?: string;
  }[] | null;
  created_at: string;
  updated_at: string;
}

export interface Visita {
  id: string;
  company_id: string;
  titulo: string;
  descripcion: string | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  cliente_whatsapp: string | null;
  domicilio?: string | null;
  fecha_inicio: string; // ISO timestamp
  fecha_fin: string; // ISO timestamp
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  creado_por: string | null;
  cliente_id: string | null;
  orden_id: string | null;
  staff_id?: string | null;
  // Notifications
  notif_cliente_creacion_env?: boolean;
  notif_staff_creacion_env?: boolean;
  notif_cliente_1h_env?: boolean;
  notif_staff_30m_env?: boolean;
  created_at: string;
  updated_at: string;
}
