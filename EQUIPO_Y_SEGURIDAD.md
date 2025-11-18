# Módulo de Equipo y Seguridad - Documentación

## Descripción General

El módulo de Equipo y Seguridad es un sistema completo de gestión de usuarios, roles personalizados, permisos granulares y auditoría de acciones. Este módulo está diseñado exclusivamente para usuarios con rol de **super_admin**.

## Características Principales

### 1. Gestión de Usuarios del Equipo

El super_admin puede:
- **Crear usuarios** directamente con email, contraseña y rol asignado
- **Editar información** de usuarios (nombre, rol, permisos)
- **Cambiar contraseñas** de cualquier usuario sin necesitar la contraseña actual (cambio forzado)
- **Activar/Desactivar** usuarios sin eliminarlos
- **Eliminar usuarios** del sistema
- Ver última fecha de acceso y actividad de cada usuario

#### Roles Predefinidos

El sistema incluye 5 roles predefinidos con permisos preconfigurados:

1. **Super Administrador** - Acceso completo a todas las funcionalidades
2. **Administrador** - Acceso completo excepto gestión de equipo y seguridad
3. **Gerente** - Puede gestionar clientes, proveedores, órdenes y producción
4. **Operador** - Acceso de lectura y creación en módulos operativos
5. **Visualizador** - Solo puede ver información, sin permisos de edición

### 2. Sistema de Roles Personalizados

Permite crear roles adaptados a las necesidades específicas de la empresa:

- **Crear roles personalizados** con nombre y descripción
- **Configurar permisos granulares** por módulo y acción (ver, crear, editar, eliminar)
- **Duplicar roles existentes** como plantilla para nuevos roles
- **Activar/Desactivar roles** sin eliminarlos
- **Editar permisos** de roles en cualquier momento
- Protección contra eliminación de roles asignados a usuarios activos

#### Matriz de Permisos

Cada rol personalizado tiene una matriz de permisos que permite configurar 4 acciones por módulo:
- **Ver**: Acceso de lectura al módulo
- **Crear**: Capacidad de crear nuevos registros
- **Editar**: Capacidad de modificar registros existentes
- **Eliminar**: Capacidad de eliminar registros

### 3. Sistema Dinámico de Permisos

El sistema de permisos se genera automáticamente basándose en los módulos del sistema:

- Los permisos se actualizan automáticamente al agregar nuevos módulos
- No requiere migraciones de base de datos al expandir funcionalidades
- Los módulos se definen en `src/constants/modules.ts`
- Cada módulo y submódulo tiene permisos independientes

### 4. Panel de Auditoría

Registro completo de todas las acciones importantes:

- **Registro de acciones**: Crear, editar, eliminar usuarios y roles
- **Información detallada**: Usuario, fecha/hora, acción, módulo, dirección IP
- **Exportación a CSV**: Descargar registros para análisis externo
- **Filtros**: Por usuario, módulo, acción y rango de fechas (próximamente)
- **Vista cronológica**: Eventos ordenados del más reciente al más antiguo

### 5. Configuración de Seguridad

Funcionalidades de seguridad implementadas:

- **Contraseñas seguras**: Mínimo 8 caracteres con validación
- **Bloqueo automático**: Tras 5 intentos de login fallidos
- **Expiración de sesiones**: Las sesiones expiran después de 30 días
- **Restricciones de IP**: Sistema preparado para limitar acceso por dirección IP (próximamente)
- **Registro de intentos de login**: Seguimiento de accesos exitosos y fallidos

## Estructura de Base de Datos

### Tablas Principales

1. **custom_roles** - Roles personalizados de cada empresa
2. **role_permissions** - Permisos específicos de cada rol
3. **user_ip_restrictions** - Direcciones IP permitidas por usuario
4. **audit_log** - Registro de auditoría de acciones
5. **user_sessions** - Sesiones activas de usuarios
6. **login_attempts** - Intentos de inicio de sesión

### Campos Agregados a `profiles`

- `custom_role_id` - Referencia a rol personalizado (opcional)
- `last_login` - Última fecha de acceso
- `last_ip` - Última dirección IP de acceso
- `is_active` - Estado activo/inactivo del usuario
- `failed_login_attempts` - Contador de intentos fallidos
- `locked_until` - Fecha hasta la cual está bloqueado

## Seguridad y Permisos

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con políticas estrictas:

- Solo **super_admin** puede gestionar usuarios, roles y permisos
- Los logs de auditoría son visibles solo para **super_admin**
- Las sesiones solo pueden ser vistas por el propietario o **super_admin**
- Los datos están aislados por `company_id`

### Validaciones Implementadas

