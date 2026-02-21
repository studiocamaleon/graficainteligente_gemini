-- Hardening roles for payment flows
-- Rules:
-- 1) All roles can register payments EXCEPT operador_taller (and legacy operator).
-- 2) Only super_admin can update/delete registered payments.

-- =====================================================
-- OT payments
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own company ordenes_trabajo_pagos" ON public.ordenes_trabajo_pagos;
DROP POLICY IF EXISTS "Users can update own company ordenes_trabajo_pagos" ON public.ordenes_trabajo_pagos;
DROP POLICY IF EXISTS "Users can delete own company ordenes_trabajo_pagos" ON public.ordenes_trabajo_pagos;
DROP POLICY IF EXISTS "Admin and Super Admin can delete ordenes_trabajo_pagos" ON public.ordenes_trabajo_pagos;
DROP POLICY IF EXISTS "Super admin manage OT pagos" ON public.ordenes_trabajo_pagos;

CREATE POLICY "Users except taller can insert ordenes_trabajo_pagos"
  ON public.ordenes_trabajo_pagos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    orden_id IN (
      SELECT o.id
      FROM public.ordenes_trabajo o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND COALESCE(p.role, '') NOT IN ('operador_taller', 'operator')
    )
  );

CREATE POLICY "Only super admin can update ordenes_trabajo_pagos"
  ON public.ordenes_trabajo_pagos
  FOR UPDATE
  TO authenticated
  USING (
    orden_id IN (
      SELECT o.id
      FROM public.ordenes_trabajo o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    orden_id IN (
      SELECT o.id
      FROM public.ordenes_trabajo o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admin can delete ordenes_trabajo_pagos"
  ON public.ordenes_trabajo_pagos
  FOR DELETE
  TO authenticated
  USING (
    orden_id IN (
      SELECT o.id
      FROM public.ordenes_trabajo o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role = 'super_admin'
    )
  );

-- =====================================================
-- Copy Center payments
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own company ordenes copiado pagos" ON public.centro_copiado_ordenes_pagos;
DROP POLICY IF EXISTS "Users can update own company ordenes copiado pagos" ON public.centro_copiado_ordenes_pagos;
DROP POLICY IF EXISTS "Users can delete own company ordenes copiado pagos" ON public.centro_copiado_ordenes_pagos;
DROP POLICY IF EXISTS "Admin and Super Admin can delete centro_copiado_ordenes_pagos" ON public.centro_copiado_ordenes_pagos;
DROP POLICY IF EXISTS "Super admin manage copiado pagos" ON public.centro_copiado_ordenes_pagos;

CREATE POLICY "Users except taller can insert centro_copiado_ordenes_pagos"
  ON public.centro_copiado_ordenes_pagos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    orden_copiado_id IN (
      SELECT o.id
      FROM public.centro_copiado_ordenes o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND COALESCE(p.role, '') NOT IN ('operador_taller', 'operator')
    )
  );

CREATE POLICY "Only super admin can update centro_copiado_ordenes_pagos"
  ON public.centro_copiado_ordenes_pagos
  FOR UPDATE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT o.id
      FROM public.centro_copiado_ordenes o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    orden_copiado_id IN (
      SELECT o.id
      FROM public.centro_copiado_ordenes o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admin can delete centro_copiado_ordenes_pagos"
  ON public.centro_copiado_ordenes_pagos
  FOR DELETE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT o.id
      FROM public.centro_copiado_ordenes o
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE o.company_id = p.company_id
        AND p.role = 'super_admin'
    )
  );
