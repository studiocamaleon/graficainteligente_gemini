import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Trigger-Secret',
};

interface WebhookPayload {
  orden_id: string;
  company_id: string;
  tipo_orden: 'trabajo' | 'copiado';
}

function sanitizeMessage(message: string): string {
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

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('9')) {
    cleaned = cleaned.substring(1);
  }

  if (!cleaned.startsWith('54')) {
    cleaned = '54' + cleaned;
  }

  return cleaned;
}

function formatItemCopiado(item: any): string {
  const cantidad = item.cantidad_unidades;
  const precio = parseFloat(item.precio_unitario || 0).toFixed(2);
  const subtotal = parseFloat(item.subtotal || 0).toFixed(2);

  let detalle = '';

  if (item.tipo_item === 'impresion') {
    const hojas = item.cantidad_hojas || 0;
    const tamanio = item.tamanio_papel?.nombre || 'N/A';
    const papel = item.papel?.variante_nombre || item.papel?.nombre || 'N/A';
    const tinta = item.tipo_tinta === 'CMYK' ? 'Color' : 'Blanco y Negro';
    const caras = item.cara_impresa === 'frente_y_dorso' ? 'Doble faz' : 'Simple faz';

    detalle = `🖨️ *Impresión ${tinta}*\n`;
    detalle += `   ${cantidad}x ${hojas} hojas ${caras}\n`;
    detalle += `   ${tamanio} - ${papel}\n`;
    detalle += `   $${precio} c/u = $${subtotal}`;

  } else if (item.tipo_item === 'anillado') {
    const tipo = item.tipo_anillado === 'ring_wire' ? 'Ring Wire' : 'Plástico';
    detalle = `📚 *Anillado ${tipo}*\n`;
    detalle += `   ${cantidad} unidades\n`;
    detalle += `   $${precio} c/u = $${subtotal}`;

  } else if (item.tipo_item === 'plastificado') {
    const tipo = item.tipo_plastificado || 'N/A';
    detalle = `🎴 *Plastificado ${tipo}*\n`;
    detalle += `   ${cantidad} unidades\n`;
    detalle += `   $${precio} c/u = $${subtotal}`;
  }

  return detalle;
}

