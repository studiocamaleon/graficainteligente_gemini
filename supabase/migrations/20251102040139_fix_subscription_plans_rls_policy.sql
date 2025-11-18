/*
  # Corrección de Política RLS para subscription_plans

  ## Problema
  La función trigger `handle_new_user()` necesita acceder a la tabla `subscription_plans`
  para obtener el plan Free y crear la suscripción inicial. Sin embargo, la política RLS
  actual solo permite acceso a usuarios `authenticated`, lo que causa un error durante
  el proceso de registro cuando el usuario todavía no está completamente autenticado.

  ## Solución
  Modificar la política SELECT de `subscription_plans` para permitir acceso tanto a
  usuarios `authenticated` como `anon` (anónimos). Esto permite que el trigger pueda
  consultar los planes durante el proceso de registro.

  ## Cambios

  ### 1. Política Actualizada
  - **Tabla**: subscription_plans
  - **Operación**: SELECT
  - **Roles**: authenticated, anon
  - **Condición**: is_active = true

  ## Seguridad
  - La tabla sigue protegida con RLS habilitado
  - Solo se permite lectura (SELECT) de planes activos
  - No se permiten operaciones INSERT, UPDATE o DELETE a usuarios normales
  - Los planes inactivos permanecen ocultos para todos los usuarios
*/

-- Eliminar la política SELECT existente para subscription_plans
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON subscription_plans;

-- Crear nueva política que permita acceso a authenticated y anon
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = true);
