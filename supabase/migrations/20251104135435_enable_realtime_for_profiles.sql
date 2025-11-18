/*
  # Habilitar Realtime para la tabla profiles

  1. Configuración
    - Habilita replica identity FULL para la tabla profiles
    - Esto permite que Supabase Realtime envíe eventos en tiempo real cuando hay cambios
    - Incluye todos los campos en los eventos DELETE para que se pueda identificar el registro eliminado
  
  2. Seguridad
    - Los eventos de Realtime respetan las políticas RLS existentes
    - Solo los usuarios de la misma empresa verán los cambios de sus compañeros de equipo
*/

-- Habilitar replica identity FULL para la tabla profiles
-- Esto permite que los eventos realtime incluyan todos los campos
ALTER TABLE profiles REPLICA IDENTITY FULL;
