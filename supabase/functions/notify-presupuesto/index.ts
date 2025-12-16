import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sanitizeMessage, formatPhoneNumber } from '../_shared/messageGenerators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, X-Trigger-Secret, Apikey',
};

interface PresupuestoNotification {
  presupuesto_id: string;
  company_id: string;
  tipo_notificacion: 'presupuesto_listo' | 'presupuesto_aprobado' | 'presupuesto_vencido';
  frontend_origin?: string;
}

function generatePresupuestoListoMessage(
  presupuesto: any,
  cliente: any,
  items: any[],
  company: any,
  origin: string,
  totalCalculado: number
): string {
  const trackingUrl = `${origin}/tracking/presupuesto/${presupuesto.tracking_token}`;
  const empresa = company.name || 'Nuestra empresa';

  let mensaje = `¡Hola ${cliente.nombre_fantasia || cliente.razon_social}! 👋\n\n`;
  mensaje += `Tu presupuesto ${presupuesto.numero_presupuesto} ya está listo. 📋\n\n`;

  mensaje += `*Resumen:*\n`;
  mensaje += `Total: $${totalCalculado.toLocaleString('es-UY')}\n`;
  mensaje += `Total c/IVA: $${(totalCalculado * 1.21).toLocaleString('es-UY')}\n`;
  mensaje += `Cantidad de ítems: ${items.length}\n\n`;

  if (presupuesto.fecha_validez) {
    const fechaValidez = new Date(presupuesto.fecha_validez);
    mensaje += `⏰ Válido hasta: ${fechaValidez.toLocaleDateString('es-UY')}\n\n`;
  }

  mensaje += `Podés ver el detalle completo y el estado de tu presupuesto en:\n`;
  mensaje += `${trackingUrl}\n\n`;

  mensaje += `Cualquier consulta, estamos a las órdenes.\n\n`;
  mensaje += `Saludos,\n${empresa}`;

  return mensaje;
}

function generatePresupuestoAprobadoMessage(
  presupuesto: any,
  cliente: any,
  company: any
): string {
  const empresa = company.name || 'Nuestra empresa';

  let mensaje = `¡Gracias ${cliente.nombre_fantasia || cliente.razon_social}! 🎉\n\n`;
  mensaje += `Confirmamos la aprobación del presupuesto ${presupuesto.numero_presupuesto}.\n\n`;
  mensaje += `En breve comenzaremos con la producción. Te mantendremos informado del progreso.\n\n`;
  mensaje += `Saludos,\n${empresa}`;

  return mensaje;
}

function generatePresupuestoVencidoMessage(
  presupuesto: any,
  cliente: any,
  company: any,
  origin: string
): string {
  const trackingUrl = `${origin}/tracking/presupuesto/${presupuesto.tracking_token}`;
  const empresa = company.name || 'Nuestra empresa';

  let mensaje = `Hola ${cliente.nombre_fantasia || cliente.razon_social},\n\n`;
  mensaje += `Te recordamos que el presupuesto ${presupuesto.numero_presupuesto} está próximo a vencer.\n\n`;
  mensaje += `Si aún te interesa, podemos renovarlo. Consultanos sin compromiso.\n\n`;
  mensaje += `Ver presupuesto: ${trackingUrl}\n\n`;
  mensaje += `Saludos,\n${empresa}`;

  return mensaje;
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
    const payload: PresupuestoNotification = await req.json();

    const triggerSecret = Deno.env.get('TRIGGER_SECRET_TOKEN');
    const providedSecret = req.headers.get('X-Trigger-Secret');
    const authHeader = req.headers.get('Authorization');

    const isTriggerCall = providedSecret && triggerSecret && providedSecret === triggerSecret;
    const isFrontendCall = authHeader && authHeader.startsWith('Bearer ');

    if (!isTriggerCall && !isFrontendCall) {
      console.error('[Security] Intento de acceso no autorizado');
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[Notify Presupuesto] Llamada desde:', isTriggerCall ? 'Trigger SQL' : 'Frontend');
    const { presupuesto_id, company_id, tipo_notificacion, frontend_origin } = payload;

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
      console.log('[Notify Presupuesto] Ya se envió notificación. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Ya se envió previamente' }),
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
        cliente:clients!cliente_id(
          id,
          razon_social,
          nombre_fantasia,
          whatsapp
        )
      `)
      .eq('id', presupuesto_id)
      .single();

    if (presupuestoError || !presupuesto) {
      console.error('[Notify Presupuesto] Error obteniendo presupuesto:', presupuestoError);
      return new Response(
        JSON.stringify({ error: 'Presupuesto no encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: company } = await supabase
      .from('companies')
      .select('name, whatsapp_notifications_enabled')
      .eq('id', company_id)
      .single();

    if (!company?.whatsapp_notifications_enabled) {
      console.log('[Notify Presupuesto] WhatsApp deshabilitado para esta empresa');
      return new Response(
        JSON.stringify({ success: false, message: 'WhatsApp no configurado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const clienteWhatsapp = formatPhoneNumber(presupuesto.cliente?.whatsapp);
    if (!clienteWhatsapp) {
      console.log('[Notify Presupuesto] Cliente sin WhatsApp');
      return new Response(
        JSON.stringify({ success: false, message: 'Cliente sin WhatsApp' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const origin = frontend_origin || Deno.env.get("FRONTEND_URL") || "https://www.grafica.ar";
    let mensaje = '';

    if (tipo_notificacion === 'presupuesto_listo') {
      const { data: items } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', presupuesto_id);

      const itemsList = items || [];
      const totalCalculado = itemsList.reduce((sum: number, item: any) => sum + (Number(item.precio_total) || 0), 0);

      mensaje = generatePresupuestoListoMessage(
        presupuesto,
        presupuesto.cliente,
        itemsList,
        company,
        origin,
        totalCalculado
      );
    } else if (tipo_notificacion === 'presupuesto_aprobado') {
      mensaje = generatePresupuestoAprobadoMessage(
        presupuesto,
        presupuesto.cliente,
        company
      );
    } else if (tipo_notificacion === 'presupuesto_vencido') {
      mensaje = generatePresupuestoVencidoMessage(
        presupuesto,
        presupuesto.cliente,
        company,
        origin
      );
    }

    const mensajeSanitizado = sanitizeMessage(mensaje);

    console.log('[Notify Presupuesto] Enviando mensaje a:', clienteWhatsapp);

    const WHATSAPP_BACKEND_URL = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

    const whatsappResponse = await fetch(`${WHATSAPP_BACKEND_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company_id,
        to: clienteWhatsapp,
        message: mensajeSanitizado,
      }),
    });

    const whatsappResult = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('[Notify Presupuesto] Error enviando WhatsApp:', whatsappResult);
      throw new Error(`Error de WhatsApp: ${whatsappResult.error || 'Desconocido'}`);
    }

    await supabase.from('whatsapp_notificaciones').insert({
      company_id,
      presupuesto_id,
      tipo_notificacion,
      telefono_destino: clienteWhatsapp,
      mensaje_enviado: mensajeSanitizado,
      estado_envio: 'enviado',
    });

    console.log('[Notify Presupuesto] Notificación enviada exitosamente');

    return new Response(
      JSON.stringify({ success: true, message: 'Notificación enviada' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[Notify Presupuesto] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});