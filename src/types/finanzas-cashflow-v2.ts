export type CashflowV2Basis = 'total' | 'cobrable';

export interface CashflowV2AssumptionsDelta {
  delta_wip_overdue_collectable: number;
  delta_wip_future_completion: number;
  delta_ingresos: number;
  delta_egresos: number;
  include_overdue: boolean;
}

export interface CashflowV2Point {
  fecha: string;
  ingreso_cheques: number;
  ingreso_liquidaciones: number;
  ingreso_wip_futuro: number;
  ingreso_wip_vencido: number;
  ingreso_otros_vencidos: number;
  egreso_cheques: number;
  egreso_tarjetas: number;
  egreso_recurrentes: number;
  egreso_compras: number;
  total_ingreso_vencido: number;
  total_egreso_vencido: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_diario: number;
  saldo_acumulado: number;
}

export interface CashflowV2Meta {
  basis: CashflowV2Basis;
  assumptions: CashflowV2AssumptionsDelta;
  days_to_project: number;
  version: 'v3';
}

export const DEFAULT_CASHFLOW_V2_ASSUMPTIONS: CashflowV2AssumptionsDelta = {
  delta_wip_overdue_collectable: 0,
  delta_wip_future_completion: 0,
  delta_ingresos: 0,
  delta_egresos: 0,
  include_overdue: true,
};
