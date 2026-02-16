-- Allow operator role to delete payments (OT + Centro de Copiado).
-- This fixes cases where staff registers payments and needs to correct mistakes.

-- 1) Ordenes trabajo pagos
DROP POLICY IF EXISTS "Admin and Super Admin can delete ordenes_trabajo_pagos" ON ordenes_trabajo_pagos;

CREATE POLICY "Admin and Super Admin can delete ordenes_trabajo_pagos"
  ON ordenes_trabajo_pagos FOR DELETE
  TO authenticated
  USING (
    orden_id IN (
      SELECT id FROM ordenes_trabajo
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager', 'operator')
      )
    )
  );

-- 2) Centro copiado pagos
DROP POLICY IF EXISTS "Admin and Super Admin can delete centro_copiado_ordenes_pagos" ON centro_copiado_ordenes_pagos;

CREATE POLICY "Admin and Super Admin can delete centro_copiado_ordenes_pagos"
  ON centro_copiado_ordenes_pagos FOR DELETE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager', 'operator')
      )
    )
  );

