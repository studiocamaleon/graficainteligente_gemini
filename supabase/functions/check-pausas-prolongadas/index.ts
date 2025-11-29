import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('🔍 Detectando pausas prolongadas...');

    // Llamar a la función que detecta pausas prolongadas
    const { data: pausas, error: errorDetectar } = await supabase.rpc(
      'fn_detectar_pausas_prolongadas'
    );

    if (errorDetectar) {
      console.error('❌ Error detectando pausas:', errorDetectar);
      throw errorDetectar;
    }

    console.log(`📊 Pausas detectadas: ${pausas?.length || 0}`);

    if (!pausas || pausas.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay pausas prolongadas pendientes de notificación',
          pausas_detectadas: 0,
          notificaciones_creadas: 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Crear notificaciones para cada pausa detectada
    let notificacionesCreadas = 0;
    const errores: string[] = [];

    for (const pausa of pausas) {
      try {
        console.log(
          `📧 Creando notificación para pausa ${pausa.pausa_id} (${pausa.horas_pausado}h)`
        );

        const { error: errorNotif } = await supabase.rpc(
          'fn_crear_notificacion_pausa_prolongada',
          {
            p_pausa_id: pausa.pausa_id,
          }
        );

        if (errorNotif) {
          console.error(
            `❌ Error creando notificación para pausa ${pausa.pausa_id}:`,
            errorNotif
          );
          errores.push(`Pausa ${pausa.pausa_id}: ${errorNotif.message}`);
        } else {
          notificacionesCreadas++;
          console.log(`✅ Notificación creada para pausa ${pausa.pausa_id}`);
        }
      } catch (err) {
        console.error(`❌ Error procesando pausa ${pausa.pausa_id}:`, err);
        errores.push(`Pausa ${pausa.pausa_id}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      }
    }

    const resultado = {
      success: true,
      message: `Proceso completado: ${notificacionesCreadas} notificaciones creadas`,
      pausas_detectadas: pausas.length,
      notificaciones_creadas: notificacionesCreadas,
      errores: errores.length > 0 ? errores : undefined,
      pausas_detalle: pausas.map((p) => ({
        orden_numero: p.orden_numero,
        paso_nombre: p.paso_nombre,
        motivo: p.motivo,
        horas_pausado: p.horas_pausado,
      })),
    };

    console.log('✅ Proceso completado:', resultado);

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('❌ Error general:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
