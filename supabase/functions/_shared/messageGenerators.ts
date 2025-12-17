export function sanitizeMessage(message: string): string {
  if (!message) return '';

  let sanitized = message
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const maxLength = 4096;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 20) + '\n\n...mensaje truncado';
  }

  return sanitized;
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove non-digits
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading '0' (common in Argentina area codes, e.g. 011)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If it starts with '+', remove it (already handled by \D replace, but for safety if logic changes)
  // \D removes +, so cleaned is just digits now.

  // Add country code if missing (assuming Argentina 54)
  if (!cleaned.startsWith('54')) {
    cleaned = `54${cleaned}`;
  }

  // Fix Argentina Mobile: Add '9' after '54' if missing
  // Standard Argentina number (area + local) is 10 digits.
  // With '54' prefix -> 12 digits.
  // With '549' prefix -> 13 digits.
  // We check if it is 12 digits starting with 54 (and not 549 which would be weird for 12 digits but safety first)
  if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length === 12) {
    cleaned = `549${cleaned.substring(2)}`;
  }

  return cleaned;
}

export function buildTrackingUrl(trackingToken: string, origin: string): string {
  return `${origin}/track/${trackingToken}`;
}

export function generateNuevaOrdenTrabajoMessage(
  orden: any,
  cliente: any,
  items: any[],
  company: any,
  ordenesCopiado: any[] = [],
  origin: string,
  serviciosGlobales: any[] = []
): string {
  const ordenesArray = Array.isArray(ordenesCopiado)
    ? ordenesCopiado
    : (ordenesCopiado ? [ordenesCopiado] : []);

  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;
  const trackingUrl = orden.tracking_token ? buildTrackingUrl(orden.tracking_token, origin) : '';

  const itemsDetalle = items.map((item, index) => {
    // Si es un item de Copiado Unificado
    if (item.tipo_item === 'centro_copiado' && item.configuracion) {
      const conf = item.configuracion;
      let detalle = `${index + 1}. *Centro de Copiado* - ${conf.cantidad_copias || 1} juegos`;

      detalle += `\n   📄 ${conf.cantidad_hojas || 0} hojas - ${conf.tipo_tinta === 'CMYK' ? 'Color' : 'B/N'}`;
      if (conf.tamanio_nombre) detalle += ` - ${conf.tamanio_nombre}`;
      if (conf.papel_detalle) detalle += ` - ${conf.papel_detalle}`;

      // Terminaciones (Badges textuales)
      const terminaciones = [];
      if (conf.anillado) terminaciones.push(`Anillado ${conf.anillado.tipo}`);
      if (conf.plastificado) terminaciones.push(`Plastificado ${conf.plastificado.tipo}`);
      if (conf.guillotinado) terminaciones.push('Guillotinado');

      if (terminaciones.length > 0) {
        detalle += `\n   ✨ ${terminaciones.join(', ')}`;
      }

      // Removed item.descripcion to avoid duplication of specs

      if (item.precio_total) {
        detalle += `\n   Subtotal: $${parseFloat(item.precio_total).toFixed(2)}`;
      }
      return detalle;
    }

    // Item Estándar
    let detalle = `${index + 1}. *${item.producto_nombre || 'Producto'}* - Cantidad: ${item.cantidad}`;

    if (item.servicios && item.servicios.length > 0) {
      const serviciosTexto = item.servicios.map((s: any) => s.servicio?.nombre || s.nombre).join(', ');
      detalle += `\n   Servicios: ${serviciosTexto}`;
    }

    if (item.acabados && item.acabados.length > 0) {
      const acabadosTexto = item.acabados.map((a: any) => a.acabado?.nombre || a.nombre).join(', ');
      detalle += `\n   Acabados: ${acabadosTexto}`;
    }

    if (item.precio_total) {
      detalle += `\n   Subtotal: $${parseFloat(item.precio_total).toFixed(2)}`;
    }

    return detalle;
  }).join('\n\n');

  const subtotalItems = parseFloat(orden.subtotal || 0);
  const descuentos = parseFloat(orden.total_descuentos || 0);
  const total = parseFloat(orden.total || 0);

  const pagosRealizados = orden.pagos_totales || 0;
  const saldoPendiente = (total - parseFloat(pagosRealizados)).toFixed(2);

  const fechaEntrega = orden.fecha_estimada_entrega
    ? new Date(orden.fecha_estimada_entrega).toLocaleDateString('es-AR')
    : 'A confirmar';

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `Tu orden ha sido registrada exitosamente.\n\n`;
  mensaje += `📋 *Orden Nº:* ${orden.numero_orden}\n`;
  mensaje += `📅 *Fecha de entrega:* ${fechaEntrega}\n\n`;
  mensaje += `*Detalle de tu pedido:*\n\n`;
  mensaje += `${itemsDetalle}\n\n`;

  // Servicios Globales (Diseño, etc.)
  if (serviciosGlobales && serviciosGlobales.length > 0) {
    mensaje += `*Servicios Adicionales:*\n`;
    const serviciosDetalle = serviciosGlobales.map(s => {
      // Clean description: Remove '[Servicio] ' prefix and try to keep only the specific step name if possible
      let cleanDesc = s.descripcion.replace(/^\[Servicio\]\s*/i, '');
      // If description contains " - ", usually "Product - Variation", try to iterate
      // But user specifically asked for "Instalacion en nuestro taller x1". 
      // This implies s.descripcion is "Colocacion de vinilos impresos - Instalacion en nuestro taller"
      // Let's try to remove the first part if dash exists.
      if (cleanDesc.includes(' - ')) {
        const parts = cleanDesc.split(' - ');
        // Use the last part as it's usually the specific variation
        cleanDesc = parts[parts.length - 1];
      }

      return `   🔧 ${cleanDesc} x${s.cantidad} - $${parseFloat(s.subtotal).toFixed(2)}`;
    }).join('\n');
    mensaje += `${serviciosDetalle}\n\n`;
  }

  // Not rendering separate Copy Center Orders section anymore as requested implicitly by "simplified message"

  // Financial Summary Simplified
  const subtotalNeto = total - parseFloat(orden.subtotal_iva || 0); // Estimate net subtotal
  // Or better, use subtotalItems + Services as base?
  // User wants: Subtotal: $ XXX | IVA: $ XXX | Total: $ XXXX

  // Let's use the values we have. 
  // 'subtotalItems' in code was orden.subtotal (which is usually net items).
  // But wait, orden.subtotal might exclude services based on previous bug.
  // Let's just use the final total and work back if needed, or print what we have.

  // Actually, 'subtotalItems' variable defined above is `orden.subtotal`.
  // If `orden.subtotal` now includes services (after my fix), then it is the Net Taxable Base.

  const iva = parseFloat(orden.subtotal_iva || 0);

  mensaje += `💰 *Subtotal:* $${subtotalItems.toFixed(2)}\n`;

  if (iva > 0) {
    mensaje += `💰 *IVA (21%):* $${iva.toFixed(2)}\n`;
  }

  mensaje += `💰 *TOTAL:* $${total.toFixed(2)}\n`;
  mensaje += `💳 *Saldo pendiente:* $${saldoPendiente}\n\n`;

  if (trackingUrl) {
    mensaje += `🔍 *Seguí tu orden en tiempo real:*\n`;
    mensaje += `${trackingUrl}\n\n`;
  }

  mensaje += `📍 *${company.name || 'Nuestra empresa'}*\n`;

  if (company.address) {
    mensaje += `${company.address}\n`;
  }

  if (company.contact_phone) {
    mensaje += `📞 ${company.contact_phone}\n`;
  }

  mensaje += `\nGracias por confiar en nosotros!\n\n`;
  mensaje += `_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_`;

  return mensaje;
}

