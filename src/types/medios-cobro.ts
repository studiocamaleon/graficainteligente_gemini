export type TipoMedioCobro = 'pasarela' | 'bancario' | 'efectivo';

export interface MedioCobro {
  id: string;
  company_id: string;
  nombre: string;
  tipo: TipoMedioCobro;
  categoria: string | null;
  forma_cobro: string | null;
  comision_porcentaje: number;
  dias_liberacion: number;
  is_active: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface MedioCobroFormData {
  nombre: string;
  tipo: TipoMedioCobro;
  categoria?: string;
  forma_cobro?: string;
  comision_porcentaje: number;
  dias_liberacion: number;
  is_active: boolean;
}

export interface MedioCobroFilters {
  tipo?: TipoMedioCobro;
  is_active?: boolean;
  search?: string;
}

export interface PagoConMedioCobro {
  id: string;
  orden_id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string | null;
  metodo_pago: string | null;
  comision_aplicada: number;
  fecha_liberacion_estimada: string | null;
  referencia_pago: string | null;
  comprobante_url: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  medio_cobro?: MedioCobro;
}
