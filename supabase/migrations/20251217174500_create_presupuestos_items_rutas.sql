-- Create table presupuestos_items_rutas
create table if not exists public.presupuestos_items_rutas (
    id uuid not null default gen_random_uuid(),
    company_id uuid not null references companies(id),
    presupuesto_item_id uuid not null references presupuestos_items(id) on delete cascade,
    tipo_etapa text not null, -- 'pre_prensa', 'produccion', 'post_prensa', etc
    paso_id uuid references pasos(id), -- puede ser null si es custom
    paso_nombre text not null,
    orden integer not null default 0,
    es_modificado boolean default false,
    origen_plantilla_id uuid,
    comentario_vendedor text,
    
    -- Metadata adicional para reconstruccion fiel
    source_service_id uuid references servicios(id), -- si viene de un servicio
    global_task_id text, -- para agrupar pasos de un mismo servicio masivo
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    constraint presupuestos_items_rutas_pkey primary key (id)
);

-- RLS Policies
alter table public.presupuestos_items_rutas enable row level security;

create policy "Users can view routes of their company budgets"
    on public.presupuestos_items_rutas for select
    using (company_id in (select company_id from profiles where id = auth.uid()));

create policy "Users can insert routes for their company budgets"
    on public.presupuestos_items_rutas for insert
    with check (company_id in (select company_id from profiles where id = auth.uid()));

create policy "Users can update routes of their company budgets"
    on public.presupuestos_items_rutas for update
    using (company_id in (select company_id from profiles where id = auth.uid()));

create policy "Users can delete routes of their company budgets"
    on public.presupuestos_items_rutas for delete
    using (company_id in (select company_id from profiles where id = auth.uid()));

-- Index for performance
create index idx_presupuestos_items_rutas_item_id on public.presupuestos_items_rutas(presupuesto_item_id);
