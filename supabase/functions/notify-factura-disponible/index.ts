import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FacturaPayload {
  orden_id: string;
  numero_orden: string;
  numero_factura: string;
  cliente_nombre: string;
  cliente_whatsapp: string;
  company_id: string;
  company_name: string;
  factura_storage_path: string;
  frontend_origin: string;
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

function generateFacturaDisponibleMessage(
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

async function sendWhatsAppMessage(
  companyId: string,
  phoneNumber: string,
  message: string
): Promise<any> {
  const whatsappBackendUrl = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

  console.log('[WhatsApp] Enviando factura a backend de Render:', {
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
  console.log('[WhatsApp] Factura enviada exitosamente:', responseData);

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
    const payload: FacturaPayload = await req.json();
    const {
      orden_id,
      numero_orden,
      numero_factura,
      cliente_nombre,
      cliente_whatsapp,
      company_id,
      company_name,
      factura_storage_path,
      frontend_origin,
    } = payload;

    console.log('[Factura] Payload recibido:', {
      orden_id,
      numero_orden,
      numero_factura,
      company_id,
      factura_storage_path
    });

    if (!orden_id || !numero_orden || !numero_factura || !company_id || !factura_storage_path) {
      return new Response(
        JSON.stringify({ error: 'Parámetros inválidos: faltan campos requeridos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!cliente_whatsapp) {
      console.log('[Factura] ⚠️ Cliente no tiene WhatsApp configurado. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Cliente sin WhatsApp configurado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar si ya se envió notificación para esta factura
    const { data: yaEnviado } = await supabase
      .from('whatsapp_notificaciones')
      .select('id')
      .eq('orden_trabajo_id', orden_id)
      .eq('tipo_notificacion', 'factura_disponible')
      .maybeSingle();

    if (yaEnviado) {
      console.log('[Factura] ⚠️ Ya se envió notificación de factura. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Notificación ya enviada previamente' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener información de la empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('address, contact_phone')
      .eq('id', company_id)
      .single();

    if (companyError) {
      console.error('[Factura] Error obteniendo empresa:', companyError);
    }

    // Generar URL pública de descarga (signed URL con 30 días de validez)
    console.log('[Factura] Generando signed URL para:', factura_storage_path);

    const { data: urlData, error: urlError } = await supabase.storage
      .from('facturas')
      .createSignedUrl(factura_storage_path, 2592000); // 30 días = 2592000 segundos

    if (urlError) {
      console.error('[Factura] Error generando signed URL:', urlError);
      throw new Error(`Error generando URL de descarga: ${urlError.message}`);
    }

    const facturaUrl = urlData.signedUrl;
    console.log('[Factura] ✅ Signed URL generada exitosamente');

    // Verificar conexión de WhatsApp
    const isConnected = await checkWhatsAppConnection(company_id);

    if (!isConnected) {
      console.log('[Factura] ⚠️ WhatsApp no está conectado para esta empresa. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'WhatsApp no está conectado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Factura] ✅ WhatsApp conectado, procediendo a enviar mensaje');

    // Generar mensaje
    const mensaje = generateFacturaDisponibleMessage(
      cliente_nombre,
      numero_orden,
      numero_factura,
      facturaUrl,
      company_name,
      company?.address || null,
      company?.contact_phone || null
    );

    console.log('[Factura] ✅ Mensaje generado, longitud:', mensaje.length);

    const mensajeSanitizado = sanitizeMessage(mensaje);
    const telefonoFormateado = formatPhoneNumber(cliente_whatsapp);

    console.log('[Factura] Enviando mensaje:', {
      numeroOrden: numero_orden,
      numeroFactura: numero_factura,
      clienteNombre: cliente_nombre,
      telefono: telefonoFormateado,
      messageLength: mensajeSanitizado.length
    });

    // Enviar mensaje
    let respuestaBackend: any;
    let estadoEnvio = 'enviado';
    let errorMensaje: string | null = null;

    try {
      respuestaBackend = await sendWhatsAppMessage(company_id, telefonoFormateado, mensajeSanitizado);
    } catch (error: any) {
      console.error('[Factura] ❌ Error enviando mensaje:', error);
      estadoEnvio = 'fallido';
      errorMensaje = error.message;
      respuestaBackend = { error: error.message };
    }

    // Registrar notificación en base de datos
    const notificacionData = {
      company_id: company_id,
      orden_trabajo_id: orden_id,
      tipo_notificacion: 'factura_disponible',
      telefono_destino: telefonoFormateado,
      mensaje_enviado: mensajeSanitizado,
      estado_envio: estadoEnvio,
      respuesta_backend: respuestaBackend,
      metadata: {
        numero_orden,
        numero_factura,
        factura_url: facturaUrl,
        factura_storage_path,
      },
    };

    if (errorMensaje) {
      (notificacionData as any).error_mensaje = errorMensaje;
    }

    const { error: insertError } = await supabase
      .from('whatsapp_notificaciones')
      .insert(notificacionData);

    if (insertError) {
      console.error('[Factura] ❌ Error guardando notificación:', insertError);
    } else {
      console.log('[Factura] ✅ Notificación registrada en base de datos');
    }

    return new Response(
      JSON.stringify({
        success: estadoEnvio === 'enviado',
        message: estadoEnvio === 'enviado'
          ? 'Notificación de factura enviada exitosamente'
          : 'Error al enviar notificación',
        error: errorMensaje,
        factura_url: facturaUrl
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[Factura] ❌ Error general:', error);
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
