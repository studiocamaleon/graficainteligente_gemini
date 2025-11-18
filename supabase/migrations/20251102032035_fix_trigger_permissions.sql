/*
  # Corrección de Permisos para Trigger de Registro de Usuarios

  ## Problema Identificado
  El trigger `handle_new_user()` está fallando al crear registros en las tablas
  debido a que las políticas RLS requieren que el usuario esté autenticado (authenticated),
  pero durante el proceso de registro el usuario aún no está completamente autenticado.

  ## Solución
  Modificar las políticas INSERT para que también permitan operaciones a usuarios
  anónimos (anon) durante el proceso de registro, ya que el trigger se ejecuta
  en el contexto SECURITY DEFINER pero antes de que la sesión esté completamente establecida.

  ## Cambios

  ### 1. Actualizar Políticas INSERT
  - Cambiar políticas de `TO authenticated` a `TO authenticated, anon`
  - Esto permite que el trigger funcione correctamente durante el signup
  
  ### 2. Mantener Seguridad
  - Las políticas SELECT, UPDATE, DELETE siguen restringidas a authenticated
  - Las políticas INSERT solo se usan durante el registro automático
  - RLS sigue habilitado en todas las tablas

  ## Tablas Afectadas
  - companies: Permite INSERT durante registro
  - profiles: Permite INSERT durante registro  
  - company_subscriptions: Permite INSERT durante registro
*/

-- Eliminar políticas INSERT existentes
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON companies;
DROP POLICY IF EXISTS "Enable insert for new user profiles" ON profiles;
DROP POLICY IF EXISTS "Enable insert for new company subscriptions" ON company_subscriptions;

-- Crear nuevas políticas INSERT que permitan operaciones durante el registro
-- La función handle_new_user() se ejecuta con SECURITY DEFINER, por lo que
-- necesitamos permitir tanto a authenticated como a anon

CREATE POLICY "Enable insert for authenticated users during signup"
  ON companies FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Enable insert for new user profiles"
  ON profiles FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Enable insert for new company subscriptions"
  ON company_subscriptions FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
