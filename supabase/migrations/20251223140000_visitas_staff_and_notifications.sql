-- Create table for Visitas Staff (Team)
create table if not exists public.visitas_staff (
    id uuid default gen_random_uuid() primary key,
    company_id uuid references public.companies(id) on delete cascade not null,
    nombre text not null,
    telefono text not null, -- WhatsApp format
    rol text default 'medidor', -- medidor, vendedor, admin
    activo boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for visitas_staff
alter table public.visitas_staff enable row level security;

create policy "Staff visible per company"
    on public.visitas_staff for select
    using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy "Staff editable per company"
    on public.visitas_staff for all
    using (company_id in (select company_id from public.profiles where id = auth.uid()))
    with check (company_id in (select company_id from public.profiles where id = auth.uid()));


-- Add columns to visitas table
alter table public.visitas 
add column if not exists staff_id uuid references public.visitas_staff(id) on delete set null,
add column if not exists notif_cliente_creacion_env boolean default false,
add column if not exists notif_staff_creacion_env boolean default false,
add column if not exists notif_cliente_1h_env boolean default false,
add column if not exists notif_staff_30m_env boolean default false;

-- Add index for staff_id
create index if not exists idx_visitas_staff_id on public.visitas(staff_id);


-- Add visita_id to whatsapp_notificaciones table
-- Checking if table exists first (it should based on codebase usage)
do $$ 
begin
    if exists (select from pg_tables where schemaname = 'public' and tablename = 'whatsapp_notificaciones') then
        alter table public.whatsapp_notificaciones 
        add column if not exists visita_id uuid references public.visitas(id) on delete set null;
        
        create index if not exists idx_whatsapp_notificaciones_visita_id on public.whatsapp_notificaciones(visita_id);
    end if;
end $$;
