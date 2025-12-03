import { useMemo } from 'react';
import type { TotalesPresupuesto, PresupuestoValidationState } from '../types/presupuestos';

/**
 * Hook para validar el estado de un presupuesto
 * Determina si está listo para enviar, convertir, etc.
 */
export function usePresupuestoValidation(
  totales: TotalesPresupuesto
): PresupuestoValidationState {
  const puedeEnviar = useMemo(() => {
    return !totales.tienePendientes && totales.totalItems > 0;
  }, [totales]);

  const mensajeValidacion = useMemo(() => {
    if (totales.totalItems === 0) {
      return 'Agrega al menos un item al presupuesto';
    }
    if (totales.tienePendientes) {
      return `Hay ${totales.itemsPendientes} item(s) pendiente(s) de cotizar`;
    }
    return null;
  }, [totales]);

  const porcentajeCompletitud = useMemo(() => {
    if (totales.totalItems === 0) return 0;
    return Math.round((totales.itemsCompletos / totales.totalItems) * 100);
  }, [totales]);

  const esCompleto = useMemo(() => {
    return !totales.tienePendientes && totales.totalItems > 0;
  }, [totales]);

  return {
    puedeEnviar,
    mensajeValidacion,
    porcentajeCompletitud,
    esCompleto,
  };
}
