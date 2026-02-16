import { createClient } from 'jsr:@supabase/supabase-js@2';

interface WatiParameter {
  name: string;
  value: string;
}

interface RequestBody {
  company_id: string;
  phone: string;
  template_name?: string;
  parameters?: WatiParameter[];
  metadata?: {
    tipo?: string;
    visita_id?: string;
    orden_trabajo_id?: string;
    orden_copiado_id?: string;
  };
}

// Transitional allow-list:
// - App/DB will send orden_finalizada_v3 going forward.
// - Keep orden_finalizada_v2 allowed to avoid failures if any env still sends v2 during rollout.
const ALLOWED_TEMPLATES = new Set([
  'nueva_orden_v4',
  'orden_finalizada_v2',
  'orden_finalizada_v3',
  // Recibo de pago (pendiente de aprobación Meta/Wati durante el rollout)
  'recibo_pago_v1',
]);

function getCorsHeaders(req: Request) {
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigin =
    configuredOrigins.length === 0 || configuredOrigins.includes(requestOrigin)
      ? requestOrigin || '*'
      : configuredOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Trigger-Secret',
  };
}

function normalizePhone(phone: string): string {
  return String(phone).replace(/[^\d]/g, '');
}

function hasTenantPath(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.some((segment) => /^\d+$/.test(segment));
  } catch {
    return false;
  }
}

function isChannelFieldValidationError(status: number, body: any): boolean {
  if (status < 400 || status >= 500) return false;
  const text = JSON.stringify(body ?? {}).toLowerCase();
  return text.includes('channelnumber') || text.includes('channel_number');
}

