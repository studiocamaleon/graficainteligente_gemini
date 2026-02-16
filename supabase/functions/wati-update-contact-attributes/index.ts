import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RequestBody {
  company_id: string;
  phone: string;
}

type SnapshotRow = {
  gi_registrado: string;
  gi_cuenta_corriente: string;
  gi_ultima_orden_numero: string;
  gi_ultima_orden_estado: string;
  gi_ultima_orden_fecha: string;
  gi_ordenes_pendientes: string;
  gi_deuda_total: string;
};

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/[\D]/g, '');
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function stableCustomParamsFromSnapshot(snapshot: SnapshotRow): { name: string; value: string }[] {
  const entries = Object.entries(snapshot).map(([name, value]) => ({
    name,
    value: value == null ? '' : String(value),
  }));

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

async function watiUpdateContactAttributesSingle(args: {
  endpoint: string;
  token: string;
  phone: string;
  customParams: { name: string; value: string }[];
}) {
  const endpoint = args.endpoint.replace(/\/+$/, '');
  const phone = normalizePhone(args.phone);
  const url = `${endpoint}/api/v1/updateContactAttributes/${phone}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: args.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customParams: args.customParams }),
  });

  const raw = await response.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { raw };
  }

  if (!response.ok) {
    const msg = (parsed && typeof parsed === 'object' && 'message' in parsed && parsed.message) || raw || 'Error Wati';
    throw new Error(`Wati ${response.status}: ${String(msg)}`);
  }

  return parsed;
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
    const companyId = body.company_id;
    const phone = normalizePhone(body.phone);

    if (!companyId || !phone) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos (company_id, phone)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Require authenticated user and company match.
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

    if (profile.company_id !== companyId) {
      return new Response(JSON.stringify({ error: 'No autorizado para esta empresa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('wati_api_endpoint, wati_access_token, wati_enabled')
      .eq('id', companyId)
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

    const { data: snap, error: snapError } = await supabaseAdmin.rpc('fn_get_wati_contact_snapshot', {
      p_company_id: companyId,
      p_phone: phone,
    });

    if (snapError) {
      throw new Error(`Snapshot error: ${snapError.message}`);
    }

    const snapshotRow = (Array.isArray(snap) ? snap[0] : snap) as SnapshotRow | undefined;
    if (!snapshotRow) {
      throw new Error('Snapshot vacío');
    }

    const customParams = stableCustomParamsFromSnapshot(snapshotRow);
    const payloadHash = await sha256Hex(JSON.stringify(customParams));

    const result = await watiUpdateContactAttributesSingle({
      endpoint: company.wati_api_endpoint,
      token: company.wati_access_token,
      phone,
      customParams,
    });

    await supabaseAdmin
      .from('wati_contact_attr_state')
      .upsert({
        company_id: companyId,
        phone,
        last_payload_hash: payloadHash,
        last_sent_at: new Date().toISOString(),
      });

    // If there is an outbox row for this contact, mark it as sent.
    await supabaseAdmin
      .from('wati_contact_attr_outbox')
      .update({ status: 'sent', last_error: null })
      .eq('company_id', companyId)
      .eq('phone', phone);

    return new Response(JSON.stringify({ success: true, data: result, snapshot: snapshotRow }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('wati-update-contact-attributes error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err?.message ?? err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