function formatItemCopiadoParaNuevaOrden(item: any, index: number): string {
  const cantidad = item.cantidad_unidades || 0;
  const subtotal = parseFloat(item.subtotal || 0).toFixed(2);

  let detalle = `${index + 1}. `;

  if (item.nombre_archivo) {
    detalle += `📄 *${item.nombre_archivo}*\n   `;
  }

  if (item.descripcion) {
    detalle += `${item.descripcion}\n   `;
  }

  const hojas = item.cantidad_hojas || 0;
  const tamanio = item.tamanio_papel?.nombre || 'N/A';

  const materialNombre = item.papel?.material?.nombre || '';
  const varianteNombre = item.papel?.variante_nombre || '';
  const espesor = item.papel?.espesor;
  const unidadEspesor = item.papel?.unidad_espesor || 'gr';

  let papelCompleto = '';
  if (materialNombre && varianteNombre) {
    papelCompleto = `${materialNombre} ${varianteNombre}`;
    if (espesor) {
      papelCompleto += ` ${espesor}${unidadEspesor}`;
    }
  } else {
    papelCompleto = varianteNombre || materialNombre || 'N/A';
  }

  const tinta = item.tipo_tinta === 'CMYK' ? 'Color' : 'Blanco y Negro';
  const caras = item.cara_impresa === 'frente_y_dorso' ? 'Doble faz' : 'Simple faz';

  detalle += `🖨️ *Impresión ${tinta}*\n`;
  detalle += `   ${cantidad} ${cantidad === 1 ? 'copia' : 'copias'} × ${hojas} hojas ${caras}\n`;
  detalle += `   ${tamanio} - ${papelCompleto}\n`;
  detalle += `   Subtotal: $${subtotal}`;

  const tieneTerminaciones = item.tipo_anillado || item.tipo_plastificado;
  if (!tieneTerminaciones && hojas > 0 && cantidad > 0) {
    const totalHojas = hojas * cantidad;
    const precioPorHoja = parseFloat(subtotal) / totalHojas;
    detalle += `\n   Precio por hoja: $${precioPorHoja.toFixed(2)}`;
  }

  if (item.tipo_anillado) {
    const tipo = item.tipo_anillado === 'ring_wire' ? 'Ring Wire' : 'Plástico';
    detalle += `\n   + Anillado ${tipo}`;
  }

  if (item.tipo_plastificado) {
    detalle += `\n   + Plastificado ${item.tipo_plastificado}`;
  }

  return detalle;
}

