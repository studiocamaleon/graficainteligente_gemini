import { createClient } from 'jsr:@supabase/supabase-js@2';

interface RequestBody {
  company_id?: string;
  limit?: number;
}

type OutboxRow = {
  id: string;
  company_id: string;
  client_id: string | null;
  phone: string;
  reason: string | null;
  status: 'pending' | 'processing' | 'sent' | 'error';
  attempt_count: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
};

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Trigger-Secret',
  };
}

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/[\D]/g, '');
}

function computeBackoffMinutes(attemptCountAfterIncrement: number): number {
  // attempt_count starts at 0. After first failure -> 1.
  const schedule = [1, 5, 15, 60];
  if (attemptCountAfterIncrement <= 0) return schedule[0];
  if (attemptCountAfterIncrement <= schedule.length) return schedule[attemptCountAfterIncrement - 1];
  return 60;
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

  const controller = new AbortController();
  const timeoutMs = 12_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: args.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customParams: args.customParams }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

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
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const requestedCompanyId = body.company_id;
    const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 1000));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Authorization:
    // 1) Internal caller via trigger secret: can process global queue or a specific company
    // 2) Authenticated user (JWT): can only process its own company and must provide company_id
    const triggerSecret = Deno.env.get('TRIGGER_SECRET_TOKEN');
    const providedSecret = req.headers.get('X-Trigger-Secret');
    const isInternalCall = Boolean(triggerSecret && providedSecret && providedSecret === triggerSecret);

    let companyScope: string | null = null;

    if (isInternalCall) {
      companyScope = requestedCompanyId ?? null;
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      if (!requestedCompanyId) {
        return new Response(JSON.stringify({ error: 'Falta company_id' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
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

      if (profile.company_id !== requestedCompanyId) {
        return new Response(JSON.stringify({ error: 'No autorizado para esta empresa' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      companyScope = requestedCompanyId;
    }

    // Claim outbox items atomically.
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc('fn_wati_contact_attr_outbox_claim', {
      p_limit: limit,
      p_company_id: companyScope,
    });

    if (claimError) {
      throw new Error(`No se pudo reclamar outbox: ${claimError.message}`);
    }

    const items = (claimed ?? []) as OutboxRow[];

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0, skipped: 0, retried: 0, errors: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    // Preload company Wati configs.
    const companyIds = Array.from(new Set(items.map((i) => i.company_id)));
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('id, wati_api_endpoint, wati_access_token, wati_enabled')
      .in('id', companyIds);

    if (companiesError) {
      throw new Error(`No se pudo cargar configuración Wati: ${companiesError.message}`);
    }

    const companyById = new Map<string, any>();
    for (const c of companies ?? []) companyById.set(c.id, c);

    let sent = 0;
    let skipped = 0;
    let retried = 0;
    let errors = 0;

    // Process with limited concurrency to avoid Edge timeouts.
    const concurrency = isInternalCall ? 10 : 4;
    let idx = 0;

    const processOne = async (item: OutboxRow) => {
      const company = companyById.get(item.company_id);
      const phone = normalizePhone(item.phone);

      try {
        if (!company?.wati_enabled) {
          throw new Error('Integración Wati deshabilitada');
        }
        if (!company?.wati_api_endpoint || !company?.wati_access_token) {
          throw new Error('Credenciales Wati incompletas');
        }

        const { data: snap, error: snapError } = await supabaseAdmin.rpc('fn_get_wati_contact_snapshot', {
          p_company_id: item.company_id,
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

        const { data: stateRow, error: stateErr } = await supabaseAdmin
          .from('wati_contact_attr_state')
          .select('last_payload_hash')
          .eq('company_id', item.company_id)
          .eq('phone', phone)
          .maybeSingle();

        if (stateErr) {
          throw new Error(`No se pudo leer estado: ${stateErr.message}`);
        }

        const lastHash = (stateRow as any)?.last_payload_hash ?? null;
        if (lastHash && lastHash === payloadHash) {
          await supabaseAdmin
            .from('wati_contact_attr_outbox')
            .update({ status: 'sent', last_error: null })
            .eq('id', item.id);

          await supabaseAdmin
            .from('wati_contact_attr_state')
            .upsert({
              company_id: item.company_id,
              phone,
              last_payload_hash: payloadHash,
              last_sent_at: new Date().toISOString(),
            });

          skipped++;
          return;
        }

        await watiUpdateContactAttributesSingle({
          endpoint: company.wati_api_endpoint,
          token: company.wati_access_token,
          phone,
          customParams,
        });

        await supabaseAdmin
          .from('wati_contact_attr_state')
          .upsert({
            company_id: item.company_id,
            phone,
            last_payload_hash: payloadHash,
            last_sent_at: new Date().toISOString(),
          });

        await supabaseAdmin
          .from('wati_contact_attr_outbox')
          .update({ status: 'sent', last_error: null })
          .eq('id', item.id);

        sent++;
      } catch (e: any) {
        const attemptAfter = (item.attempt_count ?? 0) + 1;
        const maxAttempts = 10;
        const errMsg = String(e?.message ?? e ?? 'Error desconocido').slice(0, 1000);

        if (attemptAfter >= maxAttempts) {
          await supabaseAdmin
            .from('wati_contact_attr_outbox')
            .update({
              status: 'error',
              attempt_count: attemptAfter,
              last_error: errMsg,
            })
            .eq('id', item.id);
          errors++;
        } else {
          const minutes = computeBackoffMinutes(attemptAfter);
          const next = new Date(Date.now() + minutes * 60_000).toISOString();
          await supabaseAdmin
            .from('wati_contact_attr_outbox')
            .update({
              status: 'pending',
              attempt_count: attemptAfter,
              last_error: errMsg,
              next_attempt_at: next,
            })
            .eq('id', item.id);
          retried++;
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const current = idx++;
        if (current >= items.length) break;
        await processOne(items[current]);
      }
    });

    await Promise.all(workers);

    return new Response(
      JSON.stringify({ success: true, processed: items.length, sent, skipped, retried, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err: any) {
    console.error('process-wati-contact-attributes error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err?.message ?? err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
