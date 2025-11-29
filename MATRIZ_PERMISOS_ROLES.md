# Matriz de Permisos por Rol

## Descripción

Este documento define los permisos de acceso de cada rol del sistema. Los permisos están organizados por módulo y funcionalidad.

**Versión**: 1.0
**Fecha de actualización**: 2025-11-29

---

## Leyenda

- ✓ **CRUD**: Crear, Leer, Actualizar y Eliminar (acceso completo)
- ✓ **Ver**: Solo lectura, sin permisos de modificación
- ✓ **Ver+Ejecutar**: Solo lectura más capacidad de ejecutar acciones específicas
- ✗ **Sin acceso**: No puede acceder al módulo

---

## Tabla Completa de Accesos por Rol

| Módulo/Funcionalidad | Super Admin | Admin | Manager | Operador Diseño | Operador Taller | Viewer |
|---------------------|-------------|-------|---------|-----------------|-----------------|--------|
| **Dashboard** | ✓ CRUD | ✓ CRUD | ✓ Ver | ✓ Ver | ✗ | ✓ Ver |
| **Clientes** | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✗ | ✓ Ver |
| **Proveedores** | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✓ Ver |
| **ABM Core** | | | | | | |
| - Estaciones | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Tecnologías | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Materiales | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Pasos | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Rutas Producción | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Servicios | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Acabados | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| - Rangos Precio | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✓ Ver |
| **Productos** | | | | | | |
| - Ver Productos | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| - Crear Productos | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| - Editar Productos | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| - Ver Precios | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| - Modificar Precios | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Centro Copiado** | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✗ | ✓ Ver |
| **Órdenes Trabajo** | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✓ CRUD | ✗ | ✓ Ver |
| **Producción** | | | | | | |
| - Tab Jobs | ✓ | ✓ | ✓ | ✓ Ver+Ejecutar | ✓ Ver+Ejecutar | ✓ Ver |
| - Tab Estaciones | ✓ | ✓ | ✓ | ✓ Ver+Ejecutar | ✓ Ver+Ejecutar | ✓ Ver |
| - Tab Productividad | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| - Tab Actividad | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| - Tab Pausas | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| - Ejecutar Pasos | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Finanzas** | ✓ CRUD | ✓ CRUD | ✗ | ✗ | ✗ | ✗ |
| **Equipo y Seguridad** | ✓ CRUD | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Integraciones** | | | | | | |
| - Conectar WhatsApp | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| - Desconectar WhatsApp | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Configuración** | | | | | | |
| - Ubicaciones | ✓ CRUD | ✗ | ✗ | ✗ | ✗ | ✗ |
| - Cajas | ✓ CRUD | ✗ | ✗ | ✗ | ✗ | ✗ |
| - Medios Cobro | ✓ CRUD | ✗ | ✗ | ✗ | ✗ | ✗ |
| - Motivos Pausa | ✓ CRUD | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Descripción Detallada por Rol

### 1. Super Admin

**Acceso**: Completo y sin restricciones

- Accede a todos los módulos del sistema
- Puede crear, editar y eliminar cualquier registro
- Único rol con acceso a "Equipo y Seguridad"
- Único rol con acceso a todos los submódulos de "Configuración"
- Puede gestionar usuarios, roles y permisos
- Puede ver registros de auditoría

**Uso recomendado**: Propietario o gerente general de la empresa

---

### 2. Admin

**Acceso**: Completo excepto gestión de equipo y configuración

- Accede a todos los módulos operativos
- Puede crear, editar y eliminar registros en la mayoría de módulos
- NO accede a "Equipo y Seguridad"
- NO accede a ningún submódulo de "Configuración"
- Puede gestionar finanzas, clientes, proveedores, productos
- Puede ejecutar y supervisar producción

**Diferencias con Super Admin**:
- No puede crear usuarios ni modificar roles
- No puede cambiar configuración del sistema
- No puede modificar ubicaciones, cajas, medios de cobro

**Uso recomendado**: Gerente administrativo o jefe de operaciones

---

### 3. Manager

**Acceso**: Operativo completo sin finanzas ni configuración

- Accede a clientes, proveedores, productos
- Puede gestionar órdenes y centro de copiado
- Puede supervisar y ejecutar producción completa
- NO accede a Finanzas
- NO accede a ABM Core (configuración de producción)
- NO accede a Equipo y Configuración

**Uso recomendado**: Encargado de producción o coordinador de taller

---

### 4. Operador de Diseño

**Acceso**: Clientes, órdenes y visualización de productos

**Acceso completo (CRUD)**:
- Clientes: Puede crear y editar clientes
- Órdenes de Trabajo: Puede crear, editar y gestionar órdenes
- Centro de Copiado: Acceso completo a todas las funcionalidades

**Acceso de solo lectura**:
- Dashboard: Puede ver estadísticas generales
- Productos (todos los tipos): Puede ver catálogo pero NO crear/editar
- Precios: Puede VER precios pero NO modificarlos
- Producción (tabs Jobs y Estaciones): Puede ver estado de trabajos

