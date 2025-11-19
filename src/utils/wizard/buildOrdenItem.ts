import type { ImpresionLaserConfig } from '../../types/wizard';

export interface OrdenTrabajoItemData {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  configuracion: any;
}

export function buildOrdenItemFromWizard(config: ImpresionLaserConfig): OrdenTrabajoItemData | null {
  if (!config.producto_id) {
    console.error('Falta producto_id');
    return null;
  }

  if (!config.cantidad || config.cantidad <= 0) {
    console.error('Cantidad inválida');
    return null;
  }

  const precioUnitario = config.precio_total || 0;
  const subtotal = precioUnitario * config.cantidad;

  const configuracion = {
    tecnologia_nombre: 'Impresión Laser',
    categoria_nombre: config.categoria_nombre,

    tipo_tinta: config.tipo_tinta,
    tinta_nombre: config.tinta_nombre,
    cara_impresion: config.cara_impresa,

    medida_seleccionada: {
      ancho: config.medida_ancho,
      alto: config.medida_alto,
      display: config.medida_display || `${config.medida_ancho} x ${config.medida_alto} cm`,
    },

    material_nombre: config.material_nombre,
    variante_nombre: config.variante_nombre,

    servicios_seleccionados: config.servicios_seleccionados.map(s => ({
      servicio_id: s.servicio_id,
      nombre: s.servicio_nombre,
      nivel: s.nivel_nombre,
      impacto: s.impacto_calculado,
    })),

    acabados_seleccionados: config.acabados_seleccionados.map(a => ({
      acabado_id: a.acabado_id,
      nombre: a.acabado_nombre,
      nivel: a.nivel_nombre,
      impacto: a.impacto_calculado,
    })),

    tiene_precio_configurado: config.tiene_precio_configurado,
    desglose_precio: {
      precio_base: config.precio_base,
      precio_servicios: config.precio_servicios,
      precio_acabados: config.precio_acabados,
      precio_total: config.precio_total,
    },
  };

  return {
    producto_id: config.producto_id,
    cantidad: config.cantidad,
    precio_unitario: precioUnitario,
    subtotal: subtotal,
    configuracion: configuracion,
  };
}
