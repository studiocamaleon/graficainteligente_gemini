/*
  # Fix: Permitir a usuarios leer sus PROPIAS restricciones de IP

  1. Problema Identificado
    - Las políticas RLS actuales solo permiten a super_admins ver restricciones
    - Los usuarios normales NO pueden ver sus propias restricciones durante login
    - Esto causa que la validación de IP no funcione (la query devuelve 0 filas)
    - El código interpreta "sin restricciones" y permite acceso indebido

  2. Solución
    - Agregar política que permita a cada usuario leer SOLO sus propias restricciones
    - Esta política se ejecuta en paralelo con las existentes
    - NO interfiere con las políticas de super_admin
    - Mantiene seguridad: cada usuario solo ve sus propias restricciones

  3. Impacto
    - Los usuarios podrán consultar user_ip_restrictions WHERE user_id = auth.uid()
    - La validación de IP en useAuth.tsx funcionará correctamente
    - Los bloqueos de IP se aplicarán según configuración
    - Super admins mantienen acceso completo para gestión

  4. Seguridad
    - Política restrictiva: USING (user_id = auth.uid())
    - Usuario solo ve sus propias restricciones
    - NO puede ver restricciones de otros usuarios
    - Las políticas de INSERT/UPDATE/DELETE siguen siendo solo para super_admin
*/

-- Agregar política para que usuarios puedan leer sus PROPIAS restricciones de IP
CREATE POLICY "Users can view their own IP restrictions"
  ON user_ip_restrictions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- NOTA: Esta política funciona en conjunto con la existente de super_admins
-- NOTA: Ambas políticas se evalúan con OR lógico
-- NOTA: Resultado: Super admins ven todas, usuarios normales ven solo las suyas