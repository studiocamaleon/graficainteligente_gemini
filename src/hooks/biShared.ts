import { supabase } from '../lib/supabase';
import type { BIMeta, BIPreset } from '../types/business-intelligence';

export interface BIQueryParams {
  preset: BIPreset;
  fechaInicio?: string;
  fechaFin?: string;
}

export async function resolveBIMeta(params: BIQueryParams): Promise<BIMeta> {
  const { data, error } = await supabase.rpc('fn_calcular_rango_fechas', {
    p_preset: params.preset,
    p_fecha_inicio: params.fechaInicio || null,
    p_fecha_fin: params.fechaFin || null,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row?.fecha_inicio || !row?.fecha_fin) {
    throw new Error('No se pudo resolver el rango de fechas para BI v2.');
  }

  return {
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    timezone: 'America/Argentina/Buenos_Aires',
    criterio_fecha: 'creacion_ot_oc',
    version_calculo: 'bi_v2',
  };
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
