/*
  # Actualización de Roles de Usuario: Nuevos Operadores

  ## Descripción
  Esta migración actualiza el sistema de roles para incluir dos nuevos tipos de operadores
  especializados y eliminar el rol genérico 'operator'.

  ## Cambios
  1. Modificar el CHECK constraint de la columna `role` en la tabla `profiles`
  2. Agregar nuevos roles: 'operador_diseno' y 'operador_taller'
  3. Eliminar rol: 'operator' (no hay usuarios con este rol actualmente)

  ## Nuevos Roles
  - **operador_diseno**: Operador con acceso a diseño, órdenes, clientes y visualización de productos
  - **operador_taller**: Operador limitado solo a módulo de producción (jobs y estaciones)

  ## Notas
  - No se requiere migración de datos (no existen usuarios con rol 'operator')
  - Mantiene compatibilidad con roles existentes
*/

-- Eliminar el constraint existente
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Agregar el nuevo constraint con los roles actualizados
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'manager', 'operador_diseno', 'operador_taller', 'viewer'));

-- Crear comentario en la tabla para documentar los roles
COMMENT ON COLUMN profiles.role IS
'Rol del usuario en el sistema:
- super_admin: Acceso completo a todo el sistema
- admin: Acceso completo excepto Equipo y Configuración
- manager: Acceso a operaciones del día a día
- operador_diseno: Acceso a diseño, órdenes y visualización de productos
- operador_taller: Acceso limitado solo a producción
- viewer: Solo lectura en la mayoría de módulos';
