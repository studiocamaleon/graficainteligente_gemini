import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WHATSAPP_BACKEND_URL = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

// Configuración de rate limiting: 10 intentos por hora
const MAX_INTENTOS_POR_HORA = 10;
const TIEMPO_BLOQUEO_MINUTOS = 60;

interface ClienteRegistroData {
  company_id: string;
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  whatsapp: string;
  email?: string;
  domicilio?: string;
  frontend_origin?: string;
}

function formatPhoneNumber(phone: string): string {
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

function validarEmail(email: string): boolean {
  if (!email) return true; // Email es opcional
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarWhatsApp(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Debe tener al menos 10 dígitos
  return cleaned.length >= 10 && /^[0-9+]+$/.test(cleaned);
}

function validarDocumento(tipo: string, numero: string): { valido: boolean; error?: string } {
  const cleaned = numero.replace(/[\s\-]/g, '');
  
  switch (tipo) {
    case 'DNI':
      if (!/^[0-9]{7,8}$/.test(cleaned)) {
        return { valido: false, error: 'DNI debe tener 7 u 8 dígitos' };
      }
      break;
    case 'CUIT':
    case 'CUIL':
      if (!/^[0-9]{11}$/.test(cleaned)) {
        return { valido: false, error: `${tipo} debe tener 11 dígitos` };
      }
      break;
    default:
      return { valido: false, error: 'Tipo de documento inválido' };
  }
  
  return { valido: true };
}

async function verificarRateLimit(
  supabase: any,
  ipAddress: string,
  companyId: string
): Promise<{ permitido: boolean; mensaje?: string }> {
  try {
    // Buscar intentos existentes
    const { data: intento, error } = await supabase
      .from('cliente_registro_intentos')
      .select('*')
      .eq('ip_address', ipAddress)
      .eq('company_id', companyId)
      .single();

    const ahora = new Date();

    if (error && error.code !== 'PGRST116') {
      console.error('[Rate Limit] Error consultando intentos:', error);
      return { permitido: true }; // En caso de error, permitir
    }

    // Si no existe registro, crear uno
    if (!intento) {
      await supabase
        .from('cliente_registro_intentos')
        .insert({
          ip_address: ipAddress,
          company_id: companyId,
          intentos: 1,
          ultima_fecha: ahora.toISOString(),
        });
      return { permitido: true };
    }

    // Verificar si está bloqueado
    if (intento.bloqueado_hasta) {
      const bloqueadoHasta = new Date(intento.bloqueado_hasta);
      if (ahora < bloqueadoHasta) {
        const minutosRestantes = Math.ceil((bloqueadoHasta.getTime() - ahora.getTime()) / 60000);
        return {
          permitido: false,
          mensaje: `Demasiados intentos. Intente nuevamente en ${minutosRestantes} minutos.`,
        };
      }
    }

    // Verificar si han pasado más de 1 hora desde el último intento
    const ultimaFecha = new Date(intento.ultima_fecha);
    const diferenciaHoras = (ahora.getTime() - ultimaFecha.getTime()) / (1000 * 60 * 60);

    if (diferenciaHoras >= 1) {
      // Reset de contador
      await supabase
        .from('cliente_registro_intentos')
        .update({
          intentos: 1,
          ultima_fecha: ahora.toISOString(),
          bloqueado_hasta: null,
        })
        .eq('ip_address', ipAddress)
        .eq('company_id', companyId);
      return { permitido: true };
    }

    // Incrementar contador
    const nuevosIntentos = intento.intentos + 1;

    if (nuevosIntentos > MAX_INTENTOS_POR_HORA) {
      // Bloquear
      const bloqueadoHasta = new Date(ahora.getTime() + TIEMPO_BLOQUEO_MINUTOS * 60000);
      await supabase
        .from('cliente_registro_intentos')
        .update({
          intentos: nuevosIntentos,
          ultima_fecha: ahora.toISOString(),
          bloqueado_hasta: bloqueadoHasta.toISOString(),
        })
        .eq('ip_address', ipAddress)
        .eq('company_id', companyId);
      
      return {
        permitido: false,
        mensaje: `Ha superado el límite de ${MAX_INTENTOS_POR_HORA} intentos por hora. Intente nuevamente en ${TIEMPO_BLOQUEO_MINUTOS} minutos.`,
      };
    }

    // Actualizar contador
    await supabase
      .from('cliente_registro_intentos')
      .update({
        intentos: nuevosIntentos,
        ultima_fecha: ahora.toISOString(),
      })
      .eq('ip_address', ipAddress)
      .eq('company_id', companyId);

    return { permitido: true };
  } catch (error) {
    console.error('[Rate Limit] Error:', error);
    return { permitido: true }; // En caso de error, permitir
  }
}

async function verificarDuplicado(
  supabase: any,
  companyId: string,
  numeroDocumento: string
): Promise<{ duplicado: boolean; clienteExistente?: any }> {
  try {
    const { data: cliente, error } = await supabase
      .from('clients')
      .select('id, nombre_fantasia, status_aprobacion')
      .eq('company_id', companyId)
      .eq('numero_documento', numeroDocumento)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Duplicado] Error verificando:', error);
      return { duplicado: false };
    }

    if (cliente) {
      return { duplicado: true, clienteExistente: cliente };
    }

    return { duplicado: false };
  } catch (error) {
    console.error('[Duplicado] Error:', error);
    return { duplicado: false };
  }
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
): Promise<boolean> {
  try {
    const response = await fetch(`${WHATSAPP_BACKEND_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, to: telefono, message: mensaje }),
    });

    if (!response.ok) {
      console.error('[WhatsApp] Error enviando mensaje:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WhatsApp] Error:', error);
    return false;
  }
}

function generarMensajeConfirmacion(nombreCliente: string, companyName: string): string {
  return `Hola ${nombreCliente}!

Gracias por registrarte en *${companyName}*.

Tu solicitud de registro ha sido recibida y está siendo revisada por nuestro equipo.

En breve recibirás una confirmación cuando tu cuenta sea aprobada.

¡Gracias por tu paciencia!`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener IP del cliente
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    const body: ClienteRegistroData = await req.json();

    // Validaciones básicas
    if (!body.company_id || !body.nombre_fantasia || !body.razon_social || 
        !body.tipo_documento || !body.numero_documento || !body.whatsapp) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Todos los campos obligatorios deben ser completados' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar tipo de documento
    if (!['DNI', 'CUIT', 'CUIL'].includes(body.tipo_documento)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tipo de documento inválido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar documento
    const validacionDoc = validarDocumento(body.tipo_documento, body.numero_documento);
    if (!validacionDoc.valido) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: validacionDoc.error 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar WhatsApp
    if (!validarWhatsApp(body.whatsapp)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Número de WhatsApp inválido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar email (si se proporciona)
    if (body.email && !validarEmail(body.email)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email inválido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar rate limiting
    const rateLimit = await verificarRateLimit(supabaseAdmin, ipAddress, body.company_id);
    if (!rateLimit.permitido) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rateLimit.mensaje 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar duplicados
    const { duplicado, clienteExistente } = await verificarDuplicado(
      supabaseAdmin,
      body.company_id,
      body.numero_documento
    );

    if (duplicado) {
      let mensaje = 'Ya existe un cliente registrado con este documento.';
      
      if (clienteExistente.status_aprobacion === 'pending') {
        mensaje = 'Tu solicitud de registro ya está siendo procesada. Por favor espera la confirmación.';
      } else if (clienteExistente.status_aprobacion === 'rejected') {
        mensaje = 'Tu solicitud de registro fue rechazada. Por favor contacta con la empresa para más información.';
      } else if (clienteExistente.status_aprobacion === 'approved') {
        mensaje = 'Ya tienes una cuenta activa con este documento.';
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: mensaje 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener datos de la empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('name, whatsapp_notifications_enabled')
      .eq('id', body.company_id)
      .single();

    if (companyError) {
      console.error('[Company] Error consultando empresa:', companyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error al verificar la empresa. Por favor intente nuevamente.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!company) {
      console.error('[Company] Empresa no encontrada:', body.company_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Empresa no encontrada'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatear WhatsApp
    const whatsappFormateado = formatPhoneNumber(body.whatsapp);

    // Limpiar número de documento
    const documentoLimpio = body.numero_documento.replace(/[\s\-]/g, '');

    // Crear cliente con status 'pending'
    const { data: nuevoCliente, error: createError } = await supabaseAdmin
      .from('clients')
      .insert({
        company_id: body.company_id,
        nombre_fantasia: body.nombre_fantasia.trim(),
        razon_social: body.razon_social.trim(),
        tipo_documento: body.tipo_documento,
        numero_documento: documentoLimpio,
        whatsapp: whatsappFormateado,
        email: body.email?.trim() || null,
        domicilio: body.domicilio?.trim() || null,
        status_aprobacion: 'pending',
        is_active: false,
        tiene_cuenta_corriente: false,
        fecha_registro: new Date().toISOString(),
        ip_registro: ipAddress,
      })
      .select()
      .single();

    if (createError) {
      console.error('[Cliente] Error creando:', createError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al registrar el cliente. Por favor intente nuevamente.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Intentar enviar WhatsApp de confirmación al cliente
    let whatsappEnviado = false;
    let mensajeWhatsApp = '';

    if (company.whatsapp_notifications_enabled) {
      const whatsappDisponible = await verificarWhatsAppDisponible(body.company_id);

      if (whatsappDisponible) {
        mensajeWhatsApp = generarMensajeConfirmacion(
          body.nombre_fantasia,
          company.name
        );

        whatsappEnviado = await enviarMensajeWhatsApp(
          body.company_id,
          whatsappFormateado,
          mensajeWhatsApp
        );

        // Registrar la notificación en la base de datos
        console.log('[Notificación] Intentando registrar...', {
          company_id: body.company_id,
          cliente_id: nuevoCliente.id,
          tipo_notificacion: 'auto_registro_cliente',
          telefono_destino: whatsappFormateado,
          estado_envio: whatsappEnviado ? 'enviado' : 'fallido'
        });

        try {
          const { data: notifData, error: notifError } = await supabaseAdmin
            .from('whatsapp_notificaciones')
            .insert({
              company_id: body.company_id,
              cliente_id: nuevoCliente.id,
              tipo_notificacion: 'auto_registro_cliente',
              telefono_destino: whatsappFormateado,
              mensaje_enviado: mensajeWhatsApp,
              estado_envio: whatsappEnviado ? 'enviado' : 'fallido',
              error_mensaje: whatsappEnviado ? null : 'No se pudo enviar el mensaje',
            })
            .select();

          if (notifError) {
            console.error('[Notificación] ❌ Error registrando:', notifError);
          } else {
            console.log('[Notificación] ✅ Registrada exitosamente:', notifData);
          }
        } catch (notifError) {
          console.error('[Notificación] ❌ Excepción registrando:', notifError);
          // No fallar la operación completa si falla el registro de la notificación
        }
      } else {
        console.log('[WhatsApp] Backend no disponible para company:', body.company_id);

        // Registrar intento fallido
        try {
          mensajeWhatsApp = generarMensajeConfirmacion(
            body.nombre_fantasia,
            company.name
          );

          console.log('[Notificación] Registrando fallido por backend no disponible...');

          const { data: notifData, error: notifError } = await supabaseAdmin
            .from('whatsapp_notificaciones')
            .insert({
              company_id: body.company_id,
              cliente_id: nuevoCliente.id,
              tipo_notificacion: 'auto_registro_cliente',
              telefono_destino: whatsappFormateado,
              mensaje_enviado: mensajeWhatsApp,
              estado_envio: 'fallido',
              error_mensaje: 'Backend de WhatsApp no disponible',
            })
            .select();

          if (notifError) {
            console.error('[Notificación] ❌ Error registrando fallido:', notifError);
          } else {
            console.log('[Notificación] ✅ Fallido registrado exitosamente:', notifData);
          }
        } catch (notifError) {
          console.error('[Notificación] ❌ Excepción registrando fallido:', notifError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registro exitoso. Tu solicitud está siendo revisada.',
        cliente_id: nuevoCliente.id,
        whatsapp_enviado: whatsappEnviado,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Error General]:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error interno del servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});