/*
  # Hacer opcional el campo uploaded_by en archivos de copiado

  ## Problema
  La tabla `centro_copiado_ordenes_archivos` requiere `uploaded_by` (NOT NULL).
  Para permitir cargas de usuarios invitados (Guest) o desde la App móvil sin sesión de perfil completa,
  es necesario que este campo sea nullable.

  ## Cambios
  - Alterar columna `uploaded_by` para DROP NOT NULL.
*/

ALTER TABLE centro_copiado_ordenes_archivos 
ALTER COLUMN uploaded_by DROP NOT NULL;
