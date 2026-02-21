-- Sales Assistant (Gemini) core schema + RPCs

create schema if not exists private;
-- 1) Conversations
create table if not exists public.sales_assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_assistant_conversations_company_user
  on public.sales_assistant_conversations(company_id, user_id, created_at desc);
-- 2) Messages
create table if not exists public.sales_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sales_assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content jsonb not null default '{}'::jsonb,
  token_usage_input int,
  token_usage_output int,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_assistant_messages_conversation
  on public.sales_assistant_messages(conversation_id, created_at);
-- 3) Drafts
create table if not exists public.sales_assistant_drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.sales_assistant_conversations(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  draft_type text not null check (draft_type in ('orden','presupuesto')),
  status text not null default 'draft' check (status in ('draft','confirmed','committed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  validation_errors jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_assistant_drafts_company_status
  on public.sales_assistant_drafts(company_id, status, created_at desc);
-- 4) Knowledge base
create table if not exists public.sales_assistant_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('regla','playbook','objecion','upsell','restriccion')),
  title text not null,
  content text not null,
  priority int not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_assistant_knowledge_entries_company
  on public.sales_assistant_knowledge_entries(company_id, is_active, priority, created_at desc);
-- 5) Provider config (sensitive)
create table if not exists private.sales_assistant_provider_config (
  company_id uuid primary key references public.companies(id) on delete cascade,
  provider text not null default 'gemini' check (provider in ('gemini')),
  model text not null default 'gemini-2.5-flash-lite',
  api_key text,
  enabled boolean not null default false,
  monthly_budget_usd numeric not null default 25,
  max_output_tokens int not null default 1024,
  temperature numeric not null default 0.4,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
-- 6) Usage daily
create table if not exists public.sales_assistant_usage_daily (
  company_id uuid not null references public.companies(id) on delete cascade,
  day date not null,
  requests_count int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric not null default 0,
  primary key (company_id, day)
);
-- RLS
alter table public.sales_assistant_conversations enable row level security;
alter table public.sales_assistant_messages enable row level security;
alter table public.sales_assistant_drafts enable row level security;
alter table public.sales_assistant_knowledge_entries enable row level security;
alter table public.sales_assistant_usage_daily enable row level security;
-- Drop old policies if rerun
 drop policy if exists "sa_conv_select" on public.sales_assistant_conversations;
drop policy if exists "sa_conv_insert" on public.sales_assistant_conversations;
drop policy if exists "sa_conv_update" on public.sales_assistant_conversations;
drop policy if exists "sa_msg_select" on public.sales_assistant_messages;
drop policy if exists "sa_msg_insert" on public.sales_assistant_messages;
drop policy if exists "sa_drafts_select" on public.sales_assistant_drafts;
drop policy if exists "sa_drafts_insert" on public.sales_assistant_drafts;
drop policy if exists "sa_drafts_update" on public.sales_assistant_drafts;
drop policy if exists "sa_knowledge_select" on public.sales_assistant_knowledge_entries;
drop policy if exists "sa_knowledge_insert" on public.sales_assistant_knowledge_entries;
drop policy if exists "sa_knowledge_update" on public.sales_assistant_knowledge_entries;
drop policy if exists "sa_knowledge_delete" on public.sales_assistant_knowledge_entries;
drop policy if exists "sa_usage_select" on public.sales_assistant_usage_daily;
create policy "sa_conv_select"
  on public.sales_assistant_conversations for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_conv_insert"
  on public.sales_assistant_conversations for insert
  to authenticated
  with check (
    user_id = auth.uid() and
    company_id in (select company_id from public.profiles where id = auth.uid())
  );
create policy "sa_conv_update"
  on public.sales_assistant_conversations for update
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()))
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_msg_select"
  on public.sales_assistant_messages for select
  to authenticated
  using (
    conversation_id in (
      select c.id
      from public.sales_assistant_conversations c
      where c.company_id in (select company_id from public.profiles where id = auth.uid())
    )
  );
