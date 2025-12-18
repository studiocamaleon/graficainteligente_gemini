/**
 * Utilidades para formatear configuraciones de productos en presupuestos
 * Convierte objetos de configuración técnica en texto legible para clientes
 *
 * IMPORTANTE: Esta lógica debe coincidir EXACTAMENTE con la usada en OrdenItemsTab.tsx
 * para garantizar consistencia entre órdenes de trabajo y presupuestos.
 */

interface ConfiguracionBase {
  [key: string]: any;
}

/**
 * Formatea el valor de cara impresa
 */
function formatCaraImpresa(cara: string): string {
  if (cara === '1/0') return 'Frente';
  if (cara === '1/1') return 'Frente y Dorso';
  if (cara === 'frente_y_dorso') return 'Frente y Dorso';
  if (cara === 'solo_frente') return 'Frente';
  return cara;
}

/**
 * Formatea espesor o gramaje con su unidad correcta
 */
function formatEspesorOGramaje(config: ConfiguracionBase): string | null {
  // Si tiene espesor, usar la unidad del material
  if (config.espesor && config.unidad_espesor) {
    // Para gramajes, agregar espacio antes de la unidad
    if (config.unidad_espesor === 'gr' || config.unidad_espesor === 'g') {
      return `${config.espesor} ${config.unidad_espesor}`;
    }
    // Para otras unidades (mm, cm, etc), no agregar espacio
    return `${config.espesor}${config.unidad_espesor}`;
  }
  // Fallback: si solo tiene espesor sin unidad
  if (config.espesor) {
    return `${config.espesor}mm`;
  }
  // Fallback legacy: si tiene gramaje (por compatibilidad con datos antiguos)
  if (config.gramaje) {
    return `${config.gramaje} g`;
  }
  return null;
}

/**
 * Formatea servicios y acabados seleccionados
 */
function formatServiciosYAcabados(config: ConfiguracionBase): string[] {
  const partes: string[] = [];

  // Servicios seleccionados
  if (config.servicios_seleccionados && Array.isArray(config.servicios_seleccionados)) {
    config.servicios_seleccionados.forEach((s: any) => {
      const nombre = s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre;
      partes.push(`Servicio: ${nombre}`);
    });
  }

  // Acabados seleccionados
  if (config.acabados_seleccionados && Array.isArray(config.acabados_seleccionados)) {
    config.acabados_seleccionados.forEach((a: any) => {
      const nombre = a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre;
      partes.push(`Acabado: ${nombre}`);
    });
  }

  return partes;
}

/**
 * Formatea la configuración de productos de Impresión Láser
 * Usa los mismos campos que OrdenItemsTab.tsx
 */
