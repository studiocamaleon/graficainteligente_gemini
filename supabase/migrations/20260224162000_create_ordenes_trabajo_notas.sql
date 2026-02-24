-- Notas múltiples para órdenes de trabajo
-- Mantiene notas_internas como campo legacy (última nota) para compatibilidad.

CREATE TABLE IF NOT EXISTS ordenes_trabajo_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nota text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_ordenes_trabajo_notas_nota_nonempty CHECK (length(trim(nota)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_notas_orden_id ON ordenes_trabajo_notas(orden_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_notas_company_id ON ordenes_trabajo_notas(company_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_notas_created_at ON ordenes_trabajo_notas(created_at DESC);

ALTER TABLE ordenes_trabajo_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company ordenes_trabajo_notas" ON ordenes_trabajo_notas;
CREATE POLICY "Users can view own company ordenes_trabajo_notas"
  ON ordenes_trabajo_notas
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own company ordenes_trabajo_notas" ON ordenes_trabajo_notas;
CREATE POLICY "Users can insert own company ordenes_trabajo_notas"
  ON ordenes_trabajo_notas
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own company ordenes_trabajo_notas" ON ordenes_trabajo_notas;
CREATE POLICY "Users can update own company ordenes_trabajo_notas"
  ON ordenes_trabajo_notas
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own company ordenes_trabajo_notas" ON ordenes_trabajo_notas;
CREATE POLICY "Users can delete own company ordenes_trabajo_notas"
  ON ordenes_trabajo_notas
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Backfill: migrar notas_internas existentes a la nueva tabla (solo si no hay nota previa para esa orden).
INSERT INTO ordenes_trabajo_notas (orden_id, company_id, nota, created_by, created_at)
SELECT
  ot.id,
  ot.company_id,
  trim(ot.notas_internas) AS nota,
  ot.created_by,
  COALESCE(ot.updated_at, ot.created_at, now())
FROM ordenes_trabajo ot
WHERE ot.notas_internas IS NOT NULL
  AND length(trim(ot.notas_internas)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM ordenes_trabajo_notas n
    WHERE n.orden_id = ot.id
  );

