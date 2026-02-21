create or replace view public.assistant_catalog_index as
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'impresion_laser'::text as categoria,
  p.is_active
from public.productos_impresion_laser p
union all
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'talonarios'::text as categoria,
  p.is_active
from public.productos_talonarios p
union all
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'gran_formato'::text as categoria,
  p.is_active
from public.productos_gran_formato p
union all
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'materiales_rigidos'::text as categoria,
  p.is_active
from public.productos_materiales_rigidos p
union all
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'plotter_corte'::text as categoria,
  p.is_active
from public.productos_plotter_corte p
union all
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'portabanners'::text as categoria,
  p.is_active
from public.productos_portabanners p
union all
select
  p.company_id,
  p.id as producto_id,
  p.nombre,
  'sellos'::text as categoria,
  p.is_active
from public.productos_sellos p;
create or replace function public.fn_assistant_quote_candidates(
  p_company_id uuid,
  p_search_term text,
  p_cantidad numeric default null,
  p_limit int default 20
)
returns table (
  producto_id uuid,
  producto_nombre text,
  categoria text,
  cantidad numeric,
  precio_total numeric,
  precio_unitario numeric,
  has_price boolean,
  manual_required boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.profiles
  where id = auth.uid();

  if v_company_id is null or v_company_id <> p_company_id then
    raise exception 'Access denied';
  end if;

  return query
  with q as (
    select lower(trim(coalesce(p_search_term, ''))) as term
  ),
  base as (
    select c.*
    from public.assistant_catalog_index c, q
    where c.company_id = p_company_id
      and c.is_active = true
      and (q.term = '' or lower(c.nombre) like '%' || q.term || '%')
    order by c.nombre asc
    limit greatest(coalesce(p_limit, 20), 1)
  ),
  laser as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      p_cantidad as cantidad,
      lp.precio as precio_total,
      lp.precio as precio_unitario,
      (lp.precio is not null) as has_price,
      (lp.precio is null) as manual_required
    from base b
    left join lateral (
      select lpp.precio
      from public.productos_impresion_laser_precios lpp
      where lpp.company_id = p_company_id
        and lpp.producto_laser_id = b.producto_id
        and (
          (p_cantidad is not null and lpp.cantidad = p_cantidad::int)
          or (
            p_cantidad is not null
            and lpp.cantidad is null
            and lpp.rango_precio_min is not null
            and p_cantidad >= lpp.rango_precio_min
            and (lpp.rango_precio_max is null or p_cantidad <= lpp.rango_precio_max)
          )
          or p_cantidad is null
        )
      order by
        case when p_cantidad is not null and lpp.cantidad = p_cantidad::int then 0 else 1 end,
        lpp.precio asc
      limit 1
    ) lp on true
    where b.categoria = 'impresion_laser'
  ),
  talon as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      p_cantidad as cantidad,
      tp.precio as precio_total,
      tp.precio as precio_unitario,
      (tp.precio is not null) as has_price,
      (tp.precio is null) as manual_required
    from base b
    left join lateral (
      select tpp.precio
      from public.productos_talonarios_precios tpp
      where tpp.company_id = p_company_id
        and tpp.producto_talonario_id = b.producto_id
        and (p_cantidad is null or tpp.cantidad = p_cantidad::int)
      order by tpp.precio asc
      limit 1
    ) tp on true
    where b.categoria = 'talonarios'
  ),
  plotter as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      p_cantidad as cantidad,
      case
        when pp.precio is null then null
        when p_cantidad is null then pp.precio
        else pp.precio * p_cantidad
      end as precio_total,
      pp.precio as precio_unitario,
      (pp.precio is not null) as has_price,
      (pp.precio is null) as manual_required
    from base b
    left join lateral (
      select ppp.precio
      from public.productos_plotter_corte_precios ppp
      where ppp.producto_id = b.producto_id
        and (
          p_cantidad is null
          or (
            p_cantidad >= ppp.cantidad_desde
            and (ppp.cantidad_hasta is null or p_cantidad <= ppp.cantidad_hasta)
          )
        )
      order by ppp.precio asc
      limit 1
    ) pp on true
    where b.categoria = 'plotter_corte'
  ),
  porta as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      p_cantidad as cantidad,
      case
        when pp.precio is null then null
        when p_cantidad is null then pp.precio
        else pp.precio * p_cantidad
      end as precio_total,
      pp.precio as precio_unitario,
      (pp.precio is not null) as has_price,
      (pp.precio is null) as manual_required
    from base b
    left join lateral (
      select ppp.precio
      from public.productos_portabanners_precios ppp
      where ppp.company_id = p_company_id
        and ppp.producto_id = b.producto_id
        and (
          p_cantidad is null
          or (
            p_cantidad >= ppp.cantidad_desde
            and (ppp.cantidad_hasta is null or p_cantidad <= ppp.cantidad_hasta)
          )
        )
      order by ppp.precio asc
      limit 1
    ) pp on true
    where b.categoria = 'portabanners'
  ),
  sell as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      coalesce(p_cantidad, 1) as cantidad,
      case
        when sp.precio_unitario is null then null
        else sp.precio_unitario * coalesce(p_cantidad, 1)
      end as precio_total,
      sp.precio_unitario as precio_unitario,
      (sp.precio_unitario is not null) as has_price,
      (sp.precio_unitario is null) as manual_required
    from base b
    left join lateral (
      select spp.precio_unitario
      from public.productos_sellos_precios spp
      where spp.producto_id = b.producto_id
      order by spp.precio_unitario asc
      limit 1
    ) sp on true
    where b.categoria = 'sellos'
  ),
  gran as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      p_cantidad as cantidad,
      case
        when gp.precio is null then null
        when p_cantidad is null then gp.precio
        else gp.precio * p_cantidad
      end as precio_total,
      gp.precio as precio_unitario,
      (gp.precio is not null) as has_price,
      (gp.precio is null) as manual_required
    from base b
    left join lateral (
      select gpp.precio
      from public.productos_gran_formato_precios gpp
      where gpp.company_id = p_company_id
        and gpp.producto_gran_formato_id = b.producto_id
        and (
          p_cantidad is null
          or (p_cantidad >= gpp.rango_precio_min and p_cantidad <= gpp.rango_precio_max)
        )
      order by gpp.precio asc
      limit 1
    ) gp on true
    where b.categoria = 'gran_formato'
  ),
  rig as (
    select
      b.producto_id,
      b.nombre as producto_nombre,
      b.categoria,
      p_cantidad as cantidad,
      case
        when rp.precio_mt2 is null then null
        when p_cantidad is null then rp.precio_mt2
        else rp.precio_mt2 * p_cantidad
      end as precio_total,
      rp.precio_mt2 as precio_unitario,
      (rp.precio_mt2 is not null) as has_price,
      (rp.precio_mt2 is null) as manual_required
    from base b
    left join lateral (
      select rpp.precio_mt2
      from public.productos_materiales_rigidos_precios rpp
      where rpp.company_id = p_company_id
        and rpp.producto_materiales_rigidos_id = b.producto_id
      order by rpp.precio_mt2 asc
      limit 1
    ) rp on true
    where b.categoria = 'materiales_rigidos'
  )
  select * from laser
  union all
  select * from talon
  union all
  select * from plotter
  union all
  select * from porta
  union all
  select * from sell
  union all
  select * from gran
  union all
  select * from rig
  order by has_price desc, precio_total asc nulls last, producto_nombre asc;
end;
$$;
grant select on public.assistant_catalog_index to authenticated;
grant execute on function public.fn_assistant_quote_candidates(uuid, text, numeric, int) to authenticated;