**Puede ejecutar**:
- Pasos de producción: Puede iniciar, completar, pausar y omitir pasos

**Sin acceso**:
- Proveedores
- ABM Core (todo el módulo)
- Finanzas (todo el módulo)
- Equipo y Seguridad
- Configuración (todo el módulo)
- Tabs de Producción: Productividad, Actividad, Pausas

**Integraciones**:
- WhatsApp: Puede conectar pero NO desconectar

**Uso recomendado**: Personal de atención al cliente y diseño que genera órdenes

---

### 5. Operador de Taller

**Acceso**: Solo módulo de producción (ultra-limitado)

**Único acceso**: Módulo Producción
- Tabs visibles: SOLO Jobs y Estaciones
- Puede ejecutar pasos de producción (iniciar, completar, pausar, omitir)
- Puede ver detalles de trabajos asignados

**Sin acceso**: Todos los demás módulos del sistema
- No ve sidebar con otros módulos
- Solo puede navegar dentro de producción
- URLs directas a otros módulos redirigen al dashboard

**Uso recomendado**: Operarios de taller que solo ejecutan trabajos de producción

---

### 6. Viewer

**Acceso**: Solo lectura en la mayoría de módulos

- Puede ver información en módulos permitidos
- NO puede crear, editar ni eliminar registros
- NO puede ejecutar pasos de producción
- Accede a: Dashboard, Clientes, Proveedores, Productos, Precios
- NO accede a: Finanzas, Equipo, Configuración, ABM Core

**Uso recomendado**: Personal que necesita consultar información sin modificarla

---

## Casos de Uso Específicos

### Gestión de Órdenes

| Acción | Super Admin | Admin | Manager | Op. Diseño | Op. Taller | Viewer |
|--------|-------------|-------|---------|------------|------------|--------|
| Ver órdenes | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Crear orden | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Editar orden pendiente | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Editar orden en proceso | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Cambiar estado orden | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Ver rutas producción | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Ejecución de Producción

| Acción | Super Admin | Admin | Manager | Op. Diseño | Op. Taller | Viewer |
|--------|-------------|-------|---------|------------|------------|--------|
| Ver jobs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Iniciar paso | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Completar paso | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Pausar paso | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Omitir paso | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Ver métricas productividad | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Ver actividad operadores | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

### Gestión de Catálogo

| Acción | Super Admin | Admin | Manager | Op. Diseño | Op. Taller | Viewer |
|--------|-------------|-------|---------|------------|------------|--------|
| Ver productos | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Crear producto | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Editar producto | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Activar/desactivar | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Ver precios | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| Modificar precios | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## Notas Importantes

### Restricciones Especiales

1. **Admin**:
   - NO puede acceder a `/app/team` ni sus subrutas
   - NO puede acceder a `/app/settings/*` (ningún submódulo)
   - URLs directas redirigen automáticamente al dashboard

2. **Operador de Diseño**:
   - Puede crear órdenes pero no modificar las que ya están "en_proceso"
   - Puede conectar WhatsApp pero no desconectar
   - No ve botones de crear/editar en productos
   - Los inputs de precios están deshabilitados (solo lectura)
   - Solo ve 2 tabs en producción (oculta Productividad, Actividad, Pausas)

3. **Operador de Taller**:
   - Solo ve el ícono de "Producción" en el sidebar
   - Solo ve 2 tabs (Jobs y Estaciones)
   - Cualquier URL directa a otros módulos redirige al dashboard
   - No puede crear ni modificar órdenes

### Seguridad

- Todas las rutas están protegidas con `ProtectedModuleRoute`
- Los permisos se validan tanto en frontend como en backend (RLS)
- Las validaciones de rol son específicas por módulo y acción
- URLs directas respetan las restricciones de permisos

### Escalabilidad

- Nuevos módulos se agregan automáticamente al sistema de permisos
- Los roles personalizados permiten crear permisos específicos
- El sistema es compatible con futuras expansiones del catálogo

---

## Historial de Cambios

### Versión 1.0 (2025-11-29)

**Cambios implementados**:
- ✅ Agregados roles `operador_diseno` y `operador_taller`
- ✅ Rol `operator` eliminado (sin usuarios afectados)
- ✅ Admin sin acceso a Team y Settings
- ✅ Todas las rutas protegidas con `ProtectedModuleRoute`
- ✅ Tabs de producción filtrados por rol
- ✅ Productos: operadores solo pueden ver, no modificar
- ✅ Precios: operador diseño puede ver pero no editar
- ✅ WhatsApp: operador diseño puede conectar, no desconectar

**Bug fixes**:
- ✅ Corregido typo `superadmin` → `super_admin` en OrderDetailPage

**Validaciones**:
- ✅ Sistema de ejecución de producción verificado (sin restricciones de rol)
- ✅ Todos los roles autenticados pueden ejecutar pasos de producción
- ✅ Build exitoso sin errores de compilación

---

## Soporte

Para consultas sobre permisos o para solicitar cambios en los roles, contactar al administrador del sistema.