- No se puede eliminar un rol asignado a usuarios activos
- Las contraseñas deben tener mínimo 8 caracteres
- Solo el super_admin puede acceder al módulo de Equipo y Seguridad
- Las restricciones de IP son opcionales por usuario

## Componentes Principales

### Hooks Personalizados

- `useTeamMembers()` - Gestión de usuarios del equipo
- `useCustomRoles()` - Gestión de roles personalizados
- `usePermissions()` - Verificación de permisos del usuario actual
- `useAuditLog()` - Consulta de registros de auditoría

### Componentes UI

- `TeamMembersTab` - Lista y gestión de usuarios
- `CustomRolesTab` - Lista y gestión de roles personalizados
- `SecurityTab` - Configuración de seguridad
- `AuditLogTab` - Visualización de logs de auditoría
- `PermissionsMatrix` - Matriz visual de permisos
- `CreateMemberModal` - Formulario de creación de usuarios
- `EditMemberModal` - Formulario de edición de usuarios
- `ResetPasswordModal` - Cambio de contraseña forzado
- `CreateRoleModal` - Formulario de creación de roles
- `EditRoleModal` - Formulario de edición de roles

## Flujo de Trabajo

### Crear un Nuevo Usuario

1. Super admin accede al módulo "Equipo y Seguridad"
2. En el tab "Usuarios", click en "Crear Usuario"
3. Completa: nombre completo, email, contraseña
4. Selecciona rol predefinido o rol personalizado
5. El usuario queda activo y puede iniciar sesión inmediatamente

### Crear un Rol Personalizado

1. Super admin accede al tab "Roles Personalizados"
2. Click en "Crear Rol"
3. Define nombre y descripción del rol
4. Configura permisos en la matriz por módulo
5. El rol queda disponible para asignar a usuarios

### Cambiar Contraseña de un Usuario

1. Super admin accede al tab "Usuarios"
2. Click en menú de acciones del usuario (tres puntos)
3. Selecciona "Cambiar Contraseña"
4. Ingresa nueva contraseña y confirma
5. El usuario puede iniciar sesión inmediatamente con la nueva contraseña

## Funcionalidades Futuras

Las siguientes funcionalidades están preparadas en la base de datos pero pendientes de implementación en la UI:

1. **Restricciones de IP por Usuario**
   - Configurar múltiples IPs permitidas por usuario
   - Bloqueo automático de acceso desde IPs no autorizadas
   - Notificaciones de intentos de acceso bloqueados

2. **Filtros Avanzados en Auditoría**
   - Filtrar por rango de fechas personalizado
   - Filtrar por tipo de acción específica
   - Filtrar por módulo del sistema
   - Búsqueda por palabra clave

3. **Autenticación de Dos Factores**
   - Código de verificación por email
   - Configuración opcional por usuario

4. **Gestión de Sesiones Activas**
   - Ver todas las sesiones activas de un usuario
   - Cerrar sesiones remotamente
   - Límite de sesiones simultáneas

## Notas Técnicas

### Generación Dinámica de Permisos

Los permisos se generan automáticamente desde `src/constants/modules.ts`:

```typescript
export const AVAILABLE_PERMISSIONS = generatePermissionsFromModules();
```

Esto garantiza que al agregar un nuevo módulo al array `MODULES`, los permisos se actualizan automáticamente sin necesidad de modificar la base de datos.

### Caché de Permisos

Los permisos del usuario actual se cargan una vez y se mantienen en memoria para optimizar el rendimiento. Se recargan automáticamente al cambiar de usuario o al actualizar roles.

### Funciones de Base de Datos

Se incluyen funciones útiles:
- `check_ip_restriction()` - Valida si una IP está permitida
- `log_login_attempt()` - Registra intentos de login
- `cleanup_expired_sessions()` - Limpia sesiones expiradas

## Mantenimiento

### Agregar un Nuevo Módulo

1. Agregar el módulo en `src/constants/modules.ts`
2. Los permisos se generan automáticamente
3. Los roles existentes no tienen permisos en el nuevo módulo por defecto
4. El super_admin debe configurar permisos en roles personalizados

### Actualizar Roles Predefinidos

Los roles predefinidos se configuran en `src/constants/permissions.ts` en el objeto `PREDEFINED_ROLES`. Al modificarlos, los cambios aplican inmediatamente a todos los usuarios con esos roles.

## Soporte y Mantenimiento

Este módulo está diseñado para ser:
- **Escalable**: Fácil de agregar nuevos módulos y permisos
- **Seguro**: Múltiples capas de validación y RLS
- **Auditable**: Registro completo de todas las acciones
- **Flexible**: Roles personalizados adaptables a cada empresa
- **Mantenible**: Código organizado y documentado
