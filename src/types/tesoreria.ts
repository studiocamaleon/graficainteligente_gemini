export interface TipoEgreso {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  color: string;
  icono: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Egreso {
  id: string;
  company_id: string;
  caja_id: string | null;
  tarjeta_id?: string | null;
  tipo_egreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  medio_pago: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'debito' | 'otro' | null;
  notas: string | null;
  movimiento_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  caja?: {
    nombre: string;
    moneda: string;
    tipo: string;
  };
  tarjeta?: {
    nombre: string;
    banco: string;
  };
  tipo_egreso?: {
    nombre: string;
    color: string;
    icono: string;
  };
  proveedor?: {
    nombre_fantasia: string;
    razon_social: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

export interface CreateEgresoData {
  caja_id: string | null;
  tarjeta_id?: string;
  tipo_egreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  proveedor_id?: string;
  numero_comprobante?: string;
  medio_pago?: Egreso['medio_pago'];
  notas?: string;
  cuotas?: number;
  // Cheque Fields
  numero_cheque?: string;
  fecha_pago?: string; // Fecha de cobro/vencimiento
  banco?: string;
  destinatario?: string;
  // Recurring Link
  recurrente_id?: string;
  periodo_devengado?: string;
}

export interface UpdateEgresoData {
  monto?: number;
  concepto?: string;
  fecha?: string;
  numero_comprobante?: string;
  proveedor_id?: string;
  medio_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'debito' | 'otro';
  notas?: string;
}

export interface TipoIngreso {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  color: string;
  icono: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ingreso {
  id: string;
  company_id: string;
  caja_id: string;
  tipo_ingreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante: string | null;
  origen: string | null;
  medio_cobro_id: string | null;
  notas: string | null;
  movimiento_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  caja?: {
    nombre: string;
    moneda: string;
    tipo: string;
  };
  tipo_ingreso?: {
    nombre: string;
    color: string;
    icono: string;
  };
  medio_cobro?: {
    nombre: string;
    categoria: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

export interface CreateIngresoData {
  caja_id: string;
  tipo_ingreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante?: string;
  origen?: string;
  medio_cobro_id?: string;
  notas?: string;
}

export interface UpdateIngresoData {
  monto?: number;
  concepto?: string;
  fecha?: string;
  numero_comprobante?: string;
  origen?: string;
  medio_cobro_id?: string;
  notas?: string;
}
