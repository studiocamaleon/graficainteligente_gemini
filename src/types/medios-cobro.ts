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
  caja_id: string | null;
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
  caja_id?: string;
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

export type TipoCaja = 'efectivo' | 'banco' | 'pasarela';

export type TipoMovimientoCaja = 'ingreso' | 'egreso' | 'transferencia' | 'ajuste';

export type ReferenciaTipoCaja = 'pago_orden' | 'pago_copiado' | 'gasto' | 'transferencia' | 'ajuste';

export interface Caja {
  id: string;
  company_id: string;
  nombre: string;
  tipo: TipoCaja;
  identificador: string | null;
  saldo_actual: number;
  moneda: string;
  color: string | null;
  icono: string | null;
  es_principal: boolean;
  is_active: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface CajaMovimiento {
  id: string;
  caja_id: string;
  tipo_movimiento: TipoMovimientoCaja;
  monto: number;
  concepto: string;
  fecha: string;
  referencia_tipo: ReferenciaTipoCaja | null;
  referencia_id: string | null;
  medio_cobro_id: string | null;
  caja_destino_id: string | null;
  comision_aplicada: number;
  notas: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CajaConMediosCobro extends Caja {
  medios_cobro?: MedioCobro[];
  movimientos_hoy?: number;
  ingresos_hoy?: number;
  egresos_hoy?: number;
}

export interface ResumenCajaPorTipo {
  tipo: TipoCaja;
  total_saldo: number;
  cantidad_cajas: number;
  cajas: Caja[];
}

export interface SaldosPendientesCobro {
  total_pendiente: number;
  total_cc: number;
  total_sin_cc: number;
  cantidad_ordenes_cc: number;
  cantidad_ordenes_sin_cc: number;
}

export interface OrdenPorCobrar {
  orden_id: string;
  numero_orden: string;
  fecha_creacion: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_documento: string;
  tiene_cuenta_corriente: boolean;
  total: number;
  pagado: number;
  saldo_pendiente: number;
  dias_transcurridos: number;
  estado: string;
  tipo_orden: 'trabajo' | 'copiado';
}

export interface CajaFormData {
  nombre: string;
  tipo: TipoCaja;
  identificador?: string;
  moneda: string;
  color?: string;
  icono?: string;
  es_principal: boolean;
}

export interface MovimientoCajaConDetalles extends CajaMovimiento {
  caja?: Caja;
  medio_cobro?: MedioCobro;
  caja_destino?: Caja;
}
