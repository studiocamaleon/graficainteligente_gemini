-- Mesa de trabajo visual para estaciones (no reemplaza estado real de producción)
CREATE TABLE IF NOT EXISTS public.ordenes_items_mesa_trabajo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ruta_id uuid NOT NULL REFERENCES public.ordenes_trabajo_items_rutas(id) ON DELETE CASCADE,
  estacion_id uuid NOT NULL REFERENCES public.estaciones_trabajo(id) ON DELETE CASCADE,
  assigned_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_mesa_trabajo_company_ruta UNIQUE (company_id, ruta_id)
);

CREATE INDEX IF NOT EXISTS idx_mesa_trabajo_company_estacion
  ON public.ordenes_items_mesa_trabajo(company_id, estacion_id);

CREATE INDEX IF NOT EXISTS idx_mesa_trabajo_company_ruta
  ON public.ordenes_items_mesa_trabajo(company_id, ruta_id);

DROP TRIGGER IF EXISTS update_ordenes_items_mesa_trabajo_updated_at ON public.ordenes_items_mesa_trabajo;
CREATE TRIGGER update_ordenes_items_mesa_trabajo_updated_at
  BEFORE UPDATE ON public.ordenes_items_mesa_trabajo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ordenes_items_mesa_trabajo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company mesa trabajo" ON public.ordenes_items_mesa_trabajo;
CREATE POLICY "Users can view own company mesa trabajo"
  ON public.ordenes_items_mesa_trabajo
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own company mesa trabajo" ON public.ordenes_items_mesa_trabajo;
CREATE POLICY "Users can insert own company mesa trabajo"
  ON public.ordenes_items_mesa_trabajo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own company mesa trabajo" ON public.ordenes_items_mesa_trabajo;
CREATE POLICY "Users can delete own company mesa trabajo"
  ON public.ordenes_items_mesa_trabajo
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );
