import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotifyRequest {
  cliente_id: string;
  motivo?: string;
  whatsapp_backend_url?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { cliente_id, motivo, whatsapp_backend_url } = await req.json() as NotifyRequest;

    if (!cliente_id) {
      return new Response(
        JSON.stringify({ error: 'cliente_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const clienteResponse = await fetch(`${supabaseUrl}/rest/v1/clients?id=eq.${cliente_id}&select=nombre_fantasia,whatsapp,company_id,companies(name,whatsapp_notifications_enabled)`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!clienteResponse.ok) {
      throw new Error('Error al obtener datos del cliente');
    }

    const clientes = await clienteResponse.json();
    if (!clientes || clientes.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const cliente = clientes[0];
    const company = cliente.companies;

    if (!company?.whatsapp_notifications_enabled) {
      console.log('WhatsApp no habilitado para esta empresa');
      return new Response(
        JSON.stringify({ success: true, whatsapp_enviado: false, message: 'WhatsApp no habilitado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whatsappPhone = cliente.whatsapp.replace(/\D/g, '');

    let mensaje = `Hola ${cliente.nombre_fantasia}.

Lamentamos informarte que tu solicitud de registro en ${company.name} no ha sido aprobada.`;

    if (motivo) {
      mensaje += `\n\nMotivo: ${motivo}`;
    }

    mensaje += `\n\nSi creés que esto es un error o tenés alguna consulta, por favor contactanos.\n\nGracias por tu comprensión.`;

    const backendUrl = whatsapp_backend_url || Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

    if (backendUrl) {
      try {
        const whatsappResponse = await fetch(`${backendUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: cliente.company_id,
            to: whatsappPhone,
            message: mensaje,
          }),
        });

        if (!whatsappResponse.ok) {
          console.error('Error al enviar WhatsApp:', await whatsappResponse.text());
        }
      } catch (error) {
        console.error('Error conectando con backend WhatsApp:', error);
      }
    }

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/whatsapp_notificaciones`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        company_id: cliente.company_id,
        tipo: 'cliente_rechazado',
        destinatario: whatsappPhone,
        mensaje: mensaje,
        estado: 'enviado',
      }),
    });

    if (!insertResponse.ok) {
      console.error('Error registrando notificación:', await insertResponse.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        whatsapp_enviado: true,
        message: 'Cliente notificado exitosamente',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en notify-cliente-rechazado:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al notificar cliente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});