function generateOrdenTrabajoFinalizadaMessage(
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

function generateOrdenCopiadoFinalizadaMessage(
  orden: any,
  cliente: any,
  company: any,
  saldoPendiente: number
): string {
  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;
  const total = parseFloat(orden.total || 0).toFixed(2);
  const saldo = saldoPendiente.toFixed(2);

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `✅ Tu orden de copiado *${orden.numero_orden}* está lista para retirar!\n\n`;

  if (orden.fecha_entrega_estimada) {
    const fecha = new Date(orden.fecha_entrega_estimada);
    const fechaFormateada = fecha.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    mensaje += `📅 *Fecha de entrega:* ${fechaFormateada}\n\n`;
  } else {
    mensaje += `📅 *Fecha de entrega:* A confirmar\n\n`;
  }

  if (orden.items && orden.items.length > 0) {
    mensaje += `📋 *Detalle de la orden:*\n\n`;
    orden.items.forEach((item: any) => {
      mensaje += formatItemCopiado(item) + '\n\n';
    });
  }

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

async function sendWhatsAppMessage(
  companyId: string,
  phoneNumber: string,
  message: string
): Promise<any> {
  const whatsappBackendUrl = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

  console.log('[WhatsApp] Enviando mensaje a backend de Render:', {
    backend: whatsappBackendUrl,
    companyId,
    phoneNumber,
    messageLength: message.length
  });

  const response = await fetch(`${whatsappBackendUrl}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId,
      to: phoneNumber,
      message: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error del backend de WhatsApp (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  console.log('[WhatsApp] Mensaje enviado exitosamente:', responseData);

  return responseData;
}

async function checkWhatsAppConnection(companyId: string): Promise<boolean> {
  const whatsappBackendUrl = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

  try {
    console.log(`[WhatsApp] Verificando conexión para company: ${companyId}`);

    const statusResponse = await fetch(`${whatsappBackendUrl}/status/${companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      console.log('[WhatsApp] ⚠️ No se pudo verificar estado de WhatsApp');
      return false;
    }

    const statusData = await statusResponse.json();
    console.log('[WhatsApp] Estado de conexión:', statusData);

    return statusData.connected === true;
  } catch (error: any) {
    console.error('[WhatsApp] ⚠️ Error verificando estado de WhatsApp:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const triggerSecret = Deno.env.get('TRIGGER_SECRET_TOKEN');
    const providedSecret = req.headers.get('X-Trigger-Secret');

    if (!triggerSecret || providedSecret !== triggerSecret) {
      console.error('[Security] Intento de acceso no autorizado');
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const payload: WebhookPayload = await req.json();
    const { orden_id, company_id, tipo_orden } = payload;

    console.log('[Notify] Procesando notificación:', {
      orden_id,
      company_id,
      tipo_orden
    });

    if (!orden_id || !company_id || !tipo_orden) {
      return new Response(
        JSON.stringify({ error: 'Parámetros inválidos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: yaEnviado } = await supabase
      .from('whatsapp_notificaciones')
      .select('id')
      .eq(tipo_orden === 'trabajo' ? 'orden_trabajo_id' : 'orden_copiado_id', orden_id)
      .eq('tipo_notificacion', 'orden_finalizada')
      .maybeSingle();

    if (yaEnviado) {
      console.log('[Notify] ⚠️ Ya se envió notificación para esta orden. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Notificación ya enviada previamente' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let orden: any;
    let cliente: any;
    let pagosTotal = 0;

    if (tipo_orden === 'trabajo') {
      const { data: ordenData, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .select(`
          *,
          cliente:cliente_id(*)
        `)
        .eq('id', orden_id)
        .single();

      if (ordenError || !ordenData) {
        throw new Error('No se pudo obtener información de la orden de trabajo');
      }

      const { data: pagos } = await supabase
        .from('ordenes_trabajo_pagos')
        .select('monto')
        .eq('orden_id', orden_id);

      pagosTotal = (pagos || []).reduce((sum: number, p: any) => sum + parseFloat(p.monto || 0), 0);

      orden = ordenData;
      cliente = ordenData.cliente;
    } else {
      const { data: ordenData, error: ordenError } = await supabase
        .from('centro_copiado_ordenes')
        .select(`
          *,
          cliente:cliente_id(*),
          items:centro_copiado_ordenes_items(
            *,
            tamanio_papel:centro_copiado_tamanios_papel(nombre),
            papel:centro_copiado_papeles(variante_nombre)
          )
        `)
        .eq('id', orden_id)
        .single();

      if (ordenError || !ordenData) {
        console.error('[Notify] Error obteniendo orden de copiado:', ordenError);
        throw new Error('No se pudo obtener información de la orden de copiado');
      }

      console.log('[Notify] Orden de copiado obtenida:', {
        numero_orden: ordenData.numero_orden,
        items_count: ordenData.items?.length || 0,
        fecha_entrega: ordenData.fecha_entrega_estimada
      });

      const { data: pagos } = await supabase
        .from('centro_copiado_ordenes_pagos')
        .select('monto')
        .eq('orden_id', orden_id);

      pagosTotal = (pagos || []).reduce((sum: number, p: any) => sum + parseFloat(p.monto || 0), 0);

      orden = ordenData;
      cliente = ordenData.cliente;
    }

    if (!cliente) {
      throw new Error('No se encontró información del cliente');
    }

    if (!cliente.whatsapp) {
      console.log('[Notify] ⚠️ Cliente no tiene WhatsApp configurado. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Cliente sin WhatsApp configurado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('No se encontró información de la empresa');
    }

    const isConnected = await checkWhatsAppConnection(company_id);

    if (!isConnected) {
      console.log('[Notify] ⚠️ WhatsApp no está conectado para esta empresa. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'WhatsApp no está conectado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Notify] ✅ WhatsApp conectado, procediendo a enviar mensaje');

    const saldoPendiente = parseFloat(orden.total || 0) - pagosTotal;

    const mensaje = tipo_orden === 'trabajo'
      ? generateOrdenTrabajoFinalizadaMessage(orden, cliente, company, saldoPendiente)
      : generateOrdenCopiadoFinalizadaMessage(orden, cliente, company, saldoPendiente);

    const mensajeSanitizado = sanitizeMessage(mensaje);
    const telefonoFormateado = formatPhoneNumber(cliente.whatsapp);

    console.log('[Notify] Enviando mensaje de orden finalizada:', {
      tipo_orden,
      numeroOrden: orden.numero_orden,
      clienteNombre: cliente.nombre_fantasia || cliente.razon_social,
      telefono: telefonoFormateado,
      messageLength: mensajeSanitizado.length
    });

    let respuestaBackend: any;
    let estadoEnvio = 'enviado';
    let errorMensaje: string | null = null;

    try {
      respuestaBackend = await sendWhatsAppMessage(company_id, telefonoFormateado, mensajeSanitizado);
    } catch (error: any) {
      console.error('[Notify] ❌ Error enviando mensaje:', error);
      estadoEnvio = 'fallido';
      errorMensaje = error.message;
      respuestaBackend = { error: error.message };
    }

    const notificacionData: any = {
      company_id: company_id,
      tipo_notificacion: 'orden_finalizada',
      telefono_destino: telefonoFormateado,
      mensaje_enviado: mensajeSanitizado,
      estado_envio: estadoEnvio,
      respuesta_backend: respuestaBackend,
    };

    if (errorMensaje) {
      notificacionData.error_mensaje = errorMensaje;
    }

    if (tipo_orden === 'trabajo') {
      notificacionData.orden_trabajo_id = orden_id;
    } else {
      notificacionData.orden_copiado_id = orden_id;
    }

    const { error: insertError } = await supabase
      .from('whatsapp_notificaciones')
      .insert(notificacionData);

    if (insertError) {
      console.error('[Notify] ❌ Error guardando notificación:', insertError);
    } else {
      console.log('[Notify] ✅ Notificación registrada en base de datos');
    }

    return new Response(
      JSON.stringify({
        success: estadoEnvio === 'enviado',
        message: estadoEnvio === 'enviado'
          ? 'Notificación enviada exitosamente'
          : 'Error al enviar notificación',
        error: errorMensaje
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[Notify] ❌ Error general:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Error interno del servidor',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});