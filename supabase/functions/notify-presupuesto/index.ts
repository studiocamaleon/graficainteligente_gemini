import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Trigger-Secret',
};

interface PresupuestoNotification {
  presupuesto_id: string;
  company_id: string;
  tipo_notificacion: 'presupuesto_listo' | 'presupuesto_aprobado' | 'presupuesto_vencido';
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

function construirMensaje(
  presupuesto: any,
  tipo: string,
  company: any
): string {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const origin = Deno.env.get("FRONTEND_URL") || "https://app.pactto.com";
  const trackingUrl = presupuesto.tracking_token
    ? `${origin}/tracking/presupuesto/${presupuesto.tracking_token}`
    : null;

  const clienteNombre = presupuesto.cliente?.nombre_fantasia || presupuesto.cliente?.razon_social || "Cliente";

  switch (tipo) {
    case "presupuesto_listo":
      let mensaje = `Hola ${clienteNombre}!\n\n`;
      mensaje += `Tu presupuesto *${presupuesto.numero_presupuesto}* esta listo!\n\n`;
      mensaje += `*Total:* ${formatCurrency(presupuesto.total)}\n`;
      mensaje += `*Valido hasta:* ${formatDate(presupuesto.fecha_validez)}\n\n`;

      if (trackingUrl) {
        mensaje += `Ver online:\n${trackingUrl}\n\n`;
      }

      mensaje += `Desde el link podes aprobar el presupuesto directamente.\n\n`;

      if (company.contact_phone) {
        mensaje += `Contacto: ${company.contact_phone}\n\n`;
      }

      mensaje += `Gracias por confiar en nosotros!\n\n`;
      mensaje += `_Tecnologia desarrollada por CamaleonStudio - Agencia de desarrollo de Grafica Corporearte_`;

      return mensaje;

    case "presupuesto_aprobado":
      let mensajeAprobado = `Hola ${clienteNombre}!\n\n`;
      mensajeAprobado += `Presupuesto aprobado!\n\n`;
      mensajeAprobado += `Gracias por tu confirmacion. Ya comenzamos a procesar tu orden.\n\n`;
      mensajeAprobado += `*Presupuesto:* ${presupuesto.numero_presupuesto}\n`;

      if (presupuesto.orden_trabajo_id) {
        mensajeAprobado += `*Orden de Trabajo:* ${presupuesto.orden_trabajo?.numero_orden || 'En proceso'}\n\n`;
      }

      mensajeAprobado += `Te mantendremos informado del progreso.\n\n`;
      mensajeAprobado += `_Tecnologia desarrollada por CamaleonStudio - Agencia de desarrollo de Grafica Corporearte_`;

      return mensajeAprobado;

    case "presupuesto_vencido":
      let mensajeVencido = `Hola ${clienteNombre}!\n\n`;
      mensajeVencido += `El presupuesto *${presupuesto.numero_presupuesto}* ha vencido.\n\n`;
      mensajeVencido += `Si aun te interesa, podemos:\n`;
      mensajeVencido += `- Renovarlo\n`;
      mensajeVencido += `- Ajustar precios actuales\n`;
      mensajeVencido += `- Modificar lo que necesites\n\n`;
      mensajeVencido += `Seguimos adelante? Escribinos!\n\n`;

      if (company.contact_phone) {
        mensajeVencido += `Contacto: ${company.contact_phone}\n\n`;
      }

      mensajeVencido += `_Tecnologia desarrollada por CamaleonStudio - Agencia de desarrollo de Grafica Corporearte_`;

      return mensajeVencido;

    default:
      return `Actualizacion de presupuesto ${presupuesto.numero_presupuesto}`;
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

    const payload: PresupuestoNotification = await req.json();
    const { presupuesto_id, company_id, tipo_notificacion } = payload;

    console.log('[Notify Presupuesto] Payload recibido:', {
      presupuesto_id,
      company_id,
      tipo_notificacion
    });

    if (!presupuesto_id || !company_id || !tipo_notificacion) {
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
      .eq('presupuesto_id', presupuesto_id)
      .eq('tipo_notificacion', tipo_notificacion)
      .maybeSingle();

    if (yaEnviado) {
      console.log('[Notify Presupuesto] ⚠️ Ya se envió notificación. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Notificación ya enviada previamente' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:cliente_id(*),
        vendedor:vendedor_id(*),
        orden_trabajo:orden_trabajo_id(numero_orden)
      `)
      .eq('id', presupuesto_id)
      .single();

    if (presupuestoError || !presupuesto) {
      throw new Error('No se pudo obtener información del presupuesto');
    }

    const cliente = presupuesto.cliente;

    if (!cliente) {
      throw new Error('No se encontró información del cliente');
    }

    if (!cliente.whatsapp) {
      console.log('[Notify Presupuesto] ⚠️ Cliente no tiene WhatsApp configurado. Skipping.');
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
      console.log('[Notify Presupuesto] ⚠️ WhatsApp no está conectado para esta empresa. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'WhatsApp no está conectado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Notify Presupuesto] ✅ WhatsApp conectado, procediendo a enviar mensaje');

    const mensaje = construirMensaje(presupuesto, tipo_notificacion, company);
    console.log('[Notify Presupuesto] ✅ Mensaje generado, longitud:', mensaje.length);

    const mensajeSanitizado = sanitizeMessage(mensaje);
    const telefonoFormateado = formatPhoneNumber(cliente.whatsapp);

    console.log('[Notify Presupuesto] Enviando mensaje:', {
      numeroPresupuesto: presupuesto.numero_presupuesto,
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
      console.error('[Notify Presupuesto] ❌ Error enviando mensaje:', error);
      estadoEnvio = 'fallido';
      errorMensaje = error.message;
      respuestaBackend = { error: error.message };
    }

    const notificacionData = {
      company_id: company_id,
      presupuesto_id: presupuesto_id,
      tipo_notificacion,
      telefono_destino: telefonoFormateado,
      mensaje_enviado: mensajeSanitizado,
      estado_envio: estadoEnvio,
      respuesta_backend: respuestaBackend,
      error_mensaje: errorMensaje,
    };

    const { error: insertError } = await supabase
      .from('whatsapp_notificaciones')
      .insert(notificacionData);

    if (insertError) {
      console.error('[Notify Presupuesto] ❌ Error guardando notificación:', insertError);
    } else {
      console.log('[Notify Presupuesto] ✅ Notificación registrada en base de datos');
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
    console.error('[Notify Presupuesto] ❌ Error general:', error);
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