function formatImpresionLaser(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones usando medida_ancho y medida_alto
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Material con variante
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  // Espesor/Gramaje con unidad
  const espesorFormateado = formatEspesorOGramaje(config);
  if (espesorFormateado) {
    partes.push(espesorFormateado);
  }

  // Tecnología
  if (config.tecnologia_nombre) {
    partes.push(config.tecnologia_nombre);
  }

  // Tinta
  if (config.tinta_nombre) {
    partes.push(config.tinta_nombre);
  }

  // Cara impresa
  if (config.cara_impresa) {
    partes.push(formatCaraImpresa(config.cara_impresa));
  }

  // Servicios y acabados
  const serviciosAcabados = formatServiciosYAcabados(config);
  partes.push(...serviciosAcabados);

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos de Gran Formato
 */
function formatGranFormato(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Material con variante
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  // Espesor/Gramaje
  const espesorFormateado = formatEspesorOGramaje(config);
  if (espesorFormateado) {
    partes.push(espesorFormateado);
  }

  // Tecnología
  if (config.tecnologia_nombre) {
    partes.push(config.tecnologia_nombre);
  }

  // Tinta
  if (config.tinta_nombre) {
    partes.push(config.tinta_nombre);
  }

  // Cara impresa
  if (config.cara_impresa) {
    partes.push(formatCaraImpresa(config.cara_impresa));
  }

  // Color (para algunos productos)
  if (config.color) {
    partes.push(config.color);
  }

  // Servicios y acabados
  const serviciosAcabados = formatServiciosYAcabados(config);
  partes.push(...serviciosAcabados);

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos de Materiales Rígidos
 */
function formatMaterialesRigidos(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Material con variante
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  // Espesor con unidad
  const espesorFormateado = formatEspesorOGramaje(config);
  if (espesorFormateado) {
    partes.push(espesorFormateado);
  }

  // Tecnología
  if (config.tecnologia_nombre) {
    partes.push(config.tecnologia_nombre);
  }

  // Tinta
  if (config.tinta_nombre) {
    partes.push(config.tinta_nombre);
  }

  // Servicios y acabados
  const serviciosAcabados = formatServiciosYAcabados(config);
  partes.push(...serviciosAcabados);

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos de Talonarios
 */
function formatTalonarios(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Material
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  // Espesor/Gramaje
  const espesorFormateado = formatEspesorOGramaje(config);
  if (espesorFormateado) {
    partes.push(espesorFormateado);
  }

  // Tecnología
  if (config.tecnologia_nombre) {
    partes.push(config.tecnologia_nombre);
  }

  // Tinta
  if (config.tinta_nombre) {
    partes.push(config.tinta_nombre);
  }

  // Páginas
  if (config.cantidad_paginas) {
    partes.push(`${config.cantidad_paginas} hojas`);
  }

  // Tipo de copia
  if (config.tipo_copia) {
    partes.push(config.tipo_copia);
  }

  // Servicios y acabados
  const serviciosAcabados = formatServiciosYAcabados(config);
  partes.push(...serviciosAcabados);

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos de Plotter Corte
 */
function formatPlotterCorte(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Material
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  // Marca
  if (config.marca) {
    partes.push(config.marca);
  }

  // Color
  if (config.color) {
    partes.push(config.color);
  }

  // Servicios y acabados
  const serviciosAcabados = formatServiciosYAcabados(config);
  partes.push(...serviciosAcabados);

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos de Portabanners
 */
function formatPortabanners(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Tecnología
  if (config.tecnologia_nombre) {
    partes.push(config.tecnologia_nombre);
  }

  // Material
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos de Sellos
 */
function formatSellos(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Tipo de sello
  if (config.tipo_sello) {
    partes.push(config.tipo_sello);
  }

  // Dimensiones (en mm para sellos)
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} mm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} mm`);
    }
  }

  // Marca
  if (config.marca) {
    partes.push(config.marca);
  }

  // Tipo de tinta
  if (config.tipo_tinta) {
    partes.push(config.tipo_tinta);
  }

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formatea la configuración de productos del Centro de Copiado
 */
function formatCentroCopiado(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Tamaño de papel
  if (config.tamanio_papel) {
    partes.push(config.tamanio_papel);
  }

  // Tipo de papel
  if (config.tipo_papel) {
    partes.push(config.tipo_papel);
  }

  // Gramaje
  if (config.gramaje) {
    partes.push(`${config.gramaje} g`);
  }

  // Tinta
  if (config.tinta) {
    partes.push(config.tinta);
  } else if (config.tipo_tinta) {
    partes.push(config.tipo_tinta === 'CMYK' ? 'Color' : 'B/N');
  }

  // Caras
  if (config.caras) {
    partes.push(config.caras);
  } else if (config.cara_impresa) {
    partes.push(formatCaraImpresa(config.cara_impresa));
  }

  // Cantidad de Juegos y Hojas (Formato unificado)
  if (config.cantidad_copias && config.cantidad_hojas) {
    partes.push(`${config.cantidad_copias} juegos x ${config.cantidad_hojas} hojas`);
  } else if (config.cantidad_paginas) {
    partes.push(`${config.cantidad_paginas} páginas`);
  } else if (config.cantidad_hojas) {
    partes.push(`${config.cantidad_hojas} hojas`);
  }

  // Anillado
  if (config.anillado) {
    if (typeof config.anillado === 'object' && config.anillado.tipo) {
      partes.push(`Anillado: ${config.anillado.tipo}`);
    } else if (typeof config.anillado === 'string') {
      partes.push(`Anillado: ${config.anillado}`);
    }
  } else if (config.tipo_anillado) {
    partes.push(`Anillado: ${config.tipo_anillado}`);
  }

  // Plastificado
  if (config.plastificado) {
    if (typeof config.plastificado === 'object' && config.plastificado.tipo) {
      partes.push(`Plastificado: ${config.plastificado.tipo}`);
    } else if (typeof config.plastificado === 'string') {
      partes.push(`Plastificado: ${config.plastificado}`);
    }
  } else if (config.tipo_plastificado) {
    partes.push(`Plastificado: ${config.tipo_plastificado}`);
  }

  return partes.length > 0 ? partes.join(' | ') : '';
}

/**
 * Formateador genérico para configuraciones no reconocidas
 */
function formatGenerico(config: ConfiguracionBase): string {
  const partes: string[] = [];

  // Dimensiones
  if (config.medida_ancho || config.medida_alto) {
    if (config.medida_ancho && config.medida_alto) {
      partes.push(`${config.medida_ancho}x${config.medida_alto} cm`);
    } else {
      partes.push(`${config.medida_ancho || config.medida_alto} cm`);
    }
  }

  // Material
  if (config.material_nombre) {
    let materialTexto = config.material_nombre;
    if (config.variante_nombre) {
      materialTexto += ` - ${config.variante_nombre}`;
    }
    partes.push(materialTexto);
  }

  // Espesor/Gramaje
  const espesorFormateado = formatEspesorOGramaje(config);
  if (espesorFormateado) {
    partes.push(espesorFormateado);
  }

  // Tecnología
  if (config.tecnologia_nombre) {
    partes.push(config.tecnologia_nombre);
  }

  // Tinta
  if (config.tinta_nombre) {
    partes.push(config.tinta_nombre);
  }

  // Color
  if (config.color) {
    partes.push(config.color);
  }

  // Marca
  if (config.marca) {
    partes.push(config.marca);
  }

  // Servicios y acabados
  const serviciosAcabados = formatServiciosYAcabados(config);
  partes.push(...serviciosAcabados);

  return partes.length > 0 ? partes.join(' | ') : '';
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
