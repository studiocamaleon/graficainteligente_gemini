import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateNuevaOrdenTrabajoMessage,
  generateNuevaOrdenCopiadoMessage,
  generateOrdenFinalizadaMessage,
  sanitizeMessage,
  formatPhoneNumber
} from '../_shared/messageGenerators.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WHATSAPP_BACKEND_URL = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

interface RequestBody {
  orden_id: string;
  company_id: string;
  tipo: 'nueva_orden_trabajo' | 'nueva_orden_copiado' | 'orden_finalizada';
  orden_tipo: 'trabajo' | 'copiado';
  frontend_origin?: string;
}

async function verificarWhatsAppDisponible(companyId: string): Promise<boolean> {
  try {
    const response = await fetch(`${WHATSAPP_BACKEND_URL}/status/${companyId}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.connected === true;
  } catch (error) {
    console.error('[WhatsApp] Error verificando estado:', error);
    return false;
  }
}

async function enviarMensajeWhatsApp(
  companyId: string,
  telefono: string,
  mensaje: string
): Promise<any> {
  const response = await fetch(`${WHATSAPP_BACKEND_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, to: telefono, message: mensaje }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || response.statusText);
  }

  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // VALIDACIÓN DE SEGURIDAD
  const triggerSecret = Deno.env.get('TRIGGER_SECRET_TOKEN');
  const providedSecret = req.headers.get('X-Trigger-Secret');

  // Solo validar si la variable de entorno está configurada (para no romper dev local si no se usa)
  // Pero en producción debería estar seteadas.
  if (triggerSecret && providedSecret !== triggerSecret) {
    console.error('[Security] Intento de acceso no autorizado (Secret mismatch)');
    return new Response(
      JSON.stringify({ error: 'No autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { orden_id, company_id, tipo, orden_tipo, frontend_origin } = body;

    console.log('[Notificación] Procesando:', { orden_id, company_id, tipo, orden_tipo });

    const whatsappDisponible = await verificarWhatsAppDisponible(company_id);
    if (!whatsappDisponible) {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp no está conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let orden: any;
    let items: any[] = [];
    let cliente: any;
    let company: any;
    let mensaje: string = '';

    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !companyData) {
      throw new Error('No se pudo obtener información de la empresa');
    }
    company = companyData;

    if (orden_tipo === 'trabajo') {
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
        .eq('id', orden_id)
        .single();

      if (ordenError || !ordenData) {
        throw new Error('No se pudo obtener información de la orden');
      }

      orden = ordenData;
      items = ordenData.items || [];

      // Fetch servicios globales separately to avoid 500 errors with embeddings
      const { data: serviciosData } = await supabase
        .from('ordenes_trabajo_servicios')
        .select('descripcion, cantidad, subtotal')
        .eq('orden_id', orden_id);

      const serviciosGlobales = serviciosData || [];

      const { data: clienteData, error: clienteError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', orden.cliente_id)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo obtener información del cliente');
      }
      cliente = clienteData;

      if (!cliente.whatsapp) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cliente sin WhatsApp configurado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pagosTotal = (ordenData.pagos || []).reduce((sum: number, p: any) => sum + parseFloat(p.monto || 0), 0);
      orden.pagos_totales = pagosTotal;

      if (tipo === 'nueva_orden_trabajo') {
        let ordenesCopiado = ordenData.ordenesCopiado || [];
        if (!Array.isArray(ordenesCopiado)) {
          ordenesCopiado = ordenesCopiado ? [ordenesCopiado] : [];
        }

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

        const origin = frontend_origin || Deno.env.get('FRONTEND_URL') || 'https://www.grafica.ar';

        console.log('[Generador] Iniciando generación de mensaje con:', {
          orden_id: orden.id,
          items_count: items.length,
          servicios_globales_count: serviciosGlobales.length,
          origin
        });

        try {
          mensaje = generateNuevaOrdenTrabajoMessage(orden, cliente, items, company, ordenesCopiado, origin, serviciosGlobales);
        } catch (genError: any) {
          console.error('[Generador] Error FATAL generando mensaje:', genError);
          throw new Error(`Error generando mensaje: ${genError.message}`);
        }
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
        .eq('id', orden_id)
        .single();

      if (ordenError || !ordenData) {
        throw new Error('No se pudo obtener información de la orden');
      }

      orden = ordenData;
      items = ordenData.items || [];

      const { data: clienteData, error: clienteError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', orden.cliente_id)
        .single();

      if (clienteError || !clienteData) {
        throw new Error('No se pudo obtener información del cliente');
      }
      cliente = clienteData;

      if (!cliente.whatsapp) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cliente sin WhatsApp configurado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pagosTotal = (ordenData.pagos || []).reduce((sum: number, p: any) => sum + parseFloat(p.monto || 0), 0);
      orden.pagos_totales = pagosTotal;

      if (tipo === 'nueva_orden_copiado') {
        const { data: archivos } = await supabase
          .from('centro_copiado_ordenes_archivos')
          .select('nombre_archivo, item_generado_id')
          .eq('orden_copiado_id', orden_id);

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
      throw new Error('No se pudo generar el mensaje');
    }

    const mensajeSanitizado = sanitizeMessage(mensaje);
    const telefonoFormateado = formatPhoneNumber(cliente.whatsapp);

    console.log('[WhatsApp] Enviando mensaje:', {
      tipo,
      telefono: telefonoFormateado,
      longitudMensaje: mensajeSanitizado.length
    });

    const respuesta = await enviarMensajeWhatsApp(company_id, telefonoFormateado, mensajeSanitizado);

    const notificacionData: any = {
      company_id: company_id,
      tipo_notificacion: tipo,
      telefono_destino: telefonoFormateado,
      mensaje_enviado: mensajeSanitizado,
      estado_envio: 'enviado',
      respuesta_backend: respuesta
    };

    if (orden_tipo === 'trabajo') {
      notificacionData.orden_trabajo_id = orden_id;
    } else {
      notificacionData.orden_copiado_id = orden_id;
    }

    const { data: notificacion, error: notifError } = await supabase
      .from('whatsapp_notificaciones')
      .insert(notificacionData)
      .select()
      .single();

    if (notifError) {
      console.error('[Notificación] Error al registrar:', notifError);
    }

    console.log('[Notificación] Enviada exitosamente:', notificacion?.id);

    return new Response(
      JSON.stringify({ success: true, notificacionId: notificacion?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Notificación] Error:', error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});