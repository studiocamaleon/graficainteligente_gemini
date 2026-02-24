import { formatDateDisplay } from '../../utils/dates';

export function formatMovimientoFecha(date: string): string {
  return formatDateDisplay(date);
}

export function formatMovimientoMonto(value: number): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
