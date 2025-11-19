import { useMemo } from 'react';
import type { ImpresionLaserConfig, ValidationResult, WizardStepName } from '../../types/wizard';

export function useWizardValidation(config: ImpresionLaserConfig, step: WizardStepName): ValidationResult {
  return useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 'product_search':
        if (!config.producto_id) {
          errors.push('Debe seleccionar un producto');
        }
        if (!config.producto_laser_id) {
          errors.push('El producto seleccionado no tiene configuración de impresión laser');
        }
        break;

      case 'quantity':
        if (!config.cantidad || config.cantidad <= 0) {
          errors.push('La cantidad debe ser mayor a 0');
        }
        if (config.cantidad_minima && config.cantidad && config.cantidad < config.cantidad_minima) {
          errors.push(`La cantidad mínima es ${config.cantidad_minima}`);
        }
        if (config.tipo_venta === 'cantidad_fija' && config.cantidad) {
          if (!config.cantidades_fijas.includes(config.cantidad)) {
            errors.push('Debe seleccionar una cantidad válida');
          }
        }
        break;

      case 'size':
        if (!config.medida_ancho || !config.medida_alto) {
          errors.push('Debe seleccionar una medida');
        }
        if (config.medida_ancho && config.medida_ancho <= 0) {
          errors.push('El ancho debe ser mayor a 0');
        }
        if (config.medida_alto && config.medida_alto <= 0) {
          errors.push('El alto debe ser mayor a 0');
        }
        break;

      case 'print_config':
        if (!config.tinta_id) {
          errors.push('Debe seleccionar un tipo de tinta');
        }
        if (!config.cara_impresa) {
          errors.push('Debe seleccionar la configuración de caras a imprimir');
        }
        if (config.cara_impresa && config.caras_disponibles.length > 0) {
          if (!config.caras_disponibles.includes(config.cara_impresa)) {
            errors.push('La configuración de caras seleccionada no está disponible');
          }
        }
        break;

      case 'services':
        for (const servicio of config.servicios_seleccionados) {
          if (!servicio.servicio_id) {
            errors.push('Servicio con ID inválido');
          }
          if (servicio.nivel_id === null && servicio.tipo_impacto !== 'porcentaje' && servicio.tipo_impacto !== 'monto_fijo') {
            warnings.push(`El servicio "${servicio.servicio_nombre}" requiere seleccionar un nivel`);
          }
        }
        break;

      case 'finishings':
        for (const acabado of config.acabados_seleccionados) {
          if (!acabado.acabado_id) {
            errors.push('Acabado con ID inválido');
          }
          if (acabado.nivel_id === null && acabado.tipo_impacto !== 'porcentaje' && acabado.tipo_impacto !== 'monto_fijo') {
            warnings.push(`El acabado "${acabado.acabado_nombre}" requiere seleccionar un nivel`);
          }
        }
        break;

      case 'summary':
        if (!config.producto_id) {
          errors.push('Falta información del producto');
        }
        if (!config.cantidad || config.cantidad <= 0) {
          errors.push('Cantidad inválida');
        }
        if (!config.medida_ancho || !config.medida_alto) {
          errors.push('Falta información de medida');
        }
        if (!config.tinta_id) {
          errors.push('Falta información de tinta');
        }
        if (!config.cara_impresa) {
          errors.push('Falta información de caras a imprimir');
        }
        if (!config.tiene_precio_configurado) {
          warnings.push('Este producto no tiene precio configurado para esta combinación');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [config, step]);
}
