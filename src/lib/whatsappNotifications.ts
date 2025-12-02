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
  return `${origin}/track/${trackingToken}`;
}

export function generateNuevaOrdenTrabajoMessage(
  orden: any,
  cliente: any,
  items: any[],
  company: any,
  ordenesCopiado: any[] = []
): string {
  // DEBUG: Log de parámetro recibido
  console.log('📨 generateNuevaOrdenTrabajoMessage llamada con:');
  console.log('   - ordenesCopiado type:', typeof ordenesCopiado);
  console.log('   - ordenesCopiado isArray:', Array.isArray(ordenesCopiado));
  console.log('   - ordenesCopiado value:', JSON.stringify(ordenesCopiado, null, 2));

  // CRÍTICO: Normalizar ordenesCopiado al inicio para evitar errores con relaciones 1:1 de Supabase
  const ordenesArray = Array.isArray(ordenesCopiado)
    ? ordenesCopiado
    : (ordenesCopiado ? [ordenesCopiado] : []);

  console.log('✅ ordenesArray normalizado:', JSON.stringify(ordenesArray, null, 2));
  console.log('✅ ordenesArray.length:', ordenesArray.length);

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

  // Incluir órdenes de copiado si existen
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

  // Calcular totales consolidados
  const totalOrdenesCopiado = ordenesArray.length > 0
    ? ordenesArray.reduce((sum, oc) => sum + parseFloat(oc.total || 0), 0)
    : 0;

  // Mostrar desglose de totales
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
  const precio = parseFloat(item.precio_unitario || 0).toFixed(2);
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
          pagos:ordenes_trabajo_pagos(monto),
          ordenesCopiado:centro_copiado_ordenes!orden_trabajo_id(
            id,
            numero_orden,
            total,
            items:centro_copiado_ordenes_items(
              cantidad_unidades,
              cantidad_hojas,
              subtotal,
              tipo_tinta,
              cara_impresa,
              tipo_anillado,
              tipo_plastificado,
              descripcion,
              tamanio_papel:centro_copiado_tamanios_papel(nombre),
              papel:centro_copiado_papeles(
                variante_nombre,
                espesor,
                unidad_espesor,
                material:material_id(nombre)
              )
            )
          )
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
        // DEBUG: Log del valor original de ordenesCopiado
        console.log('🔍 DEBUG ordenesCopiado raw:', JSON.stringify(ordenData.ordenesCopiado, null, 2));
        console.log('🔍 DEBUG ordenesCopiado type:', typeof ordenData.ordenesCopiado);
        console.log('🔍 DEBUG ordenesCopiado isArray:', Array.isArray(ordenData.ordenesCopiado));

        // Normalizar ordenesCopiado a array (puede venir como objeto o array desde Supabase)
        let ordenesCopiado = ordenData.ordenesCopiado || [];

        // Si viene como objeto único (relación 1:1), convertir a array
        if (!Array.isArray(ordenesCopiado)) {
          console.log('⚠️ ordenesCopiado NO es array, convirtiendo...');
          ordenesCopiado = ordenesCopiado ? [ordenesCopiado] : [];
        }

        console.log('✅ ordenesCopiado normalizado:', JSON.stringify(ordenesCopiado, null, 2));
        console.log('✅ ordenesCopiado.length:', ordenesCopiado.length);

        // Si hay órdenes de copiado, cargar nombres de archivos
        if (ordenesCopiado.length > 0) {
          for (const oc of ordenesCopiado) {
            const { data: archivos } = await supabase
              .from('centro_copiado_ordenes_archivos')
              .select('nombre_archivo, item_generado_id')
              .eq('orden_copiado_id', oc.id);

            const archivosPorItem = new Map();
            archivos?.forEach(archivo => {
              if (archivo.item_generado_id) {
                archivosPorItem.set(archivo.item_generado_id, archivo.nombre_archivo);
              }
            });

            oc.items?.forEach((item: any) => {
              const nombreArchivo = archivosPorItem.get(item.id);
              if (nombreArchivo) {
                item.nombre_archivo = nombreArchivo;
              }
            });
          }
        }

        mensaje = generateNuevaOrdenTrabajoMessage(orden, cliente, items, company, ordenesCopiado);
      } else if (tipo === 'orden_finalizada') {
        const saldoPendiente = parseFloat(orden.total || 0) - pagosTotal;
        mensaje = generateOrdenFinalizadaMessage(orden, cliente, company, saldoPendiente);
      }
    } else {
      const { data: ordenData, error: ordenError } = await supabase
        .from('centro_copiado_ordenes')
        .select(`
          *,
          items:centro_copiado_ordenes_items(
            *,
            tamanio_papel:centro_copiado_tamanios_papel(nombre),
            papel:centro_copiado_papeles(
              variante_nombre,
              espesor,
              unidad_espesor,
              material:material_id(nombre)
            )
          ),
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
        const { data: archivos } = await supabase
          .from('centro_copiado_ordenes_archivos')
          .select('nombre_archivo, item_generado_id')
          .eq('orden_copiado_id', ordenId);

        const archivosPorItem = new Map();
        archivos?.forEach(archivo => {
          if (archivo.item_generado_id) {
            archivosPorItem.set(archivo.item_generado_id, archivo.nombre_archivo);
          }
        });

        items.forEach(item => {
          const nombreArchivo = archivosPorItem.get(item.id);
          if (nombreArchivo) {
            item.nombre_archivo = nombreArchivo;
          }
        });

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
