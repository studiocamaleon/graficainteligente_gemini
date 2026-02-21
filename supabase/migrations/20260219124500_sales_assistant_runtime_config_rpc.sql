create or replace function public.fn_sales_assistant_get_runtime_config(p_company_id uuid)
returns table (
  provider text,
  model text,
  api_key text,
  enabled boolean,
  monthly_budget_usd numeric,
  max_output_tokens int,
  temperature numeric
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
    coalesce(c.api_key, '')::text,
    coalesce(c.enabled, false),
    coalesce(c.monthly_budget_usd, 25),
    coalesce(c.max_output_tokens, 1024),
    coalesce(c.temperature, 0.4)
  from private.sales_assistant_provider_config c
  where c.company_id = p_company_id
  union all
  select
    'gemini'::text,
    'gemini-2.5-flash-lite'::text,
    ''::text,
    false,
    25::numeric,
    1024::int,
    0.4::numeric
  where not exists (
    select 1
    from private.sales_assistant_provider_config c2
    where c2.company_id = p_company_id
  );
end;
$$;
grant execute on function public.fn_sales_assistant_get_runtime_config(uuid) to authenticated;