function normalizeTemplateParameters(parameters: WatiParameter[] = []): WatiParameter[] {
  return parameters.map((param) => {
    if (param.name === 'url_tracking' && typeof param.value === 'string') {
      return {
        ...param,
        value: param.value.replace('/tracking/', '/track/'),
      };
    }
    return param;
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  let errorLogContext: {
    company_id?: string;
    phone?: string;
    template_name?: string;
    metadata?: RequestBody['metadata'];
    request_url?: string;
    request_payload_sin_token?: Record<string, unknown>;
    response_status?: number;
    response_body?: any;
  } = {};

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { company_id, template_name, parameters, metadata } = body;
    const phone = normalizePhone(body.phone);
    const normalizedParameters = normalizeTemplateParameters(parameters);
    errorLogContext = { company_id, phone, template_name, metadata };

    if (!company_id || !phone || !template_name) {
      throw new Error('Faltan parámetros requeridos (company_id, phone y template_name)');
    }

    if (!ALLOWED_TEMPLATES.has(template_name)) {
      throw new Error(`Template no permitido: ${template_name}`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Authorization:
    // 1) Internal caller via trigger secret (DB triggers / backend jobs)
    // 2) Authenticated user (JWT) whose company matches requested company_id
    const triggerSecret = Deno.env.get('TRIGGER_SECRET_TOKEN');
    const providedSecret = req.headers.get('X-Trigger-Secret');
    const isInternalCall = Boolean(triggerSecret && providedSecret && providedSecret === triggerSecret);

    if (!isInternalCall) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      const supabaseAuth = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Token inválido o expirado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile?.company_id) {
        return new Response(JSON.stringify({ error: 'No se pudo validar la empresa del usuario' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      if (profile.company_id !== company_id) {
        return new Response(JSON.stringify({ error: 'No autorizado para esta empresa' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('wati_api_endpoint, wati_access_token, wati_enabled, wati_channel_number')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      throw new Error('Empresa no encontrada o credenciales no configuradas');
    }

    if (!company.wati_enabled) {
      return new Response(JSON.stringify({ success: false, message: 'Integración Wati deshabilitada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!company.wati_api_endpoint || !company.wati_access_token || !company.wati_channel_number) {
      throw new Error('Credenciales Wati incompletas');
    }

    const endpoint = company.wati_api_endpoint.replace(/\/+$/, '');
    const token = company.wati_access_token;
    const channelNumber = normalizePhone(company.wati_channel_number);
    let result: any;
    let responseStatus = 0;
    let responseBody: any = null;

    if (!hasTenantPath(endpoint)) {
      throw new Error('Endpoint de Wati inválido: debe incluir tenant path (ej: /1082879)');
    }

    if (!channelNumber || channelNumber.length < 10 || channelNumber.length > 15) {
      throw new Error('Configuración Wati inválida: wati_channel_number debe tener entre 10 y 15 dígitos');
    }

    const url = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;
    const baseRequestBody = {
      template_name,
      broadcast_name: template_name,
      parameters: normalizedParameters,
      channelNumber,
    };
    errorLogContext.request_url = url;
    errorLogContext.request_payload_sin_token = baseRequestBody;

    const sendAttempt = async (payload: Record<string, unknown>) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { raw };
      }
      return { response, parsed, raw };
    };

    const attempt1 = await sendAttempt(baseRequestBody);
    responseStatus = attempt1.response.status;
    responseBody = attempt1.parsed;
    errorLogContext.response_status = responseStatus;
    errorLogContext.response_body = responseBody;

    if (!attempt1.response.ok && isChannelFieldValidationError(attempt1.response.status, attempt1.parsed)) {
      const fallbackPayload = {
        template_name,
        broadcast_name: template_name,
        parameters: normalizedParameters,
        channel_number: channelNumber,
      };
      const attempt2 = await sendAttempt(fallbackPayload);
      responseStatus = attempt2.response.status;
      responseBody = attempt2.parsed;
      errorLogContext.response_status = responseStatus;
      errorLogContext.response_body = responseBody;

      if (!attempt2.response.ok) {
        const message =
          (attempt2.parsed && typeof attempt2.parsed === 'object' && 'message' in attempt2.parsed && attempt2.parsed.message) ||
          attempt2.raw ||
          'Error al enviar plantilla Wati';
        const fbtraceId =
          (attempt2.parsed && typeof attempt2.parsed === 'object' && attempt2.parsed?.error?.fbtrace_id) ||
          (attempt2.parsed && typeof attempt2.parsed === 'object' && attempt2.parsed?.fbtrace_id) ||
          null;
        throw new Error(`Wati ${attempt2.response.status}: ${String(message)}${fbtraceId ? ` (fbtrace_id: ${fbtraceId})` : ''}`);
      }

      result = attempt2.parsed;
    } else if (!attempt1.response.ok) {
      const message =
        (attempt1.parsed && typeof attempt1.parsed === 'object' && 'message' in attempt1.parsed && attempt1.parsed.message) ||
        attempt1.raw ||
        'Error al enviar plantilla Wati';
      const fbtraceId =
        (attempt1.parsed && typeof attempt1.parsed === 'object' && attempt1.parsed?.error?.fbtrace_id) ||
        (attempt1.parsed && typeof attempt1.parsed === 'object' && attempt1.parsed?.fbtrace_id) ||
        null;
      throw new Error(`Wati ${attempt1.response.status}: ${String(message)}${fbtraceId ? ` (fbtrace_id: ${fbtraceId})` : ''}`);
    } else {
      result = attempt1.parsed;
    }

    const logData = {
      company_id,
      telefono_destino: phone,
      mensaje_enviado: `Template: ${template_name}`,
      tipo_notificacion: metadata?.tipo || 'template',
      estado_envio: 'enviado',
      respuesta_backend: {
        provider_response: result,
        request_url: url,
        request_payload_sin_token: baseRequestBody,
        response_status: responseStatus,
        response_body: responseBody,
        fbtrace_id:
          (responseBody && typeof responseBody === 'object' && responseBody?.error?.fbtrace_id) ||
          (responseBody && typeof responseBody === 'object' && responseBody?.fbtrace_id) ||
          null,
      },
      visita_id: metadata?.visita_id || null,
      orden_trabajo_id: metadata?.orden_trabajo_id || null,
      orden_copiado_id: metadata?.orden_copiado_id || null,
    };

    await supabaseAdmin.from('whatsapp_notificaciones').insert(logData);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('Edge Function Error:', err);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceRoleKey && errorLogContext.company_id && errorLogContext.phone) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        await supabaseAdmin.from('whatsapp_notificaciones').insert({
          company_id: errorLogContext.company_id,
          telefono_destino: errorLogContext.phone,
          mensaje_enviado: `Template: ${errorLogContext.template_name || 'desconocida'}`,
          tipo_notificacion: errorLogContext.metadata?.tipo || 'template',
          estado_envio: 'error',
          respuesta_backend: {
            error_message: err?.message || 'Error interno',
            request_url: errorLogContext.request_url || null,
            request_payload_sin_token: errorLogContext.request_payload_sin_token || null,
            response_status: errorLogContext.response_status || null,
            response_body: errorLogContext.response_body || null,
            fbtrace_id:
              (errorLogContext.response_body &&
                typeof errorLogContext.response_body === 'object' &&
                errorLogContext.response_body?.error?.fbtrace_id) ||
              (errorLogContext.response_body &&
                typeof errorLogContext.response_body === 'object' &&
                errorLogContext.response_body?.fbtrace_id) ||
              null,
          },
          visita_id: errorLogContext.metadata?.visita_id || null,
          orden_trabajo_id: errorLogContext.metadata?.orden_trabajo_id || null,
          orden_copiado_id: errorLogContext.metadata?.orden_copiado_id || null,
        });
      }
    } catch (logErr) {
      console.error('Error logging failed Wati notification:', logErr);
    }
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
