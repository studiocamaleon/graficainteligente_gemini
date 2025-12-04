export type WizardStepName =
  | 'product_search'
  | 'quantity'
  | 'size'
  | 'print_config'
  | 'services'
  | 'finishings'
  | 'summary';

export interface WizardStep {
  name: WizardStepName;
  title: string;
  description?: string;
  isValid: boolean;
  isCompleted: boolean;
}

export interface ImpresionLaserConfig {
  producto_id: string | null;
  producto_laser_id: string | null;
  producto_nombre: string | null;
  categoria_nombre: string | null;

  cantidad: number | null;
  tipo_venta: 'unidad' | 'cantidad_fija' | null;
  cantidades_fijas: number[];
  cantidad_minima: number | null;

  medida_ancho: number | null;
  medida_alto: number | null;
  medida_display: string | null;

  tinta: string | null;
  tinta_nombre: string | null;

  cara_impresa: 'solo_frente' | 'frente_y_dorso' | null;
  caras_disponibles: string[];

  servicios_seleccionados: ServicioSeleccionado[];
  acabados_seleccionados: AcabadoSeleccionado[];

  material_id: string | null;
  material_nombre: string | null;
  variante_id: string | null;
  variante_nombre: string | null;

  precio_base: number | null;
  precio_servicios: number;
  precio_acabados: number;
  precio_total: number | null;
  tiene_precio_configurado: boolean;
}

export interface ServicioSeleccionado {
  servicio_id: string;
  servicio_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: 'porcentaje' | 'monto_fijo' | 'ambos';
  valor_porcentaje: number | null;
  valor_monto: number | null;
  impacto_calculado: number;
}

export interface AcabadoSeleccionado {
  acabado_id: string;
  acabado_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: 'porcentaje' | 'monto_fijo' | 'ambos';
  valor_porcentaje: number | null;
  valor_monto: number | null;
  impacto_calculado: number;
}

// =====================================================
// SERVICIOS Y ACABADOS CON ALCANCE
// =====================================================

export interface ServicioConAlcance {
  id: string;
  servicio_id: string;
  servicio_nombre: string;
  alcance: 'por_item' | 'grupo';
  tiene_niveles: boolean;
  niveles?: Array<{
    id: string;
    nombre: string;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }>;
}

export interface AcabadoConAlcance {
  id: string;
  acabado_id: string;
  acabado_nombre: string;
  alcance: 'por_item' | 'grupo';
  tiene_niveles: boolean;
  niveles?: Array<{
    id: string;
    nombre: string;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }>;
}

// =====================================================
// SERVICIOS Y ACABADOS GLOBALES SELECCIONADOS
// =====================================================

export interface ServicioGlobalSeleccionado {
  servicio_id: string;
  servicio_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_monto: number | null;
  valor_monto_secundario: number | null;
}

export interface AcabadoGlobalSeleccionado {
  acabado_id: string;
  acabado_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_monto: number | null;
  valor_monto_secundario: number | null;
}

// =====================================================
// PRECIOS GLOBALES CALCULADOS
// =====================================================

export interface PreciosGlobalesLinea {
  precio_servicios_globales: number;
  precio_acabados_globales: number;
  servicios_detalle: Array<{
    servicio_nombre: string;
    precio_calculado_total: number;
    precio_asignado_linea: number;
  }>;
  acabados_detalle: Array<{
    acabado_nombre: string;
    precio_calculado_total: number;
    precio_asignado_linea: number;
  }>;
}

export interface WizardState {
  currentStep: number;
  steps: WizardStep[];
  config: ImpresionLaserConfig;
  isCalculatingPrice: boolean;
  hasChanges: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProductSearchResult {
  producto_id: string;
  producto_laser_id: string;
  nombre: string;
  descripcion: string | null;
  categoria_nombre: string;
  tipo_venta: 'unidad' | 'cantidad_fija';
  cantidades_fijas: number[];
  cantidad_minima: number | null;
  medidas_disponibles: MedidaDisponible[];
  material_id: string;
  material_nombre: string;
  variante_id: string;
  variante_nombre: string;
  tintas_disponibles: TintaDisponible[];
  caras_disponibles: string[];
  tiene_precios: boolean;
  precio_desde: number | null;
}

export interface MedidaDisponible {
  ancho: number;
  alto: number;
  display: string;
}

export interface TintaDisponible {
  tinta: string;
  nombre: string;
}

export interface PriceQueryParams {
  producto_laser_id: string;
  medida_ancho: number;
  medida_alto: number;
  tinta: string;
  cantidad: number;
  cara_impresa: 'solo_frente' | 'frente_dorso';
}

export interface PriceResult {
  precio_base: number;
  tiene_configuracion: boolean;
  desglose: {
    base: number;
    servicios: number;
    acabados: number;
    total: number;
  };
}
