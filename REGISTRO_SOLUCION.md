# Solución al Problema de Registro de Usuarios

## Resumen Ejecutivo

Se ha resuelto exitosamente el problema de registro de usuarios que causaba el error "Database error saving new user". El sistema ahora permite a los usuarios registrarse correctamente, creando automáticamente su empresa y perfil.

## Problema Original

Cuando un usuario intentaba registrarse, el sistema fallaba con el error:
```
AuthApiError: Database error saving new user
```

Esto impedía que los usuarios pudieran crear cuentas en la plataforma.

## Diagnóstico Realizado

1. **Tablas existentes**: Todas las tablas necesarias estaban creadas correctamente
2. **Planes de suscripción**: Los 3 planes (Free, Pro, Enterprise) existían en la base de datos
3. **Trigger configurado**: El trigger `on_auth_user_created` estaba activo
4. **Problema identificado**:
   - El trigger `handle_new_user()` fallaba al ejecutarse
   - Las políticas RLS bloqueaban las operaciones INSERT incluso con SECURITY DEFINER
   - Existía recursión infinita en las políticas RLS de la tabla `profiles`

## Soluciones Aplicadas

### 1. Corrección del Trigger (Migraciones 5-6)

**Problema**: La función `handle_new_user()` no podía insertar datos debido a restricciones RLS.

**Solución**:
- Recrear la función con `SECURITY DEFINER` y owner `postgres`
- Simplificar la lógica para evitar dependencias complejas
- Agregar logging detallado con `RAISE NOTICE` para diagnóstico
- Mejorar el manejo de errores con bloques BEGIN-EXCEPTION-END

**Archivos**:
- `20251102041112_fix_trigger_with_rls_bypass.sql`
- `20251102041157_fix_trigger_disable_rls_directly.sql`

### 2. Corrección de Recursión Infinita en RLS (Migración 7-8)

**Problema**: Las políticas RLS de `profiles` causaban recursión infinita porque las políticas SELECT hacían subconsultas a la misma tabla `profiles`.

**Solución**:
- Crear función helper `get_user_company_id()` con SECURITY DEFINER que bypasea RLS
- Rediseñar todas las políticas RLS para usar la función helper
- Eliminar subconsultas recursivas en las políticas

**Archivos**:
- `20251102041237_fix_recursive_rls_policies.sql`
- `20251102041305_fix_rls_with_function_helper.sql`

### 3. Mejoras en el Frontend

**Cambios en `src/hooks/useAuth.tsx`**:
- Logging detallado del proceso de registro
- Mensajes de error más específicos y útiles
- Validación de la respuesta de Supabase
- Información contextual en los logs para debugging

## Arquitectura Final

### Función Helper: `get_user_company_id()`

```sql
CREATE FUNCTION public.get_user_company_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE id = user_id LIMIT 1;
$$;
```

Esta función:
- Bypasea RLS usando SECURITY DEFINER
- Rompe el ciclo de recursión en las políticas
- Es STABLE (cacheable) para mejor rendimiento
- Tiene owner postgres para máximos privilegios

### Políticas RLS Simplificadas

#### Profiles
- `Users can view own profile`: Ver su propio perfil usando `auth.uid() = id`
- `Users can view company profiles`: Ver perfiles de la empresa usando la función helper
- `Users can update own profile`: Actualizar solo su propio perfil

#### Companies
- `Users can view own company`: Ver su empresa usando la función helper
- `Admins can update company`: Solo super_admin y admin pueden actualizar

#### Company Subscriptions
- `Users can view company subscription`: Ver suscripción de su empresa

### Flujo de Registro

1. Usuario completa el formulario de registro
2. Frontend envía petición a `supabase.auth.signUp()` con metadata
3. Supabase crea el usuario en `auth.users`
4. Trigger `on_auth_user_created` se activa automáticamente
5. Función `handle_new_user()` ejecuta:
   - Crea la empresa con slug único
   - Busca el plan "Free"
   - Crea suscripción Free para la empresa
   - Crea perfil del usuario como super_admin
6. Usuario queda autenticado y puede acceder al sistema

## Pruebas Realizadas

✅ **Diagnóstico completo**: Todas las tablas y datos verificados
✅ **Registro simulado**: Usuario de prueba creado y eliminado exitosamente
✅ **Verificación de perfil**: Perfil y empresa creados correctamente
✅ **Rol asignado**: Usuario registrado como super_admin
✅ **Suscripción**: Plan Free asignado automáticamente
✅ **Compilación**: Proyecto compila sin errores

## Scripts de Diagnóstico

Se crearon dos scripts útiles:

### `scripts/diagnose-db.ts`
Script completo de diagnóstico que verifica:
- Conexión a Supabase
- Existencia de tablas
- Datos de planes de suscripción
- Políticas RLS
- Simulación de registro

### `scripts/verify-system.ts`
Script de verificación rápida que confirma:
- Estado de todas las tablas
- Planes activos
- Función helper
- Prueba de registro real

**Uso**:
```bash
npx tsx scripts/verify-system.ts
```

## Migraciones Aplicadas

Total: 8 migraciones

1. `20251102024532_create_companies_and_users_schema.sql` - Esquema inicial
2. `20251102030041_fix_rls_policies_for_user_registration.sql` - Primera corrección RLS
3. `20251102032035_fix_trigger_permissions.sql` - Permisos del trigger
4. `20251102040139_fix_subscription_plans_rls_policy.sql` - RLS de planes
5. `20251102041112_fix_trigger_with_rls_bypass.sql` - Bypass RLS en trigger
6. `20251102041157_fix_trigger_disable_rls_directly.sql` - Corrección definitiva del trigger
7. `20251102041237_fix_recursive_rls_policies.sql` - Primera corrección de recursión
8. `20251102041305_fix_rls_with_function_helper.sql` - Solución con función helper

## Estado Actual

✅ **Sistema completamente funcional**

Los usuarios ahora pueden:
- Registrarse con email y contraseña
- Crear automáticamente su empresa
- Obtener rol de super_admin
- Acceder inmediatamente al sistema
- Iniciar con el plan Free

## Recomendaciones

### Monitoreo
- Revisar logs de Postgres periódicamente para detectar errores en el trigger
- Monitorear la creación de usuarios y perfiles para asegurar consistencia

### Mantenimiento
- Los scripts de diagnóstico deben ejecutarse después de cambios en la base de datos
- Mantener la documentación actualizada con cambios futuros

### Mejoras Futuras
1. Agregar confirmación de email (opcional)
2. Implementar límites de rate limiting en el registro
3. Crear panel de administración para gestionar usuarios con problemas
4. Agregar métricas de registro en un dashboard

## Soporte

Si un usuario no puede registrarse:

1. Ejecutar `npx tsx scripts/diagnose-db.ts` para diagnóstico completo
2. Revisar logs de la consola del navegador
3. Verificar que el email no esté ya registrado
4. Confirmar que la contraseña tiene al menos 6 caracteres
5. Revisar logs de Postgres en Supabase Dashboard (si disponible)

## Conclusión

El problema de registro ha sido resuelto completamente mediante:
- Corrección del trigger con permisos adecuados
- Eliminación de recursión infinita en políticas RLS
- Implementación de función helper para romper dependencias circulares
- Mejora del logging y manejo de errores en el frontend

El sistema está ahora en producción y listo para usuarios reales.