export function generateNuevaOrdenCopiadoMessage(
  orden: any,
  cliente: any,
  items: any[],
  company: any
): string {
  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;

  const itemsDetalle = items
    .map((item, index) => formatItemCopiadoParaNuevaOrden(item, index))
    .join('\n\n');

  const total = parseFloat(orden.total || 0).toFixed(2);
  const pagosRealizados = orden.pagos_totales || 0;
  const saldoPendiente = (parseFloat(orden.total || 0) - parseFloat(pagosRealizados)).toFixed(2);

  const fechaEntrega = orden.fecha_entrega_estimada
    ? new Date(orden.fecha_entrega_estimada).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    : 'A confirmar';

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `Tu orden de copiado ha sido registrada.\n\n`;
  mensaje += `📋 *Orden Nº:* ${orden.numero_orden}\n`;
  mensaje += `📅 *Fecha de entrega:* ${fechaEntrega}\n\n`;

  if (items.length > 0) {
    mensaje += `*Detalle de tu pedido:*\n\n`;
    mensaje += `${itemsDetalle}\n\n`;
  }

  mensaje += `💰 *Total:* $${total}\n`;
  mensaje += `💳 *Saldo pendiente:* $${saldoPendiente}\n\n`;

  mensaje += `📍 *${company.name || 'Nuestra empresa'}*\n`;

  if (company.address) {
    mensaje += `${company.address}\n`;
  }

  if (company.contact_phone) {
    mensaje += `📞 ${company.contact_phone}\n`;
  }

  mensaje += `\nGracias por confiar en nosotros!\n\n`;
  mensaje += `_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_`;

  return mensaje;
}

export function generateOrdenFinalizadaMessage(
  orden: any,
  cliente: any,
  company: any,
  saldoPendiente: number
): string {
  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;
  const total = parseFloat(orden.total || 0).toFixed(2);
  const saldo = saldoPendiente.toFixed(2);

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `✅ Tu orden *${orden.numero_orden}* está lista para retirar!\n\n`;
  mensaje += `💰 *Total:* $${total}\n`;
  mensaje += `💳 *Saldo pendiente:* $${saldo}\n\n`;
  mensaje += `📍 *Podés retirarla en:*\n`;

  if (company.address) {
    mensaje += `${company.address}\n\n`;
  }

  if (company.business_hours) {
    mensaje += `🕐 *Horarios de atención:*\n`;
    mensaje += `${company.business_hours}\n\n`;
  }

  if (company.contact_phone) {
    mensaje += `📞 *Contacto:* ${company.contact_phone}\n\n`;
  }

  if (company.google_review_url) {
    mensaje += `⭐ *Nos ayudarías mucho dejando tu opinión:*\n`;
    mensaje += `${company.google_review_url}\n\n`;
  }

  mensaje += `Gracias por confiar en nosotros!\n\n`;
  mensaje += `_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_`;

  return mensaje;
}

export function generateFacturaDisponibleMessage(
  clienteNombre: string,
  numeroOrden: string,
  numeroFactura: string,
  facturaUrl: string,
  companyName: string,
  companyAddress: string | null,
  companyPhone: string | null
): string {
  let mensaje = `Hola ${clienteNombre}!\n\n`;
  mensaje += `📄 Tu factura *${numeroFactura}* para la orden *${numeroOrden}* ya está disponible.\n\n`;
  mensaje += `📥 *Descargar factura:*\n`;
  mensaje += `${facturaUrl}\n\n`;
  mensaje += `ℹ️ Este link es válido por 30 días.\n\n`;

  if (companyAddress) {
    mensaje += `📍 *${companyName}*\n`;
    mensaje += `${companyAddress}\n`;
  }

  if (companyPhone) {
    mensaje += `📞 ${companyPhone}\n\n`;
  }

  mensaje += `Si tienes alguna consulta, no dudes en contactarnos.\n\n`;
  mensaje += `Gracias por tu confianza!\n\n`;
  mensaje += `_Tecnología desarrollada por CamaleonStudio - Agencia de desarrollo de Gráfica Corporearte_`;

  return mensaje;
}