-- v19: Create Missing Files Table
-- Goal: Fix error 'relation "ordenes_trabajo_archivos" does not exist'.
-- Logic: Create table mirroring "presupuestos_archivos" structure.

CREATE TABLE IF NOT EXISTS public.ordenes_trabajo_archivos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    orden_id uuid NOT NULL REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
    company_id uuid NOT NULL, -- Assuming REFERENCES companies(id) but simple uuid is safe
    nombre_archivo text NOT NULL,
    nombre_storage text NOT NULL,
    tipo_mime text NOT NULL,
    tamano_bytes bigint NOT NULL,
    storage_path text NOT NULL,
    descripcion text,
    uploaded_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordenes_trabajo_archivos ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for immediate fix, assuming standard tenant isolation)
CREATE POLICY "Users can view own company order files"
    ON public.ordenes_trabajo_archivos
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert own company order files"
    ON public.ordenes_trabajo_archivos
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete own company order files"
    ON public.ordenes_trabajo_archivos
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_ordenes_archivos_orden_id ON public.ordenes_trabajo_archivos(orden_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_archivos_company_id ON public.ordenes_trabajo_archivos(company_id);
