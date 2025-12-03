/**
 * Utilidades para formatear configuraciones de productos en presupuestos
 * Convierte objetos de configuración técnica en texto legible para clientes
 */

interface ConfiguracionBase {
  [key: string]: any;
}

/**
 * Formatea la configuración de productos de Impresión Láser
 */
function formatImpresionLaser(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medidas) {
    if (config.medidas.tipo === 'fijas' && config.medidas.ancho && config.medidas.alto) {
      partes.push(`${config.medidas.ancho} x ${config.medidas.alto} cm`);
    } else if (config.medidas.tipo === 'personalizadas' && config.medidas.valor) {
      partes.push(`Medida: ${config.medidas.valor}`);
    }
  }

  // Material
  if (config.material) {
    partes.push(`Material: ${config.material}`);
  }

  // Gramaje
  if (config.gramaje) {
    partes.push(`${config.gramaje}g`);
  }

  // Colores/Tintas
  if (config.tintas) {
    if (Array.isArray(config.tintas)) {
      partes.push(`Tintas: ${config.tintas.join(', ')}`);
    } else if (typeof config.tintas === 'string') {
      partes.push(`Tintas: ${config.tintas}`);
    }
  }

  // Caras impresas
  if (config.caras_impresas) {
    const caras = Array.isArray(config.caras_impresas)
      ? config.caras_impresas.join(', ')
      : config.caras_impresas;
    partes.push(`Impresión: ${caras}`);
  }

  // Acabados
  if (config.acabados && Array.isArray(config.acabados) && config.acabados.length > 0) {
    partes.push(`Acabados: ${config.acabados.join(', ')}`);
  }

  // Servicios
  if (config.servicios && Array.isArray(config.servicios) && config.servicios.length > 0) {
    partes.push(`Servicios: ${config.servicios.join(', ')}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos de Gran Formato
 */
function formatGranFormato(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.ancho && config.alto) {
    partes.push(`${config.ancho} x ${config.alto} cm`);
  } else if (config.medida) {
    partes.push(`Medida: ${config.medida}`);
  }

  // Tipo de venta
  if (config.tipo_venta) {
    const tipoVentaLabels: Record<string, string> = {
      'mt2': 'por m²',
      'unidad': 'por unidad',
      'mt_lineal': 'por metro lineal'
    };
    const label = tipoVentaLabels[config.tipo_venta] || config.tipo_venta;
    partes.push(`Venta ${label}`);
  }

  // Material
  if (config.material) {
    partes.push(`Material: ${config.material}`);
  }

  // Tecnología
  if (config.tecnologia) {
    partes.push(`Tecnología: ${config.tecnologia}`);
  }

  // Tintas
  if (config.tintas) {
    if (Array.isArray(config.tintas)) {
      partes.push(`Tintas: ${config.tintas.join(', ')}`);
    } else if (typeof config.tintas === 'string') {
      partes.push(`Tintas: ${config.tintas}`);
    }
  }

  // Acabados
  if (config.acabados && Array.isArray(config.acabados) && config.acabados.length > 0) {
    partes.push(`Acabados: ${config.acabados.join(', ')}`);
  }

  // Servicios
  if (config.servicios && Array.isArray(config.servicios) && config.servicios.length > 0) {
    partes.push(`Servicios: ${config.servicios.join(', ')}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos de Materiales Rígidos
 */
function formatMaterialesRigidos(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.ancho && config.alto) {
    partes.push(`${config.ancho} x ${config.alto} cm`);
  }

  // Material
  if (config.material) {
    partes.push(`Material: ${config.material}`);
  }

  // Espesor
  if (config.espesor) {
    partes.push(`Espesor: ${config.espesor}mm`);
  }

  // Acabados
  if (config.acabados && Array.isArray(config.acabados) && config.acabados.length > 0) {
    partes.push(`Acabados: ${config.acabados.join(', ')}`);
  }

  // Servicios
  if (config.servicios && Array.isArray(config.servicios) && config.servicios.length > 0) {
    partes.push(`Servicios: ${config.servicios.join(', ')}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos de Talonarios
 */
function formatTalonarios(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Páginas
  if (config.cantidad_paginas) {
    partes.push(`${config.cantidad_paginas} páginas`);
  }

  // Dimensiones
  if (config.medida || (config.ancho && config.alto)) {
    const medida = config.medida || `${config.ancho} x ${config.alto} cm`;
    partes.push(`Medida: ${medida}`);
  }

  // Material
  if (config.material) {
    partes.push(`Material: ${config.material}`);
  }

  // Tintas
  if (config.tintas) {
    if (Array.isArray(config.tintas)) {
      partes.push(`Tintas: ${config.tintas.join(', ')}`);
    } else if (typeof config.tintas === 'string') {
      partes.push(`Tintas: ${config.tintas}`);
    }
  }

  // Tipo de copia
  if (config.tipo_copia) {
    partes.push(`Tipo: ${config.tipo_copia}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos de Plotter Corte
 */
function formatPlotterCorte(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Tipo de venta
  if (config.tipo_venta) {
    const tipoVentaLabels: Record<string, string> = {
      'mt2': 'por m²',
      'unidad': 'por unidad',
      'mt_lineal': 'por metro lineal'
    };
    const label = tipoVentaLabels[config.tipo_venta] || config.tipo_venta;
    partes.push(`Venta ${label}`);
  }

  // Material
  if (config.material) {
    partes.push(`Material: ${config.material}`);
  }

  // Marca
  if (config.marca) {
    partes.push(`Marca: ${config.marca}`);
  }

  // Color
  if (config.color) {
    partes.push(`Color: ${config.color}`);
  }

  // Acabados
  if (config.acabados && Array.isArray(config.acabados) && config.acabados.length > 0) {
    partes.push(`Acabados: ${config.acabados.join(', ')}`);
  }

  // Servicios
  if (config.servicios && Array.isArray(config.servicios) && config.servicios.length > 0) {
    partes.push(`Servicios: ${config.servicios.join(', ')}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos de Portabanners
 */
function formatPortabanners(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.ancho && config.alto) {
    partes.push(`${config.ancho} x ${config.alto} cm`);
  }

  // Tecnología
  if (config.tecnologia) {
    partes.push(`Tecnología: ${config.tecnologia}`);
  }

  // Material
  if (config.material) {
    partes.push(`Material: ${config.material}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos de Sellos
 */
function formatSellos(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Tipo de sello
  if (config.tipo_sello) {
    partes.push(`Tipo: ${config.tipo_sello}`);
  }

  // Dimensiones
  if (config.ancho && config.alto) {
    partes.push(`${config.ancho} x ${config.alto} mm`);
  }

  // Marca
  if (config.marca) {
    partes.push(`Marca: ${config.marca}`);
  }

  // Tipo de tinta
  if (config.tipo_tinta) {
    partes.push(`Tinta: ${config.tipo_tinta}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formatea la configuración de productos del Centro de Copiado
 */
function formatCentroCopiado(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Tamaño de papel
  if (config.tamanio_papel) {
    partes.push(`Tamaño: ${config.tamanio_papel}`);
  }

  // Tipo de papel
  if (config.tipo_papel) {
    partes.push(`Papel: ${config.tipo_papel}`);
  }

  // Gramaje
  if (config.gramaje) {
    partes.push(`${config.gramaje}g`);
  }

  // Tinta
  if (config.tinta) {
    partes.push(`Tinta: ${config.tinta}`);
  }

  // Caras
  if (config.caras) {
    partes.push(`Impresión: ${config.caras}`);
  }

  // Cantidad de páginas
  if (config.cantidad_paginas) {
    partes.push(`${config.cantidad_paginas} páginas`);
  }

  // Anillado
  if (config.anillado) {
    partes.push(`Anillado: ${config.anillado}`);
  }

  // Plastificado
  if (config.plastificado) {
    partes.push(`Plastificado: ${config.plastificado}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Formateador genérico para configuraciones no reconocidas
 */
function formatGenerico(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Buscar campos comunes
  const camposComunes = [
    { key: 'ancho', label: 'Ancho' },
    { key: 'alto', label: 'Alto' },
    { key: 'medida', label: 'Medida' },
    { key: 'material', label: 'Material' },
    { key: 'color', label: 'Color' },
    { key: 'tecnologia', label: 'Tecnología' },
  ];

  camposComunes.forEach(({ key, label }) => {
    if (config[key]) {
      partes.push(`${label}: ${config[key]}`);
    }
  });

  // Acabados y servicios
  if (config.acabados && Array.isArray(config.acabados) && config.acabados.length > 0) {
    partes.push(`Acabados: ${config.acabados.join(', ')}`);
  }

  if (config.servicios && Array.isArray(config.servicios) && config.servicios.length > 0) {
    partes.push(`Servicios: ${config.servicios.join(', ')}`);
  }

  return partes.length > 0 ? partes.join(' • ') : '';
}

/**
 * Función principal que formatea cualquier configuración según la categoría del producto
 */
export function formatConfiguracionProducto(
  configuracion: ConfiguracionBase | null | undefined,
  categoria?: string
): string {
  // Si no hay configuración, retornar vacío
  if (!configuracion || Object.keys(configuracion).length === 0) {
    return '';
  }

  // Normalizar categoría
  const categoriaNormalizada = categoria?.toLowerCase().trim() || '';

  // Formatear según categoría
  if (categoriaNormalizada.includes('impresion') && categoriaNormalizada.includes('laser')) {
    return formatImpresionLaser(configuracion);
  }

  if (categoriaNormalizada.includes('gran') && categoriaNormalizada.includes('formato')) {
    return formatGranFormato(configuracion);
  }

  if (categoriaNormalizada.includes('material') && categoriaNormalizada.includes('rigido')) {
    return formatMaterialesRigidos(configuracion);
  }

  if (categoriaNormalizada.includes('talonario')) {
    return formatTalonarios(configuracion);
  }

  if (categoriaNormalizada.includes('plotter') && categoriaNormalizada.includes('corte')) {
    return formatPlotterCorte(configuracion);
  }

  if (categoriaNormalizada.includes('portabanner')) {
    return formatPortabanners(configuracion);
  }

  if (categoriaNormalizada.includes('sello')) {
    return formatSellos(configuracion);
  }

  if (categoriaNormalizada.includes('centro') && categoriaNormalizada.includes('copiado')) {
    return formatCentroCopiado(configuracion);
  }

  // Si no se reconoce la categoría, usar formateador genérico
  return formatGenerico(configuracion);
}

/**
 * Genera una descripción completa combinando nombre del producto y configuración
 */
export function generarDescripcionCompleta(
  productoNombre: string,
  configuracion: ConfiguracionBase | null | undefined,
  categoria?: string,
  descripcionManual?: string
): string {
  // Si hay descripción manual, priorizarla
  if (descripcionManual && descripcionManual.trim()) {
    return descripcionManual.trim();
  }

  // Formatear configuración
  const configFormateada = formatConfiguracionProducto(configuracion, categoria);

  // Si hay configuración formateada, retornarla
  if (configFormateada) {
    return configFormateada;
  }

  // Si no hay nada, retornar solo el nombre del producto
  return productoNombre;
}
