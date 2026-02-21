-- BI v2 validation kit
-- Ejecutar manualmente en entorno de desarrollo con company_id real.
-- Objetivo: validar consistencia de métricas y detectar drift contra v1.
\if :{?company_id}
\else
\set company_id '00000000-0000-0000-0000-000000000000'
\endif

-- 1) Smoke tests de funciones v2
-- Reemplazar valor en \set company_id por UUID real antes de ejecutar.
select * from fn_bi_kpis_executive_v2(:'company_id'::uuid, current_date - 30, current_date);
select * from fn_bi_ventas_timeline_v2(:'company_id'::uuid, current_date - 30, current_date, 'dia');
select * from fn_bi_ventas_canal_v2(:'company_id'::uuid, current_date - 30, current_date);
select * from fn_bi_ventas_categoria_v2(:'company_id'::uuid, current_date - 30, current_date);
select * from fn_bi_top_productos_v2(:'company_id'::uuid, current_date - 30, current_date, 10);
select * from fn_bi_heatmap_horario_v2(:'company_id'::uuid, current_date - 30, current_date);
select * from fn_bi_caja_resumen_v2(:'company_id'::uuid, current_date - 30, current_date);
select * from fn_bi_clientes_kpis_v2(:'company_id'::uuid, current_date - 30, current_date);
select * from fn_bi_operacion_kpis_v2(:'company_id'::uuid, current_date - 30, current_date);

-- 2) Check: no doble conteo OC vinculadas en ventas v2
with ventas_v2 as (
  select sum(total_ventas) as total from fn_bi_ventas_timeline_v2(:'company_id'::uuid, current_date - 30, current_date, 'dia')
),
ventas_manual as (
  select
    coalesce((
      select sum(ot.total)
      from ordenes_trabajo ot
      where ot.company_id = :'company_id'::uuid
        and ot.estado not in ('cancelada','cancelado','borrador')
        and ((ot.fecha_creacion at time zone 'America/Argentina/Buenos_Aires')::date between current_date - 30 and current_date)
    ),0)
    +
    coalesce((
      select sum(cc.total)
      from centro_copiado_ordenes cc
      where cc.company_id = :'company_id'::uuid
        and cc.estado <> 'cancelada'
        and cc.orden_trabajo_id is null
        and ((cc.fecha_solicitud at time zone 'America/Argentina/Buenos_Aires')::date between current_date - 30 and current_date)
    ),0) as total
)
select
  v2.total as total_v2,
  m.total as total_manual,
  (v2.total - m.total) as drift_abs
from ventas_v2 v2
cross join ventas_manual m;

-- 3) Check: categoría contabiliza órdenes únicas (sanity)
select
  sum(total_ordenes) as ordenes_categoria_sum,
  count(*) as categorias_count
from fn_bi_ventas_categoria_v2(:'company_id'::uuid, current_date - 30, current_date);

-- 4) Check: caja separada de comercial
select
  k.revenue_total as ventas_comerciales,
  c.cobrado_periodo as cobros_caja
from fn_bi_kpis_executive_v2(:'company_id'::uuid, current_date - 30, current_date) k
cross join fn_bi_caja_resumen_v2(:'company_id'::uuid, current_date - 30, current_date) c;

-- 5) Performance sample (ajustar rango según datos)
explain analyze
select * from fn_bi_ventas_timeline_v2(:'company_id'::uuid, current_date - 90, current_date, 'dia');

explain analyze
select * from fn_bi_caja_resumen_v2(:'company_id'::uuid, current_date - 365, current_date);
