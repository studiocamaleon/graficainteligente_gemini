import { supabase } from './supabase';
import { sendMessage, getConnectionStatus } from './whatsappApi';

export interface WhatsAppNotificacion {
  id: string;
  company_id: string;
  orden_trabajo_id?: string;
  orden_copiado_id?: string;
  tipo_notificacion: 'nueva_orden_trabajo' | 'nueva_orden_copiado' | 'orden_finalizada';
  telefono_destino: string;
  mensaje_enviado: string;
  estado_envio: 'enviado' | 'fallido';
  error_mensaje?: string;
  respuesta_backend?: any;
  created_at: string;
}

export interface EnviarNotificacionParams {
  companyId: string;
  clienteId: string;
  ordenId: string;
  tipo: 'nueva_orden_trabajo' | 'nueva_orden_copiado' | 'orden_finalizada';
  ordenTipo: 'trabajo' | 'copiado';
}

export interface EnviarNotificacionResult {
  success: boolean;
  notificacionId?: string;
  error?: string;
}

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

export function buildTrackingUrl(trackingToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/tracking/${trackingToken}`;
}

export function generateNuevaOrdenTrabajoMessage(
  orden: any,
  cliente: any,
  items: any[],
  company: any
): string {
  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;
  const trackingUrl = orden.tracking_token ? buildTrackingUrl(orden.tracking_token) : '';

  const itemsDetalle = items.map((item, index) => {
    let detalle = `${index + 1}. *${item.producto_nombre || 'Producto'}* - Cantidad: ${item.cantidad}`;

    if (item.servicios && item.servicios.length > 0) {
      const serviciosTexto = item.servicios.map((s: any) => s.nombre).join(', ');
      detalle += `\n   Servicios: ${serviciosTexto}`;
    }

    if (item.acabados && item.acabados.length > 0) {
      const acabadosTexto = item.acabados.map((a: any) => a.nombre).join(', ');
      detalle += `\n   Acabados: ${acabadosTexto}`;
    }

    if (item.precio_total) {
      detalle += `\n   Subtotal: $${parseFloat(item.precio_total).toFixed(2)}`;
    }

    return detalle;
  }).join('\n\n');

  const subtotal = parseFloat(orden.subtotal || 0).toFixed(2);
  const descuentos = parseFloat(orden.total_descuentos || 0).toFixed(2);
  const total = parseFloat(orden.total || 0).toFixed(2);

  const pagosRealizados = orden.pagos_totales || 0;
  const saldoPendiente = (parseFloat(orden.total || 0) - parseFloat(pagosRealizados)).toFixed(2);

  const fechaEntrega = orden.fecha_estimada_entrega
    ? new Date(orden.fecha_estimada_entrega).toLocaleDateString('es-AR')
    : 'A confirmar';

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `Tu orden ha sido registrada exitosamente.\n\n`;
  mensaje += `📋 *Orden Nº:* ${orden.numero_orden}\n`;
  mensaje += `📅 *Fecha de entrega:* ${fechaEntrega}\n\n`;
  mensaje += `*Detalle de tu pedido:*\n\n`;
  mensaje += `${itemsDetalle}\n\n`;
  mensaje += `💰 *Subtotal:* $${subtotal}\n`;

  if (parseFloat(descuentos) > 0) {
    mensaje += `💰 *Descuentos:* -$${descuentos}\n`;
  }

  mensaje += `💰 *Total:* $${total}\n`;
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

export function generateNuevaOrdenCopiadoMessage(
  orden: any,
  cliente: any,
  items: any[],
  company: any
): string {
  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;

  const itemsDetalle = items.map((item, index) => {
    let detalle = `${index + 1}. `;

    if (item.nombre_archivo) {
      detalle += `*${item.nombre_archivo}*\n`;
    }

    if (item.descripcion) {
      detalle += `   ${item.descripcion}\n`;
    }

    const config = item.configuracion || {};

    if (config.cantidad_copias) {
      detalle += `   Copias: ${config.cantidad_copias}`;
    }

    if (config.tipo_impresion) {
      detalle += ` - ${config.tipo_impresion}`;
    }

    if (config.tamanio_papel) {
      detalle += ` - ${config.tamanio_papel}`;
    }

    if (config.tipo_papel) {
      detalle += ` - ${config.tipo_papel}`;
    }

    if (config.anillado) {
      detalle += `\n   Anillado: ${config.anillado}`;
    }

    if (config.plastificado) {
      detalle += `\n   Plastificado: ${config.plastificado}`;
    }

    if (item.precio) {
      detalle += `\n   Subtotal: $${parseFloat(item.precio).toFixed(2)}`;
    }

    return detalle;
  }).join('\n\n');

  const total = parseFloat(orden.total || 0).toFixed(2);
  const pagosRealizados = orden.pagos_totales || 0;
  const saldoPendiente = (parseFloat(orden.total || 0) - parseFloat(pagosRealizados)).toFixed(2);

  const fechaEntrega = orden.fecha_entrega
    ? new Date(orden.fecha_entrega).toLocaleDateString('es-AR')
    : 'A confirmar';

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `Tu orden de copiado ha sido registrada.\n\n`;
  mensaje += `📋 *Orden Nº:* ${orden.numero_orden}\n`;
  mensaje += `📅 *Fecha de entrega:* ${fechaEntrega}\n\n`;
  mensaje += `*Detalle de tu pedido:*\n\n`;
  mensaje += `${itemsDetalle}\n\n`;
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

export async function verificarWhatsAppDisponible(companyId: string): Promise<boolean> {
  try {
    const status = await getConnectionStatus(companyId);
    return status.connected === true;
  } catch (error) {
    console.error('Error verificando estado de WhatsApp:', error);
    return false;
  }
}

export async function enviarNotificacion(
  params: EnviarNotificacionParams
): Promise<EnviarNotificacionResult> {
  try {
    const { companyId, clienteId, ordenId, tipo, ordenTipo } = params;

    const whatsappDisponible = await verificarWhatsAppDisponible(companyId);
    if (!whatsappDisponible) {
      return {
        success: false,
        error: 'WhatsApp no está conectado'
      };
    }

    const { data: cliente, error: clienteError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return {
        success: false,
        error: 'No se pudo obtener información del cliente'
      };
    }

    if (!cliente.whatsapp) {
      return {
        success: false,
        error: 'El cliente no tiene número de WhatsApp configurado'
      };
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return {
        success: false,
        error: 'No se pudo obtener información de la empresa'
      };
    }

    let orden: any;
    let items: any[] = [];
    let mensaje: string = '';

    if (ordenTipo === 'trabajo') {
      const { data: ordenData, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .select(`
          *,
          items:ordenes_trabajo_items(
            *,
            servicios:ordenes_trabajo_servicios_items(
              servicio:servicio_id(nombre)
            ),
            acabados:ordenes_trabajo_acabados_items(
              acabado:acabado_id(nombre)
            )
          ),
          pagos:ordenes_trabajo_pagos(monto)
        `)
        .eq('id', ordenId)
        .single();

      if (ordenError || !ordenData) {
        return {
          success: false,
          error: 'No se pudo obtener información de la orden'
        };
      }

      orden = ordenData;
      items = ordenData.items || [];

      const pagosTotal = (ordenData.pagos || []).reduce((sum: number, p: any) => sum + parseFloat(p.monto || 0), 0);
      orden.pagos_totales = pagosTotal;

      if (tipo === 'nueva_orden_trabajo') {
        mensaje = generateNuevaOrdenTrabajoMessage(orden, cliente, items, company);
      } else if (tipo === 'orden_finalizada') {
        const saldoPendiente = parseFloat(orden.total || 0) - pagosTotal;
        mensaje = generateOrdenFinalizadaMessage(orden, cliente, company, saldoPendiente);
      }
    } else {
      const { data: ordenData, error: ordenError } = await supabase
        .from('centro_copiado_ordenes')
        .select(`
          *,
          items:centro_copiado_ordenes_items(*),
          pagos:centro_copiado_ordenes_pagos(monto)
        `)
        .eq('id', ordenId)
        .single();

      if (ordenError || !ordenData) {
        return {
          success: false,
          error: 'No se pudo obtener información de la orden'
        };
      }

      orden = ordenData;
      items = ordenData.items || [];

      const pagosTotal = (ordenData.pagos || []).reduce((sum: number, p: any) => sum + parseFloat(p.monto || 0), 0);
      orden.pagos_totales = pagosTotal;

      if (tipo === 'nueva_orden_copiado') {
        mensaje = generateNuevaOrdenCopiadoMessage(orden, cliente, items, company);
      } else if (tipo === 'orden_finalizada') {
        const saldoPendiente = parseFloat(orden.total || 0) - pagosTotal;
        mensaje = generateOrdenFinalizadaMessage(orden, cliente, company, saldoPendiente);
      }
    }

    if (!mensaje) {
      return {
        success: false,
        error: 'No se pudo generar el mensaje'
      };
    }

    const mensajeSanitizado = sanitizeMessage(mensaje);

    console.log('[WhatsApp] Preparando envío:', {
      tipo,
      telefonoDestino: cliente.whatsapp,
      longitudMensaje: mensajeSanitizado.length
    });

    const telefonoFormateado = formatPhoneNumber(cliente.whatsapp);

    const respuesta = await sendMessage(companyId, telefonoFormateado, mensajeSanitizado);

    console.log('[WhatsApp] Respuesta del backend:', respuesta);

    const notificacionData: any = {
      company_id: companyId,
      tipo_notificacion: tipo,
      telefono_destino: telefonoFormateado,
      mensaje_enviado: mensajeSanitizado,
      estado_envio: 'enviado',
      respuesta_backend: respuesta
    };

    if (ordenTipo === 'trabajo') {
      notificacionData.orden_trabajo_id = ordenId;
    } else {
      notificacionData.orden_copiado_id = ordenId;
    }

    const { data: notificacion, error: notifError } = await supabase
      .from('whatsapp_notificaciones')
      .insert(notificacionData)
      .select()
      .single();

    if (notifError) {
      console.error('Error al registrar notificación:', notifError);
    }

    return {
      success: true,
      notificacionId: notificacion?.id
    };

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Error desconocido';
    const errorDetails = {
      message: errorMessage,
      stack: error?.stack,
      response: error?.response,
      status: error?.status
    };

    console.error('[WhatsApp] Error al enviar notificación:', errorDetails);

    try {
      const cliente = await supabase
        .from('clients')
        .select('whatsapp')
        .eq('id', params.clienteId)
        .single();

      const telefonoCliente = cliente?.data?.whatsapp || 'Sin teléfono';

      const notificacionData: any = {
        company_id: params.companyId,
        tipo_notificacion: params.tipo,
        telefono_destino: telefonoCliente,
        mensaje_enviado: 'Error al generar o enviar mensaje',
        estado_envio: 'fallido',
        error_mensaje: errorMessage.substring(0, 500),
        respuesta_backend: errorDetails
      };

      if (params.ordenTipo === 'trabajo') {
        notificacionData.orden_trabajo_id = params.ordenId;
      } else {
        notificacionData.orden_copiado_id = params.ordenId;
      }

      await supabase
        .from('whatsapp_notificaciones')
        .insert(notificacionData);

      console.log('[WhatsApp] Error registrado en base de datos');
    } catch (logError) {
      console.error('[WhatsApp] Error al registrar fallo en BD:', logError);
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}
