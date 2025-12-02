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

  let cleaned = phone.replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('54')) {
    return cleaned;
  }

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  if (!cleaned.startsWith('54')) {
    cleaned = `54${cleaned}`;
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
  origin: string
): string {
  const ordenesArray = Array.isArray(ordenesCopiado)
    ? ordenesCopiado
    : (ordenesCopiado ? [ordenesCopiado] : []);

  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;
  const trackingUrl = orden.tracking_token ? buildTrackingUrl(orden.tracking_token, origin) : '';

  const itemsDetalle = items.map((item, index) => {
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

  if (ordenesArray && ordenesArray.length > 0) {
    mensaje += `📄 *SERVICIOS DE COPIADO INCLUIDOS:*\n\n`;

    ordenesArray.forEach((oc, ocIndex) => {
      mensaje += `*Orden de Copiado ${oc.numero_orden}:*\n\n`;

      const itemsCopiadoDetalle = (oc.items || [])
        .map((item: any, itemIndex: number) => formatItemCopiadoParaNuevaOrden(item, itemIndex))
        .join('\n\n');

      mensaje += itemsCopiadoDetalle;
      mensaje += `\n\n*Total Orden Copiado:* $${parseFloat(oc.total || 0).toFixed(2)}\n`;

      if (ocIndex < ordenesArray.length - 1) {
        mensaje += `\n`;
      }
    });

    mensaje += `\n${'―'.repeat(35)}\n\n`;
  }

  const totalOrdenesCopiado = ordenesArray.length > 0
    ? ordenesArray.reduce((sum, oc) => sum + parseFloat(oc.total || 0), 0)
    : 0;

  mensaje += `💰 *Subtotal Items:* $${subtotalItems.toFixed(2)}\n`;

  if (totalOrdenesCopiado > 0) {
    mensaje += `💰 *Subtotal Copiado:* $${totalOrdenesCopiado.toFixed(2)}\n`;
  }

  if (descuentos > 0) {
    mensaje += `💰 *Descuentos:* -$${descuentos.toFixed(2)}\n`;
  }

  mensaje += `💰 *TOTAL ORDEN:* $${total.toFixed(2)}\n`;
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