-- Create table for Ploteo CAD prices
create table if not exists public.centro_copiado_ploteo_cad_precios (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) not null,
  tipo_papel text not null, -- 'Bond 90g', 'Vegetal', etc.
  ancho_cm integer not null check (ancho_cm in (60, 90)),
  precio_metro_lineal decimal(10,2) not null default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS Policies
alter table public.centro_copiado_ploteo_cad_precios enable row level security;

create policy "Users can view active CAD prices for their company"
  on public.centro_copiado_ploteo_cad_precios for select
  using (company_id = public.get_user_company_id(auth.uid()) and is_active = true);

create policy "Users can manage CAD prices for their company"
  on public.centro_copiado_ploteo_cad_precios for all
  using (company_id = public.get_user_company_id(auth.uid()));

-- Initial Data Seed (Optional: Insert default Bond 90g)
-- Note: Requires a valid company_id context or manual insertion later. 
-- We will just create the structure for now.
