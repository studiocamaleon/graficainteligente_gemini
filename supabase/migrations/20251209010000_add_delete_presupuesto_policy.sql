-- Enable delete for admins and managers
DROP POLICY IF EXISTS "Enable delete for admins and managers" ON "public"."presupuestos";

CREATE POLICY "Enable delete for admins and managers" 
ON "public"."presupuestos" 
FOR DELETE 
TO authenticated 
USING (
  (auth.uid() IN ( 
    SELECT profiles.id 
    FROM profiles 
    WHERE profiles.role IN ('super_admin', 'admin', 'manager')
  ))
);
