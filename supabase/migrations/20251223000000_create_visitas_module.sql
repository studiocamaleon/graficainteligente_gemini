-- Create table for Visitas Configuration
CREATE TABLE IF NOT EXISTS public.visitas_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    dias_habilitados jsonb DEFAULT '[1, 2, 3, 4, 5]'::jsonb, -- 0=Sun, 1=Mon, etc.
    hora_inicio time DEFAULT '09:00:00',
    hora_fin time DEFAULT '18:00:00',
    duracion_slot integer DEFAULT 30, -- minutes
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT visitas_config_company_id_key UNIQUE (company_id)
);

-- RLS for visitas_config
ALTER TABLE public.visitas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visits config of their company"
    ON public.visitas_config
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update visits config of their company"
    ON public.visitas_config
    FOR UPDATE
    USING (
         company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert visits config for their company"
    ON public.visitas_config
    FOR INSERT
    WITH CHECK (
         company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );


-- Create table for Visitas (Appointments)
CREATE TABLE IF NOT EXISTS public.visitas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    titulo text NOT NULL,
    descripcion text,
    cliente_nombre text,
    cliente_empresa text,
    cliente_whatsapp text,
    fecha_inicio timestamptz NOT NULL,
    fecha_fin timestamptz NOT NULL,
    estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    creado_por uuid REFERENCES auth.users(id),
    cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL, -- Optional link to real client
    orden_id uuid REFERENCES public.ordenes_trabajo(id) ON DELETE SET NULL, -- Optional link to order
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for visitas
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visits of their company"
    ON public.visitas
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert visits for their company"
    ON public.visitas
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update visits of their company"
    ON public.visitas
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete visits of their company"
    ON public.visitas
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Add real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitas;
