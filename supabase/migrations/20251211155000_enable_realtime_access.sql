-- Enable Realtime access for Guest Users (Anon Role)
-- The App subscribes to changes on this table to update the "Status" in real-time.
-- Since guest users are not authenticated (role 'anon'), they need explicit SELECT permission.
-- Note: This makes order status publicly readable if the UUID is known (security relying on UUID space).

CREATE POLICY "Anon can view orders"
  ON centro_copiado_ordenes
  FOR SELECT
  TO anon
  USING (true);

-- Also ensure the publication is enabled for this table (Supabase usually handles this via UI, but good to ensure if using custom replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE centro_copiado_ordenes;
