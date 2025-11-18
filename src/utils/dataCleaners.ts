import type { TipoImpactoPrecio } from '../types/database';

export interface NivelPrecioInput {
  id?: string;
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  paso_id: string | null;
  orden: number;
  created_at?: string;
}

export interface NivelPrecioForInsert {
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  paso_id: string | null;
  orden: number;
}

export interface NivelPrecioForUpdate {
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  paso_id: string | null;
  orden: number;
}

export interface PasoRelacionadoInput {
  paso_id: string | null;
}

export interface PasoRelacionadoForInsert {
  paso_id: string;
}

export function cleanNivelPrecioForInsert(
  nivel: NivelPrecioInput,
  servicioId: string
): NivelPrecioForInsert & { servicio_id: string } {
  const cleaned = {
    servicio_id: servicioId,
    nombre: nivel.nombre.trim(),
    tipo_impacto: nivel.tipo_impacto,
    valor_impacto: nivel.valor_impacto,
    paso_id: nivel.paso_id || null,
    orden: nivel.orden,
  };

  validatePasoRelacionado(cleaned);
  return cleaned;
}

export function cleanNivelPrecioForUpdate(nivel: NivelPrecioInput): NivelPrecioForUpdate {
  const cleaned = {
    nombre: nivel.nombre.trim(),
    tipo_impacto: nivel.tipo_impacto,
    valor_impacto: nivel.valor_impacto,
    paso_id: nivel.paso_id || null,
    orden: nivel.orden,
  };

  validatePasoRelacionado(cleaned);
  return cleaned;
}

export function cleanAcabadoNivelPrecioForInsert(
  nivel: NivelPrecioInput,
  acabadoId: string
): NivelPrecioForInsert & { acabado_id: string } {
  const cleaned = {
    acabado_id: acabadoId,
    nombre: nivel.nombre.trim(),
    tipo_impacto: nivel.tipo_impacto,
    valor_impacto: nivel.valor_impacto,
    paso_id: nivel.paso_id || null,
    orden: nivel.orden,
  };

  validatePasoRelacionado(cleaned);
  return cleaned;
}

export function cleanPasoRelacionadoForInsert(
  data: PasoRelacionadoInput,
  parentId: string,
  parentType: 'servicio' | 'acabado'
): PasoRelacionadoForInsert & { servicio_id?: string; acabado_id?: string } {
  if (!data.paso_id) {
    throw new Error('Un nivel debe tener asociado un paso.');
  }

  const cleaned: any = {
    paso_id: data.paso_id,
  };

  if (parentType === 'servicio') {
    cleaned.servicio_id = parentId;
  } else {
    cleaned.acabado_id = parentId;
  }

  return cleaned;
}

export function validatePasoRelacionado(data: { paso_id: string | null }): void {
  const hasPaso = data.paso_id !== null && data.paso_id !== '';

  if (!hasPaso) {
    throw new Error('Un nivel debe tener asociado un paso.');
  }
}

export function isNewNivel(nivel: NivelPrecioInput): boolean {
  return !nivel.id || nivel.id === '';
}

export function partitionNiveles(niveles: NivelPrecioInput[]): {
  toInsert: NivelPrecioInput[];
  toUpdate: Array<NivelPrecioInput & { id: string }>;
} {
  const toInsert: NivelPrecioInput[] = [];
  const toUpdate: Array<NivelPrecioInput & { id: string }> = [];

  niveles.forEach((nivel) => {
    if (isNewNivel(nivel)) {
      toInsert.push(nivel);
    } else {
      toUpdate.push(nivel as NivelPrecioInput & { id: string });
    }
  });

  return { toInsert, toUpdate };
}
