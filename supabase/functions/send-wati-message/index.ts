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
const ALLOWED_TEMPLATES = new Set(['nueva_orden_v4', 'orden_finalizada_v2', 'orden_finalizada_v3']);

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
      .select('wati_api_endpoint, wati_access_token, wati_enabled')
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

    if (!company.wati_api_endpoint || !company.wati_access_token) {
      throw new Error('Credenciales Wati incompletas');
    }

    const endpoint = company.wati_api_endpoint.replace(/\/+$/, '');
    const token = company.wati_access_token;
    let result;

    const url = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;
    const requestBody = {
      template_name,
      broadcast_name: template_name,
      parameters: normalizedParameters,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const rawResponse = await response.text();
    try {
      result = rawResponse ? JSON.parse(rawResponse) : {};
    } catch {
      result = { raw: rawResponse };
    }

    if (!response.ok) {
      const watiMessage =
        (result && typeof result === 'object' && 'message' in result && result.message) ||
        rawResponse ||
        'Error al enviar plantilla Wati';
      throw new Error(`Wati ${response.status}: ${String(watiMessage)}`);
    }

    const logData = {
      company_id,
      telefono_destino: phone,
      mensaje_enviado: `Template: ${template_name}`,
      tipo_notificacion: metadata?.tipo || 'template',
      estado_envio: 'enviado',
      respuesta_backend: result,
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
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
