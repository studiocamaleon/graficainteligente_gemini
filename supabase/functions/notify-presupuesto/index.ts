import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PresupuestoNotification {
  presupuesto_id: string;
  tipo_notificacion: 'presupuesto_listo' | 'presupuesto_aprobado' | 'presupuesto_vencido';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { presupuesto_id, tipo_notificacion } = await req.json() as PresupuestoNotification;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Obtener datos del presupuesto
    const presupuestoResponse = await fetch(
      `${supabaseUrl}/rest/v1/presupuestos?id=eq.${presupuesto_id}&select=*,cliente:clients(*),vendedor:profiles(*),company:companies(*)`,
      {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    const presupuestos = await presupuestoResponse.json();
    if (!presupuestos || presupuestos.length === 0) {
      throw new Error("Presupuesto no encontrado");
    }

    const presupuesto = presupuestos[0];
    const company = presupuesto.company;
    const cliente = presupuesto.cliente;

    if (!cliente?.whatsapp) {
      console.log("Cliente sin WhatsApp, no se envía notificación");
      return new Response(
        JSON.stringify({ success: false, message: "Cliente sin WhatsApp" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!company?.whatsapp_instance_name || !company?.whatsapp_api_key) {
      console.log("WhatsApp no configurado para esta empresa");
      return new Response(
        JSON.stringify({ success: false, message: "WhatsApp no configurado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Construir mensaje según tipo
    const mensaje = construirMensaje(presupuesto, tipo_notificacion, company);

    // Enviar WhatsApp via Evolution API
    const evolutionUrl = `https://evo.pactto.com/message/sendText/${company.whatsapp_instance_name}`;

    const whatsappResponse = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": company.whatsapp_api_key,
      },
      body: JSON.stringify({
        number: cliente.whatsapp,
        text: mensaje,
      }),
    });

    if (!whatsappResponse.ok) {
      throw new Error(`Error enviando WhatsApp: ${whatsappResponse.statusText}`);
    }

    // Registrar notificación
    await fetch(`${supabaseUrl}/rest/v1/whatsapp_notificaciones`, {
      method: "POST",
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        company_id: company.id,
        presupuesto_id: presupuesto.id,
        tipo_notificacion,
        telefono_destino: cliente.whatsapp,
        mensaje_enviado: mensaje,
        estado: "enviado",
      }),
    });

    return new Response(
      JSON.stringify({ success: true, message: "Notificación enviada" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error en notify-presupuesto:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

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

  const trackingUrl = presupuesto.tracking_token
    ? `${Deno.env.get("FRONTEND_URL") || "https://app.pactto.com"}/tracking/presupuesto/${presupuesto.tracking_token}`
    : null;

  const clienteNombre = presupuesto.cliente?.razon_social || "Cliente";

  switch (tipo) {
    case "presupuesto_listo":
      return `✅ *Tu presupuesto está listo!*

📋 Presupuesto: *${presupuesto.numero_presupuesto}*
💰 Total: *${formatCurrency(presupuesto.total)}*
📅 Válido hasta: ${formatDate(presupuesto.fecha_validez)}

${trackingUrl ? `🔗 Ver online: ${trackingUrl}` : ''}

Desde el link podés aprobar el presupuesto directamente.

¿Dudas? ¡Contactanos!`;

    case "presupuesto_aprobado":
      return `🎉 *Presupuesto aprobado!*

Gracias por tu confirmación. Ya comenzamos a procesar tu orden.

📋 Presupuesto: ${presupuesto.numero_presupuesto}
${presupuesto.orden_trabajo_id ? `🆔 Orden de Trabajo: ${presupuesto.orden_trabajo?.numero_orden || 'En proceso'}` : ''}

Te mantendremos informado del progreso.`;

    case "presupuesto_vencido":
      return `⏰ *Presupuesto vencido*

El presupuesto #${presupuesto.numero_presupuesto} ha vencido.

Si aún te interesa, podemos:
- Renovarlo
- Ajustar precios actuales
- Modificar lo que necesites

¿Seguimos adelante? ¡Escribinos!`;

    default:
      return `📋 Actualización de presupuesto ${presupuesto.numero_presupuesto}`;
  }
}
