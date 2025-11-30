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
  caja_id: string;
  tipo_egreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante: string | null;
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
  tipo_egreso?: {
    nombre: string;
    color: string;
    icono: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

export interface CreateEgresoData {
  caja_id: string;
  tipo_egreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante?: string;
  proveedor_nombre?: string;
  medio_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'debito' | 'otro';
  notas?: string;
}

export interface UpdateEgresoData {
  monto?: number;
  concepto?: string;
  fecha?: string;
  numero_comprobante?: string;
  proveedor_nombre?: string;
  medio_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'debito' | 'otro';
  notas?: string;
}
