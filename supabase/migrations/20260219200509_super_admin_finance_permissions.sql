-- Refuerzo de permisos para super_admin/admin/manager en finanzas/pagos
-- Objetivo: permitir editar/eliminar pagos y borrar cuentas por pagar/cheques.

-- ---------------------------------------------------------------------
-- ordenes_trabajo_pagos: UPDATE / DELETE
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admin manage OT pagos" ON public.ordenes_trabajo_pagos;

CREATE POLICY "Super admin manage OT pagos"
  ON public.ordenes_trabajo_pagos
  FOR ALL
  TO authenticated
  USING (
    orden_id IN (
      SELECT o.id
      FROM public.ordenes_trabajo o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    orden_id IN (
      SELECT o.id
      FROM public.ordenes_trabajo o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- centro_copiado_ordenes_pagos: UPDATE / DELETE
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admin manage copiado pagos" ON public.centro_copiado_ordenes_pagos;

CREATE POLICY "Super admin manage copiado pagos"
  ON public.centro_copiado_ordenes_pagos
  FOR ALL
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT o.id
      FROM public.centro_copiado_ordenes o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    orden_copiado_id IN (
      SELECT o.id
      FROM public.centro_copiado_ordenes o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- compras_proveedores: DELETE
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admin can delete compras" ON public.compras_proveedores;

CREATE POLICY "Super admin can delete compras"
  ON public.compras_proveedores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = compras_proveedores.company_id
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- cheques_cartera: DELETE
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admin can delete cheques" ON public.cheques_cartera;

CREATE POLICY "Super admin can delete cheques"
  ON public.cheques_cartera
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = cheques_cartera.company_id
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );
