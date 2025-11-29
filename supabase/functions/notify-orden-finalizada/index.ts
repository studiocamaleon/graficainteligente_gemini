import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Trigger-Secret',
};

interface WebhookPayload {
  orden_id: string;
  company_id: string;
  tipo_orden?: 'trabajo' | 'copiado'; // Opcional, se puede detectar automáticamente
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

function formatBusinessHours(businessHours: any[]): string {
  if (!businessHours || !Array.isArray(businessHours) || businessHours.length === 0) {
    return 'Consultar horarios';
  }

  const openDays = businessHours.filter((h: any) => h.is_open);

  if (openDays.length === 0) {
    return 'Cerrado temporalmente';
  }

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const formatTimeRange = (
    opening1: string | null,
    closing1: string | null,
    opening2: string | null,
    closing2: string | null
  ): string => {
    if (!opening1 || !closing1) return '';

    let result = `${opening1}-${closing1}`;

    if (opening2 && closing2) {
      result += ` y ${opening2}-${closing2}`;
    }

    return result;
  };

  type DayGroup = {
    days: number[];
    schedule: string;
  };

  const groups: DayGroup[] = [];

  for (const day of openDays) {
    const schedule = formatTimeRange(
      day.opening_time_1,
      day.closing_time_1,
      day.opening_time_2,
      day.closing_time_2
    );

    if (!schedule) continue;

    const existingGroup = groups.find(g => g.schedule === schedule);

    if (existingGroup) {
      existingGroup.days.push(day.day_of_week);
    } else {
      groups.push({
        days: [day.day_of_week],
        schedule,
      });
    }
  }

  groups.forEach(g => g.days.sort((a, b) => a - b));

  const result = groups.map(group => {
    const { days, schedule } = group;

    if (days.length === 1) {
      return `${dayNames[days[0]]}: ${schedule}`;
    }

    const ranges: number[][] = [];
    let currentRange = [days[0]];

    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] + 1) {
        currentRange.push(days[i]);
      } else {
        ranges.push(currentRange);
        currentRange = [days[i]];
      }
    }
    ranges.push(currentRange);

    const daysStr = ranges.map(range => {
      if (range.length === 1) {
        return dayNames[range[0]];
      }
      return `${dayNames[range[0]]} a ${dayNames[range[range.length - 1]]}`;
    }).join(', ');

    return `${daysStr}: ${schedule}`;
  });

  return result.join('\n');
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
  saldoPendiente: number,
  horariosFormateados: string
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

  if (horariosFormateados && horariosFormateados !== 'Consultar horarios') {
    mensaje += `🕐 *Horarios de atención:*\n`;
    mensaje += `${horariosFormateados}\n\n`;
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
  saldoPendiente: number,
  horariosFormateados: string
): string {
  const nombreCliente = cliente.nombre_fantasia || cliente.razon_social;
  const total = parseFloat(orden.total || 0).toFixed(2);
  const saldo = saldoPendiente.toFixed(2);

  let mensaje = `Hola ${nombreCliente}!\n\n`;
  mensaje += `✅ Tu orden de copiado *${orden.numero_orden}* está lista para retirar!\n\n`;
  mensaje += `💰 *Total:* $${total}\n`;
  mensaje += `💳 *Saldo pendiente:* $${saldo}\n\n`;

  mensaje += `📍 *Podés retirarla en:*\n`;

  if (company.address) {
    mensaje += `${company.address}\n\n`;
  }

  if (horariosFormateados && horariosFormateados !== 'Consultar horarios') {
    mensaje += `🕐 *Horarios de atención:*\n`;
    mensaje += `${horariosFormateados}\n\n`;
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
    const { orden_id, company_id } = payload;
    let tipo_orden = payload.tipo_orden;

    console.log('[Notify] Payload recibido:', {
      orden_id,
      company_id,
      tipo_orden_from_payload: tipo_orden
    });

    if (!orden_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Parámetros inválidos: orden_id y company_id son requeridos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // DETECCIÓN AUTOMÁTICA DEL TIPO DE ORDEN (si no viene en payload o viene mal)
    if (!tipo_orden || (tipo_orden !== 'trabajo' && tipo_orden !== 'copiado')) {
      console.log('[Notify] ⚠️ tipo_orden no válido o faltante, detectando automáticamente...');

      // Intentar como orden de trabajo
      const { data: ordenTrabajo } = await supabase
        .from('ordenes_trabajo')
        .select('id')
        .eq('id', orden_id)
        .maybeSingle();

      tipo_orden = ordenTrabajo ? 'trabajo' : 'copiado';
      console.log('[Notify] ✅ Tipo detectado automáticamente:', tipo_orden);
    }

    console.log('[Notify] Procesando notificación:', {
      orden_id,
      company_id,
      tipo_orden
    });

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
      console.log('[Notify] ✅ Usando lógica de ORDEN DE TRABAJO');

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
      console.log('[Notify] ✅ Usando lógica de ORDEN DE COPIADO');
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

    // Obtener horarios de atención de la empresa
    const { data: businessHours } = await supabase
      .from('company_business_hours')
      .select('*')
      .eq('company_id', company_id)
      .order('day_of_week', { ascending: true });

    console.log('[Notify] Horarios obtenidos:', {
      count: businessHours?.length || 0,
      businessHours
    });

    // Formatear horarios para el mensaje
    const horariosFormateados = formatBusinessHours(businessHours || []);
    console.log('[Notify] Horarios formateados:', horariosFormateados);

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

    console.log('[Notify] 📝 Generando mensaje para tipo:', tipo_orden);

    const mensaje = tipo_orden === 'trabajo'
      ? generateOrdenTrabajoFinalizadaMessage(orden, cliente, company, saldoPendiente, horariosFormateados)
      : generateOrdenCopiadoFinalizadaMessage(orden, cliente, company, saldoPendiente, horariosFormateados);

    console.log('[Notify] ✅ Mensaje generado, longitud:', mensaje.length);

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