create policy "sa_msg_insert"
  on public.sales_assistant_messages for insert
  to authenticated
  with check (
    conversation_id in (
      select c.id
      from public.sales_assistant_conversations c
      where c.company_id in (select company_id from public.profiles where id = auth.uid())
    )
  );
create policy "sa_drafts_select"
  on public.sales_assistant_drafts for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_drafts_insert"
  on public.sales_assistant_drafts for insert
  to authenticated
  with check (
    created_by = auth.uid() and
    company_id in (select company_id from public.profiles where id = auth.uid())
  );
create policy "sa_drafts_update"
  on public.sales_assistant_drafts for update
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()))
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_knowledge_select"
  on public.sales_assistant_knowledge_entries for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_knowledge_insert"
  on public.sales_assistant_knowledge_entries for insert
  to authenticated
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_knowledge_update"
  on public.sales_assistant_knowledge_entries for update
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()))
  with check (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_knowledge_delete"
  on public.sales_assistant_knowledge_entries for delete
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
create policy "sa_usage_select"
  on public.sales_assistant_usage_daily for select
  to authenticated
  using (company_id in (select company_id from public.profiles where id = auth.uid()));
-- updated_at trigger helper
create or replace function public.fn_set_updated_at_sales_assistant()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists tr_sa_conversations_updated_at on public.sales_assistant_conversations;
create trigger tr_sa_conversations_updated_at
before update on public.sales_assistant_conversations
for each row execute function public.fn_set_updated_at_sales_assistant();
drop trigger if exists tr_sa_drafts_updated_at on public.sales_assistant_drafts;
create trigger tr_sa_drafts_updated_at
before update on public.sales_assistant_drafts
for each row execute function public.fn_set_updated_at_sales_assistant();
drop trigger if exists tr_sa_knowledge_updated_at on public.sales_assistant_knowledge_entries;
create trigger tr_sa_knowledge_updated_at
before update on public.sales_assistant_knowledge_entries
for each row execute function public.fn_set_updated_at_sales_assistant();
-- Config RPCs
create or replace function public.fn_sales_assistant_get_config(p_company_id uuid)
returns table (
  provider text,
  model text,
  enabled boolean,
  monthly_budget_usd numeric,
  max_output_tokens int,
  temperature numeric,
  has_api_key boolean
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.profiles where id = auth.uid();
  if v_company_id is null or v_company_id <> p_company_id then
    raise exception 'Access denied';
  end if;

  return query
  select
    coalesce(c.provider, 'gemini')::text,
    coalesce(c.model, 'gemini-2.5-flash-lite')::text,
    coalesce(c.enabled, false),
    coalesce(c.monthly_budget_usd, 25),
    coalesce(c.max_output_tokens, 1024),
    coalesce(c.temperature, 0.4),
    c.api_key is not null and length(trim(c.api_key)) > 0
  from private.sales_assistant_provider_config c
  where c.company_id = p_company_id
  union all
  select 'gemini', 'gemini-2.5-flash-lite', false, 25, 1024, 0.4, false
  where not exists (
    select 1 from private.sales_assistant_provider_config c2 where c2.company_id = p_company_id
  );
end;
$$;
create or replace function public.fn_sales_assistant_upsert_config(
  p_company_id uuid,
  p_provider text,
  p_model text,
  p_api_key text,
  p_enabled boolean,
  p_monthly_budget_usd numeric,
  p_max_output_tokens int,
  p_temperature numeric
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.company_id is null or v_profile.company_id <> p_company_id then
    raise exception 'Access denied';
  end if;

  if v_profile.role not in ('super_admin', 'admin') then
    raise exception 'Only admin/super_admin can update assistant configuration';
  end if;

  insert into private.sales_assistant_provider_config (
    company_id, provider, model, api_key, enabled, monthly_budget_usd,
    max_output_tokens, temperature, updated_by, updated_at
  ) values (
    p_company_id,
    coalesce(nullif(trim(p_provider), ''), 'gemini'),
    coalesce(nullif(trim(p_model), ''), 'gemini-2.5-flash-lite'),
    nullif(trim(p_api_key), ''),
    coalesce(p_enabled, false),
    greatest(coalesce(p_monthly_budget_usd, 25), 0),
    greatest(coalesce(p_max_output_tokens, 1024), 128),
    least(greatest(coalesce(p_temperature, 0.4), 0), 2),
    auth.uid(),
    now()
  )
  on conflict (company_id)
  do update set
    provider = excluded.provider,
    model = excluded.model,
    api_key = case when excluded.api_key is not null then excluded.api_key else private.sales_assistant_provider_config.api_key end,
    enabled = excluded.enabled,
    monthly_budget_usd = excluded.monthly_budget_usd,
    max_output_tokens = excluded.max_output_tokens,
    temperature = excluded.temperature,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;
-- Catalog search RPC
create or replace function public.fn_sales_assistant_catalog_search(
  p_company_id uuid,
  p_search_term text,
  p_limit int default 12
)
returns table (
  producto_id uuid,
  nombre text,
  categoria text,
  table_name text
)
language sql
stable
as $$
  with q as (
    select lower(trim(coalesce(p_search_term, ''))) as term
  )
  select * from (
    select p.id as producto_id, p.nombre::text as nombre, 'Impresion Laser'::text as categoria, 'productos_impresion_laser'::text as table_name
    from public.productos_impresion_laser p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')

    union all

    select p.id, p.nombre::text, 'Talonarios'::text, 'productos_talonarios'::text
    from public.productos_talonarios p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')

    union all

    select p.id, p.nombre::text, 'Impresion Gran Formato'::text, 'productos_gran_formato'::text
    from public.productos_gran_formato p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')

    union all

    select p.id, p.nombre::text, 'Materiales Rigidos'::text, 'productos_materiales_rigidos'::text
    from public.productos_materiales_rigidos p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')

    union all

    select p.id, p.nombre::text, 'Plotter de Corte'::text, 'productos_plotter_corte'::text
    from public.productos_plotter_corte p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')

    union all

    select p.id, p.nombre::text, 'Portabanners'::text, 'productos_portabanners'::text
    from public.productos_portabanners p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')

    union all

    select p.id, p.nombre::text, 'Sellos'::text, 'productos_sellos'::text
    from public.productos_sellos p, q
    where p.company_id = p_company_id and p.is_active = true and (q.term = '' or lower(p.nombre) like '%' || q.term || '%')
  ) s
  order by s.nombre asc
  limit greatest(coalesce(p_limit, 12), 1);
$$;
-- Basic deterministic item pricing for compatible catalog products
create or replace function public.fn_sales_assistant_price_item(
  p_company_id uuid,
  p_producto_id uuid,
  p_cantidad numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_precio numeric;
  v_qty numeric;
begin
  select company_id into v_company_id from public.profiles where id = auth.uid();
  if v_company_id is null or v_company_id <> p_company_id then
    return jsonb_build_object('ok', false, 'error', 'Access denied');
  end if;

  v_qty := greatest(coalesce(p_cantidad, 1), 1);

  select pp.precio_venta
    into v_precio
  from public.productos_precios pp
  where pp.company_id = p_company_id
    and pp.producto_id = p_producto_id
    and pp.cantidad = v_qty
  order by pp.updated_at desc nulls last
  limit 1;

  if v_precio is null then
    return jsonb_build_object(
      'ok', false,
      'manual_required', true,
      'reason', 'No se encontró precio determinístico para esa cantidad/configuración'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'manual_required', false,
    'precio_unitario', v_precio,
    'precio_total', v_precio * v_qty,
    'cantidad', v_qty
  );
end;
$$;
-- Draft creation
create or replace function public.fn_sales_assistant_create_draft(
  p_company_id uuid,
  p_conversation_id uuid,
  p_draft_type text,
  p_payload jsonb,
  p_validation_errors jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_id uuid;
begin
  select company_id into v_company_id from public.profiles where id = auth.uid();
  if v_company_id is null or v_company_id <> p_company_id then
    raise exception 'Access denied';
  end if;

  insert into public.sales_assistant_drafts(
    conversation_id, company_id, created_by, draft_type, status, payload, validation_errors
  ) values (
    p_conversation_id,
    p_company_id,
    auth.uid(),
    case when p_draft_type in ('orden','presupuesto') then p_draft_type else 'presupuesto' end,
    'draft',
    coalesce(p_payload, '{}'::jsonb),
    p_validation_errors
  ) returning id into v_id;

  return v_id;
end;
$$;
-- Commit draft to real order/presupuesto
create or replace function public.fn_sales_assistant_commit_draft(
  p_company_id uuid,
  p_draft_id uuid,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_draft public.sales_assistant_drafts%rowtype;
  v_payload jsonb;
  v_cliente_id uuid;
  v_canal text;
  v_notas text;
  v_fecha_entrega timestamptz;
  v_new_id uuid;
  v_item jsonb;
  v_precio_unit numeric;
  v_precio_total numeric;
  v_cantidad numeric;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.company_id is null or v_profile.company_id <> p_company_id then
    raise exception 'Access denied';
  end if;

  if not p_confirm then
    return jsonb_build_object('ok', false, 'error', 'Confirmación requerida');
  end if;

  select * into v_draft
  from public.sales_assistant_drafts
  where id = p_draft_id and company_id = p_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Draft no encontrado');
  end if;

  if v_draft.status = 'committed' then
    return jsonb_build_object('ok', true, 'already_committed', true, 'record_id', (v_draft.payload->>'record_id'));
  end if;

  v_payload := coalesce(v_draft.payload, '{}'::jsonb);
  v_cliente_id := nullif(v_payload->>'cliente_id','')::uuid;
  v_canal := coalesce(nullif(v_payload->>'canal_venta',''), 'Mostrador');
  v_notas := nullif(v_payload->>'notas_internas','');
  v_fecha_entrega := nullif(v_payload->>'fecha_entrega','')::timestamptz;

  if v_cliente_id is null then
    return jsonb_build_object('ok', false, 'error', 'Draft inválido: falta cliente_id');
  end if;

  if v_draft.draft_type = 'presupuesto' then
    insert into public.presupuestos (
      company_id, cliente_id, vendedor_id, canal_venta, estado,
      fecha_validez, notas_internas, subtotal, total_descuentos, total,
      created_by, updated_by
    ) values (
      p_company_id,
      v_cliente_id,
      auth.uid(),
      v_canal,
      'borrador',
      coalesce(v_fecha_entrega::date + interval '7 day', (now() + interval '7 day')::date),
      v_notas,
      coalesce((v_payload->>'subtotal')::numeric, 0),
      0,
      coalesce((v_payload->>'total')::numeric, 0),
      auth.uid(),
      auth.uid()
    ) returning id into v_new_id;

    for v_item in
      select value from jsonb_array_elements(coalesce(v_payload->'items', '[]'::jsonb))
    loop
      v_cantidad := greatest(coalesce((v_item->>'cantidad')::numeric, 1), 1);
      v_precio_unit := coalesce((v_item->>'precio_unitario')::numeric, 0);
      v_precio_total := coalesce((v_item->>'precio_total')::numeric, v_precio_unit * v_cantidad);

      insert into public.presupuestos_items (
        presupuesto_id,
        tipo_item,
        producto_id,
        producto_nombre,
        producto_categoria,
        cantidad,
        configuracion,
        precio_base,
        precio_servicios,
        precio_acabados,
        precio_unitario_final,
        precio_total,
        descripcion
      ) values (
        v_new_id,
        'producto_sistema',
        nullif(v_item->>'producto_id','')::uuid,
        coalesce(v_item->>'producto_nombre', 'Producto'),
        nullif(v_item->>'producto_categoria',''),
        v_cantidad,
        coalesce(v_item->'configuracion', '{}'::jsonb),
        v_precio_unit,
        0,
        0,
        v_precio_unit,
        v_precio_total,
        nullif(v_item->>'descripcion','')
      );
    end loop;

  else
    insert into public.ordenes_trabajo (
      company_id, cliente_id, vendedor_id, canal_venta, estado,
      fecha_creacion, fecha_estimada_entrega, notas_internas,
      subtotal, total_descuentos, total,
      requiere_factura, subtotal_iva, facturada,
      created_by, updated_by, numero_orden
    ) values (
      p_company_id,
      v_cliente_id,
      auth.uid(),
      v_canal,
      'pendiente',
      now(),
      v_fecha_entrega,
      v_notas,
      coalesce((v_payload->>'subtotal')::numeric, 0),
      0,
      coalesce((v_payload->>'total')::numeric, 0),
      false,
      0,
      false,
      auth.uid(),
      auth.uid(),
      ''
    ) returning id into v_new_id;

    for v_item in
      select value from jsonb_array_elements(coalesce(v_payload->'items', '[]'::jsonb))
    loop
      v_cantidad := greatest(coalesce((v_item->>'cantidad')::numeric, 1), 1);
      v_precio_unit := coalesce((v_item->>'precio_unitario')::numeric, 0);
      v_precio_total := coalesce((v_item->>'precio_total')::numeric, v_precio_unit * v_cantidad);

      insert into public.ordenes_trabajo_items (
        orden_id,
        tipo_item,
        producto_id,
        producto_nombre,
        producto_categoria,
        cantidad,
        configuracion,
        precio_base,
        precio_servicios,
        precio_acabados,
        precio_unitario_final,
        precio_total,
        descripcion
      ) values (
        v_new_id,
        coalesce(nullif(v_item->>'tipo_item',''), 'catalogo'),
        nullif(v_item->>'producto_id','')::uuid,
        coalesce(v_item->>'producto_nombre', 'Producto'),
        nullif(v_item->>'producto_categoria',''),
        v_cantidad,
        coalesce(v_item->'configuracion', '{}'::jsonb),
        v_precio_unit,
        0,
        0,
        v_precio_unit,
        v_precio_total,
        nullif(v_item->>'descripcion','')
      );
    end loop;
  end if;

  update public.sales_assistant_drafts
  set
    status = 'committed',
    payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('record_id', v_new_id::text),
    updated_at = now()
  where id = v_draft.id;

  return jsonb_build_object(
    'ok', true,
    'record_id', v_new_id,
    'record_type', v_draft.draft_type,
    'record_url', case when v_draft.draft_type = 'presupuesto'
      then '/app/presupuestos/' || v_new_id::text
      else '/app/orders/' || v_new_id::text
    end
  );
end;
$$;
create or replace function public.fn_sales_assistant_usage_stats(
  p_company_id uuid,
  p_days int default 30
)
returns table (
  requests_count bigint,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost_usd numeric
)
language sql
stable
as $$
  select
    coalesce(sum(u.requests_count), 0)::bigint,
    coalesce(sum(u.input_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint,
    coalesce(sum(u.estimated_cost_usd), 0)::numeric
  from public.sales_assistant_usage_daily u
  where u.company_id = p_company_id
    and u.day >= (current_date - greatest(coalesce(p_days, 30), 1));
$$;
grant execute on function public.fn_sales_assistant_get_config(uuid) to authenticated;
grant execute on function public.fn_sales_assistant_upsert_config(uuid,text,text,text,boolean,numeric,int,numeric) to authenticated;
grant execute on function public.fn_sales_assistant_catalog_search(uuid,text,int) to authenticated;
grant execute on function public.fn_sales_assistant_price_item(uuid,uuid,numeric) to authenticated;
grant execute on function public.fn_sales_assistant_create_draft(uuid,uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.fn_sales_assistant_commit_draft(uuid,uuid,boolean) to authenticated;
grant execute on function public.fn_sales_assistant_usage_stats(uuid,int) to authenticated;
