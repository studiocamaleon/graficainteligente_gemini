-- Description: Updates DELETE policies for payment tables to explicitly allow super_admin and admin roles, ensuring they can delete payments even if other generic policies fail or are too restrictive.

-- 1. Ordenes Trabajo Pagos
DROP POLICY IF EXISTS "Users can delete own company ordenes_trabajo_pagos" ON ordenes_trabajo_pagos;

CREATE POLICY "Admin and Super Admin can delete ordenes_trabajo_pagos"
  ON ordenes_trabajo_pagos FOR DELETE
  TO authenticated
  USING (
    orden_id IN (
      SELECT id FROM ordenes_trabajo 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager') -- Including manager for operational flexibility, can be removed if strict
      )
    )
  );

-- 2. Centro Copiado Ordenes Pagos
DROP POLICY IF EXISTS "Users can delete own company ordenes copiado pagos" ON centro_copiado_ordenes_pagos;

CREATE POLICY "Admin and Super Admin can delete centro_copiado_ordenes_pagos"
  ON centro_copiado_ordenes_pagos FOR DELETE
  TO authenticated
  USING (
    orden_copiado_id IN (
      SELECT id FROM centro_copiado_ordenes 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'manager')
      )
    )
  );
