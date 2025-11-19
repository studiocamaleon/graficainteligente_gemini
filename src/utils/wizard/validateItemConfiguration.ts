import type { ImpresionLaserConfig, ValidationResult } from '../../types/wizard';

export function validateItemConfiguration(config: ImpresionLaserConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.producto_id) {
    errors.push('Falta seleccionar el producto');
  }

  if (!config.producto_laser_id) {
    errors.push('El producto no tiene configuración de impresión laser');
  }

  if (!config.cantidad || config.cantidad <= 0) {
    errors.push('La cantidad debe ser mayor a 0');
  }

  if (config.cantidad_minima && config.cantidad && config.cantidad < config.cantidad_minima) {
    errors.push(`La cantidad debe ser al menos ${config.cantidad_minima}`);
  }

  if (!config.medida_ancho || !config.medida_alto) {
    errors.push('Falta seleccionar la medida');
  }

  if (!config.tinta_id) {
    errors.push('Falta seleccionar el tipo de tinta');
  }

  if (!config.cara_impresa) {
    errors.push('Falta seleccionar la configuración de caras a imprimir');
  }

  for (const servicio of config.servicios_seleccionados) {
    if (!servicio.servicio_id) {
      errors.push('Servicio con ID inválido');
    }
  }

  for (const acabado of config.acabados_seleccionados) {
    if (!acabado.acabado_id) {
      errors.push('Acabado con ID inválido');
    }
  }

  if (!config.tiene_precio_configurado) {
    warnings.push('Este producto no tiene precio configurado para esta combinación');
  }

  if (config.precio_total === null || config.precio_total === 0) {
    warnings.push('El precio total es $0. Verifique la configuración de precios');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
