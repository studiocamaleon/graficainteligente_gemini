# Plan de Implementación: Sistema de Roles y Permisos Mejorado

## Documento de Referencia para Implementación
**Versión**: 1.0
**Fecha**: 2025-11-29
**Autor**: Sistema de Gestión de Imprentas Digitales

---

## ÍNDICE
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Matriz de Permisos](#matriz-de-permisos)
3. [Schemas de Base de Datos](#schemas-de-base-de-datos)
4. [Fases de Implementación](#fases-de-implementación)
5. [Testing y Validación](#testing-y-validación)
6. [Cómo Solicitar la Implementación](#cómo-solicitar-la-implementación)

---

## RESUMEN EJECUTIVO

### Objetivos
- ✅ Agregar 2 nuevos roles: `operador_diseno` y `operador_taller`
- ✅ Ajustar permisos de rol `admin` (sin acceso a Team y Settings)
- ✅ Proteger TODAS las rutas con `ProtectedModuleRoute`
- ✅ Implementar permisos granulares en módulos específicos
- ✅ Mantener compatibilidad total con código existente

### Confirmaciones del Usuario
- ✅ Admin NO tiene acceso a ningún submódulo de Settings
- ✅ Operador de Diseño PUEDE editar órdenes que crea
- ✅ Operador de Diseño PUEDE ver precios pero NO modificarlos
- ✅ No hay usuarios existentes con rol 'operator'

---

## MATRIZ DE PERMISOS

### Tabla Completa de Accesos por Rol

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

## SCHEMAS DE BASE DE DATOS

### Tabla `profiles`

**Ubicación**: `supabase/migrations/20251102024532_create_companies_and_users_schema.sql:106-115`

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'manager', 'operator', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Campo a modificar**: `role` (línea 112)

**Valor actual del CHECK constraint**:
```sql
CHECK (role IN ('super_admin', 'admin', 'manager', 'operator', 'viewer'))
```

**Valor nuevo del CHECK constraint**:
```sql
CHECK (role IN ('super_admin', 'admin', 'manager', 'operador_diseno', 'operador_taller', 'viewer'))
```

---

## FASES DE IMPLEMENTACIÓN

### 📋 FASE 1: Base de Datos y Tipos TypeScript

#### Archivos a modificar:
1. `src/types/database.ts` - Línea 1
2. Nueva migración SQL

#### PASO 1.1: Actualizar tipo TypeScript

**Archivo**: `src/types/database.ts`

**Ubicación exacta**: Línea 1

**Cambio a realizar**:
```typescript
// ANTES (línea 1)
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer';

// DESPUÉS
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operador_diseno' | 'operador_taller' | 'viewer';
```

#### PASO 1.2: Crear migración SQL

**Nombre del archivo**: `supabase/migrations/[timestamp]_update_user_roles_nuevos_operadores.sql`

**Contenido completo**:
```sql
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
```

**Validación**: Ejecutar `npm run build` para verificar que no hay errores de compilación TypeScript.

---

### 📋 FASE 2: Actualizar Sistema de Permisos

#### Archivos a modificar:
1. `src/constants/permissions.ts` - Líneas 45-135

#### PASO 2.1: Actualizar constante PREDEFINED_ROLES

**Archivo**: `src/constants/permissions.ts`

**Ubicación**: Líneas 45-135

**Cambios a realizar**:

**1. Eliminar definición de rol 'operator'** (líneas 62-65)

**2. Corregir permisos de 'admin'** (líneas 81-94):
```typescript
// ANTES (líneas 81-94)
  if (permission.moduleId === 'team') {
    PREDEFINED_ROLES.admin.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  } else {
    PREDEFINED_ROLES.admin.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  }

// DESPUÉS
  // Admin NO tiene acceso a 'team' ni a ningún submódulo de 'settings'
  const adminRestrictedModules = [
    'team',
    'settings',
    'settings-locations',
    'settings-cajas',
    'settings-medios-cobro',
    'settings-pausas'
  ];

  if (!adminRestrictedModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.admin.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  }
```

**3. Actualizar permisos de 'manager'** (líneas 97-110):
```typescript
// ANTES (línea 97)
  if (['clients', 'providers', 'orders', 'production', 'catalog', 'pricing'].includes(permission.moduleId)) {

// DESPUÉS - Eliminar 'catalog' y 'pricing' que no existen, agregar módulos reales
  const managerAllowedModules = [
    'clients',
    'providers',
    'orders',
    'orders-crear',
    'orders-lista',
    'production',
    'productos',
    'productos-impresion-laser',
    'productos-talonarios',
    'productos-gran-formato',
    'productos-materiales-rigidos',
    'productos-plotter-corte',
    'productos-sellos',
    'productos-portabanners'
  ];

  if (managerAllowedModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.manager.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  } else {
    PREDEFINED_ROLES.manager.permissions[permission.moduleId] = {
      view: permission.moduleId === 'dashboard',
      create: false,
      edit: false,
      delete: false,
    };
  }
```

**4. Agregar definición de 'operador_diseno'** (después de línea 111):
```typescript
  // Operador de Diseño: Acceso a clientes, órdenes, centro copiado, y visualización de productos
  operador_diseno: {
    name: 'Operador de Diseño',
    description: 'Acceso a órdenes, clientes, centro de copiado y visualización de productos',
    permissions: {} as ModulePermissions,
  },
```

**5. Agregar definición de 'operador_taller'** (después de operador_diseno):
```typescript
  operador_taller: {
    name: 'Operador de Taller',
    description: 'Acceso limitado solo al módulo de producción para ejecutar pasos',
    permissions: {} as ModulePermissions,
  },
```

**6. Agregar lógica de permisos para operador_diseno** (dentro del forEach, después de línea 127):
```typescript
  // Operador de Diseño
  const operadorDisenoFullAccessModules = [
    'clients',
    'orders',
    'orders-crear',
    'orders-lista',
    'centro-copiado',
    'centro-copiado-configuracion',
    'centro-copiado-terminaciones',
    'centro-copiado-rangos-precio',
    'centro-copiado-precios',
    'centro-copiado-ordenes',
    'centro-copiado-ordenes-crear'
  ];

  const operadorDisenoViewOnlyModules = [
    'dashboard',
    'productos',
    'productos-impresion-laser',
    'productos-talonarios',
    'productos-gran-formato',
    'productos-materiales-rigidos',
    'productos-plotter-corte',
    'productos-sellos',
    'productos-portabanners',
    'production' // Acceso especial manejado en componente
  ];

  const operadorDisenoIntegracionesModules = [
    'integrations',
    'integrations-whatsapp'
  ];

  if (operadorDisenoFullAccessModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: true,
      create: true,
      edit: true,
      delete: true,
    };
  } else if (operadorDisenoViewOnlyModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: true,
      create: false,
      edit: false,
      delete: false,
    };
  } else if (operadorDisenoIntegracionesModules.includes(permission.moduleId)) {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: true,
      create: true, // Puede conectar WhatsApp
      edit: false,
      delete: false, // No puede desconectar
    };
  } else {
    PREDEFINED_ROLES.operador_diseno.permissions[permission.moduleId] = {
      view: false,
      create: false,
      edit: false,
      delete: false,
    };
  }
```

**7. Agregar lógica de permisos para operador_taller** (después de operador_diseno):
```typescript
  // Operador de Taller: Solo acceso al módulo de producción
  if (permission.moduleId === 'production') {
    PREDEFINED_ROLES.operador_taller.permissions[permission.moduleId] = {
      view: true,
      create: true, // Puede ejecutar pasos
      edit: true,   // Puede modificar estado de pasos
      delete: false,
    };
  } else {
    PREDEFINED_ROLES.operador_taller.permissions[permission.moduleId] = {
      view: false,
      create: false,
      edit: false,
      delete: false,
    };
  }
```

**Validación**: Verificar que PREDEFINED_ROLES tenga 6 definiciones completas.

---

### 📋 FASE 3: Proteger Todas las Rutas

#### Archivos a modificar:
1. `src/App.tsx` - Líneas 84-141

#### PASO 3.1: Envolver rutas principales con ProtectedModuleRoute

**Archivo**: `src/App.tsx`

**Ubicación**: Dentro del Routes anidado en MainLayout (líneas 89-136)

**Rutas que YA están protegidas**:
- ✅ `/app/team` (línea 124)

**Rutas a proteger**:

```typescript
// Dashboard - NO necesita protección (todos acceden)
<Route path="dashboard" element={<Dashboard />} />

// Clientes
<Route
  path="clients"
  element={
    <ProtectedModuleRoute moduleId="clients">
      <Clients />
    </ProtectedModuleRoute>
  }
/>

// Proveedores
<Route
  path="providers"
  element={
    <ProtectedModuleRoute moduleId="providers">
      <Providers />
    </ProtectedModuleRoute>
  }
/>

// ABM Core - Cada submódulo
<Route
  path="abm-core/estaciones"
  element={
    <ProtectedModuleRoute moduleId="abm-core-estaciones">
      <Estaciones />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/tecnologias"
  element={
    <ProtectedModuleRoute moduleId="abm-core-tecnologias">
      <Tecnologias />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/materiales"
  element={
    <ProtectedModuleRoute moduleId="abm-core-materiales">
      <Materiales />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/pasos"
  element={
    <ProtectedModuleRoute moduleId="abm-core-pasos">
      <Pasos />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/rutas-produccion"
  element={
    <ProtectedModuleRoute moduleId="abm-core-rutas-produccion">
      <RutasProduccion />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/servicios"
  element={
    <ProtectedModuleRoute moduleId="abm-core-servicios">
      <Servicios />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/acabados"
  element={
    <ProtectedModuleRoute moduleId="abm-core-acabados">
      <Acabados />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="abm-core/rangos-precio"
  element={
    <ProtectedModuleRoute moduleId="abm-core-rangos-precio">
      <RangosPrecio />
    </ProtectedModuleRoute>
  }
/>

// Productos - Cada tipo
<Route
  path="productos/impresion-laser"
  element={
    <ProtectedModuleRoute moduleId="productos-impresion-laser">
      <ImpresionLaser />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="productos/talonarios"
  element={
    <ProtectedModuleRoute moduleId="productos-talonarios">
      <Talonarios />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="productos/gran-formato"
  element={
    <ProtectedModuleRoute moduleId="productos-gran-formato">
      <GranFormato />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="productos/materiales-rigidos"
  element={
    <ProtectedModuleRoute moduleId="productos-materiales-rigidos">
      <MaterialesRigidos />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="productos/plotter-corte"
  element={
    <ProtectedModuleRoute moduleId="productos-plotter-corte">
      <PlotterCorte />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="productos/sellos"
  element={
    <ProtectedModuleRoute moduleId="productos-sellos">
      <Sellos />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="productos/portabanners"
  element={
    <ProtectedModuleRoute moduleId="productos-portabanners">
      <Portabanners />
    </ProtectedModuleRoute>
  }
/>

// Centro de Copiado - Cada submódulo
<Route
  path="centro-copiado/configuracion"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-configuracion">
      <CentroCopiadoConfiguracion />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="centro-copiado/terminaciones"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-terminaciones">
      <CentroCopiadoTerminaciones />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="centro-copiado/rangos-precio"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-rangos-precio">
      <CentroCopiadoRangosPrecio />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="centro-copiado/precios"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-precios">
      <CentroCopiadoPrecios />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="centro-copiado/ordenes"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-ordenes">
      <CentroCopiadoOrdenes />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="centro-copiado/ordenes/crear"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-ordenes-crear">
      <CrearOrdenCopiado />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="centro-copiado/ordenes/:id"
  element={
    <ProtectedModuleRoute moduleId="centro-copiado-ordenes">
      <DetalleOrdenCopiado />
    </ProtectedModuleRoute>
  }
/>

// Órdenes de Trabajo
<Route path="orders" element={<Navigate to="/app/orders/ordenes" replace />} />

<Route
  path="orders/ordenes"
  element={
    <ProtectedModuleRoute moduleId="orders-lista">
      <OrdersListPage />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="orders/crear-ot"
  element={
    <ProtectedModuleRoute moduleId="orders-crear">
      <CreateOrderPage />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="orders/:id"
  element={
    <ProtectedModuleRoute moduleId="orders-lista">
      <OrderDetailPage />
    </ProtectedModuleRoute>
  }
/>

// Producción
<Route
  path="production"
  element={
    <ProtectedModuleRoute moduleId="production">
      <ProductionPage />
    </ProtectedModuleRoute>
  }
/>

// Finanzas (ya usa rutas anidadas)
<Route
  path="finanzas/*"
  element={
    <ProtectedModuleRoute moduleId="finance">
      <Finanzas />
    </ProtectedModuleRoute>
  }
/>

// Integraciones
<Route
  path="integrations"
  element={
    <ProtectedModuleRoute moduleId="integrations">
      <Integrations />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="integrations/whatsapp"
  element={
    <ProtectedModuleRoute moduleId="integrations-whatsapp">
      <WhatsAppIntegration />
    </ProtectedModuleRoute>
  }
/>

// Configuración - Cada submódulo
<Route
  path="settings"
  element={
    <ProtectedModuleRoute moduleId="settings">
      <SystemSettings />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="settings/pausas"
  element={
    <ProtectedModuleRoute moduleId="settings-pausas">
      <SystemSettings />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="settings/locations"
  element={
    <ProtectedModuleRoute moduleId="settings-locations">
      <Locations />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="settings/medios-cobro"
  element={
    <ProtectedModuleRoute moduleId="settings-medios-cobro">
      <MediosCobro />
    </ProtectedModuleRoute>
  }
/>

<Route
  path="settings/cajas"
  element={
    <ProtectedModuleRoute moduleId="settings-cajas">
      <Cajas />
    </ProtectedModuleRoute>
  }
/>
```

**Validación**: Intentar acceder a URLs restringidas directamente y verificar redirección a `/app/dashboard`.

---

### 📋 FASE 4: Filtrar Tabs en Módulo Producción

#### Archivos a modificar:
1. `src/pages/app/production/ProductionPage.tsx` - Líneas 1-75

#### PASO 4.1: Agregar filtrado de tabs

**Archivo**: `src/pages/app/production/ProductionPage.tsx`

**Cambios a realizar**:

**1. Agregar import de useAuth** (después de línea 11):
```typescript
import { useAuth } from '../../../hooks/useAuth';
```

**2. Obtener perfil del usuario** (después de línea 18):
```typescript
const { profile } = useAuth();
```

**3. Reemplazar definición de tabs** (líneas 22-50):
```typescript
// ANTES
const tabs = [
  {
    id: 'jobs' as TabId,
    label: 'Jobs',
    icon: Layers,
    count: totalJobs,
  },
  // ... etc
];

// DESPUÉS
const allTabs = [
  {
    id: 'jobs' as TabId,
    label: 'Jobs',
    icon: Layers,
    count: totalJobs,
  },
  {
    id: 'estaciones' as TabId,
    label: 'Estaciones',
    icon: Boxes,
    count: totalActivePasos,
  },
  {
    id: 'productividad' as TabId,
    label: 'Productividad',
    icon: TrendingUp,
  },
  {
    id: 'actividad' as TabId,
    label: 'Actividad',
    icon: Activity,
  },
  {
    id: 'pausas' as TabId,
    label: 'Pausas',
    icon: Pause,
  },
];

const tabs = useMemo(() => {
  const allowedRoles = ['super_admin', 'admin', 'manager'];
  if (profile?.role && allowedRoles.includes(profile.role)) {
    return allTabs;
  }
  // operador_diseno y operador_taller solo ven jobs y estaciones
  return allTabs.filter(tab => ['jobs', 'estaciones'].includes(tab.id));
}, [profile?.role, totalJobs, totalActivePasos]);
```

**4. Agregar función de validación de acceso a tabs** (antes del return, línea ~50):
```typescript
const canAccessTab = (tabId: TabId): boolean => {
  const allowedRoles = ['super_admin', 'admin', 'manager'];
  return profile?.role ? allowedRoles.includes(profile.role) : false;
};
```

**5. Proteger renderizado de tabs restringidos** (líneas 62-70):
```typescript
// ANTES
{activeTab === 'productividad' && <ProductivityView />}
{activeTab === 'actividad' && <ActivityView />}
{activeTab === 'pausas' && <PausasView />}

// DESPUÉS
{activeTab === 'productividad' && canAccessTab('productividad') && <ProductivityView />}
{activeTab === 'actividad' && canAccessTab('actividad') && <ActivityView />}
{activeTab === 'pausas' && canAccessTab('pausas') && <PausasView />}
```

**Validación**: Operadores solo deben ver 2 tabs (Jobs y Estaciones).

---

### 📋 FASE 5: Restricciones en Módulo Productos

#### PASO 5.1: Actualizar página principal de cada tipo de producto

**Archivos a modificar** (mismo patrón en todos):
- `src/pages/app/productos/ImpresionLaser.tsx`
- `src/pages/app/productos/Talonarios.tsx`
- `src/pages/app/productos/GranFormato.tsx`
- `src/pages/app/productos/MaterialesRigidos.tsx`
- `src/pages/app/productos/PlotterCorte.tsx`
- `src/pages/app/productos/Sellos.tsx`
- `src/pages/app/productos/Portabanners.tsx`

**Cambios en cada archivo**:

**1. Agregar imports** (líneas 1-10):
```typescript
import { useAuth } from '../../../hooks/useAuth';
import { usePermissions } from '../../../hooks/usePermissions';
```

**2. Obtener permisos** (después de useState):
```typescript
const { profile } = useAuth();
const { canCreate } = usePermissions();

// Ajustar el moduleId según el producto
const canCreateProduct = canCreate('productos-impresion-laser'); // cambiar según módulo
```

**3. Modificar headerAction** para ocultar botón crear (líneas ~20-30):
```typescript
// ANTES
const headerAction = useMemo(() => {
  if (activeTab === 'productos') {
    return (
      <Button onClick={handleOpenCreateModal}>
        <Plus className="w-4 h-4 mr-2" />
        Nuevo Producto
      </Button>
    );
  }
  return undefined;
}, [activeTab]);

// DESPUÉS
const headerAction = useMemo(() => {
  if (activeTab === 'productos' && canCreateProduct) {
    return (
      <Button onClick={handleOpenCreateModal}>
        <Plus className="w-4 h-4 mr-2" />
        Nuevo Producto
      </Button>
    );
  }
  return undefined;
}, [activeTab, canCreateProduct]);
```

**4. Mantener tabs de Precios visibles** (NO filtrar):
```typescript
// Los tabs NO se filtran, operador_diseno PUEDE ver precios
const tabs = [
  { id: 'productos', name: 'Productos', icon: Package },
  { id: 'precios', name: 'Precios', icon: DollarSign },
];
```

**Nota importante**: A diferencia del plan anterior, NO se oculta el tab de Precios. Operador de diseño puede VER precios pero no modificarlos.

#### PASO 5.2: Deshabilitar edición en tabs de productos

**Archivos a modificar**:
- `src/pages/app/productos/*/ProductosTab.tsx` (7 archivos)

**Ejemplos**:
- `src/pages/app/productos/impresion-laser/ProductosLaserTab.tsx`
- `src/pages/app/productos/talonarios/ProductosTalonariosTab.tsx`
- Etc.

**Cambios en cada ProductosTab**:

**1. Agregar import y obtener rol** (líneas 1-20):
```typescript
import { useAuth } from '../../../../hooks/useAuth';

// Dentro del componente
const { profile } = useAuth();
const isOperador = ['operador_diseno', 'operador_taller'].includes(profile?.role || '');
```

**2. Ocultar botones de acción en la tabla** (buscar las acciones de cada fila):
```typescript
// En las columnas de la tabla, donde están los botones de acción
{!isOperador && (
  <div className="flex items-center gap-2">
    <button
      onClick={() => handleEditar(producto)}
      className="..."
    >
      <Pencil className="w-4 h-4" />
    </button>

    <button
      onClick={() => handleToggleStatus(producto.id, producto.nombre, producto.is_active)}
      className="..."
    >
      <Power className="w-4 h-4" />
    </button>

    <button
      onClick={() => handleEliminar(producto.id, producto.nombre)}
      className="..."
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
)}

{/* Operadores solo pueden ver detalles */}
{isOperador && (
  <button
    onClick={() => handleVerDetalle(producto)}
    className="..."
  >
    <Eye className="w-4 h-4" />
  </button>
)}
```

#### PASO 5.3: Deshabilitar edición en tabs de precios

**Archivos a modificar**:
- `src/pages/app/productos/*/PreciosTab.tsx` (7 archivos)

**Ejemplos**:
- `src/pages/app/productos/impresion-laser/PreciosLaserTab.tsx`
- `src/pages/app/productos/materiales-rigidos/PreciosMaterialesRigidosTab.tsx`
- Etc.

**Cambios en cada PreciosTab**:

**1. Agregar import y obtener rol**:
```typescript
import { useAuth } from '../../../../hooks/useAuth';

const { profile } = useAuth();
const canEditPrecios = !['operador_diseno', 'operador_taller'].includes(profile?.role || '');
```

**2. Deshabilitar inputs de precios**:
```typescript
// En los inputs de precios, agregar prop disabled
<Input
  type="number"
  value={precio}
  onChange={handleChange}
  disabled={!canEditPrecios}
  className={!canEditPrecios ? 'bg-gray-100 cursor-not-allowed' : ''}
/>
```

**3. Ocultar botones de guardar cambios**:
```typescript
{canEditPrecios && (
  <Button onClick={handleSave}>
    Guardar Precios
  </Button>
)}
```

**Validación**: Operadores pueden ver precios pero no pueden modificarlos.

---

### 📋 FASE 6: Restricción de Desconexión en WhatsApp

#### Archivos a modificar:
1. `src/pages/app/integrations/WhatsAppIntegration.tsx`

#### PASO 6.1: Ocultar botón de desconectar

**Archivo**: `src/pages/app/integrations/WhatsAppIntegration.tsx`

**Cambios a realizar**:

**1. Ya tiene useAuth importado** (línea 11), verificar:
```typescript
import { useAuth } from '../../../hooks/useAuth';
```

**2. Agregar validación de permisos** (después de línea 22 donde obtiene profile):
```typescript
const { profile } = useAuth(); // Ya existe

// Agregar esta línea
const canDisconnect = useMemo(() => {
  const allowedRoles = ['super_admin', 'admin', 'manager'];
  return profile?.role ? allowedRoles.includes(profile.role) : false;
}, [profile?.role]);
```

**3. Buscar el botón de desconectar** (aproximadamente línea 290-320):
```typescript
// Buscar algo similar a:
<Button
  variant="danger"
  onClick={handleDisconnectRequest}
  disabled={isDisconnecting}
>
  {/* Contenido del botón */}
</Button>

// Envolver con condicional:
{isConnected && canDisconnect && (
  <Button
    variant="danger"
    onClick={handleDisconnectRequest}
    disabled={isDisconnecting}
  >
    {isDisconnecting ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Desconectando...
      </>
    ) : (
      <>
        <XCircle className="w-4 h-4 mr-2" />
        Desconectar WhatsApp
      </>
    )}
  </Button>
)}
```

**Validación**: Operador de diseño puede conectar WhatsApp pero no ve botón de desconectar.

---

### 📋 FASE 7: Corrección de Bug Existente

#### Archivos a modificar:
1. `src/pages/app/orders/OrderDetailPage.tsx`

#### PASO 7.1: Corregir typo en rol

**Archivo**: `src/pages/app/orders/OrderDetailPage.tsx`

**Ubicación**: Línea 70

**Cambio**:
```typescript
// ANTES (línea 70)
const isAdmin = profile?.role === 'superadmin' || profile?.role === 'admin';

// DESPUÉS
const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
```

**Validación**: Bug fix que restaura funcionalidad correcta para super_admin.

---

### 📋 FASE 8: Validar Ejecución de Producción

#### Archivos a verificar (NO modificar):
1. `src/hooks/useStepExecution.ts`
2. `src/components/production/JobExecutionModal.tsx`
3. `src/components/production/StepActionButtons.tsx`

#### PASO 8.1: Verificación

**Archivo**: `src/hooks/useStepExecution.ts`

**Verificar líneas 18-21**:
```typescript
const startStep = async (rutaId: string, ordenItemId: string): Promise<StepExecutionResult> => {
  if (!profile?.id) {
    return { success: false, error: 'Usuario no autenticado' };
  }
```

**✅ Confirmación**: Solo valida autenticación (`profile?.id`), NO valida rol específico.

**Resultado**: Los nuevos roles `operador_diseno` y `operador_taller` podrán ejecutar pasos de producción sin ningún cambio adicional.

**No se requiere ninguna modificación en esta fase.**

---

### 📋 FASE 9: Actualización de Documentación

#### Archivos a crear/modificar:
1. `EQUIPO_Y_SEGURIDAD.md` (actualizar)
2. `MATRIZ_PERMISOS_ROLES.md` (nuevo)

#### PASO 9.1: Actualizar EQUIPO_Y_SEGURIDAD.md

**Archivo**: `EQUIPO_Y_SEGURIDAD.md`

**Sección a agregar** (después de la descripción de roles existentes):

```markdown
### Nuevos Roles Especializados (Noviembre 2025)

#### 6. Operador de Diseño
**Descripción**: Rol especializado para personal que gestiona órdenes, clientes y diseño de trabajos.

**Acceso completo (CRUD)**:
- Clientes
- Órdenes de Trabajo (crear, ver, editar)
- Centro de Copiado (todas las funcionalidades)

**Acceso de solo lectura**:
- Dashboard
- Productos (todos los tipos)
- Precios (puede VER pero NO modificar)
- Producción (tabs Jobs y Estaciones)

**Puede ejecutar**:
- Pasos de producción (iniciar, completar, pausar)

**Sin acceso**:
- Proveedores
- ABM Core
- Finanzas
- Equipo y Seguridad
- Configuración

**Integraciones**:
- WhatsApp: Puede conectar, NO puede desconectar

---

#### 7. Operador de Taller
**Descripción**: Rol ultra-limitado para personal de taller que solo ejecuta trabajos de producción.

**Único acceso**: Módulo Producción
- Tabs: Jobs y Estaciones únicamente
- Puede ejecutar pasos de producción

**Sin acceso**: Todos los demás módulos del sistema
```

#### PASO 9.2: Crear MATRIZ_PERMISOS_ROLES.md

**Archivo nuevo**: `MATRIZ_PERMISOS_ROLES.md`

**Contenido**: (Copiar la tabla de "Matriz de Permisos" de este documento)

---

## TESTING Y VALIDACIÓN

### Checklist de Testing por Rol

#### Super Admin
- [ ] Accede a todos los módulos del sidebar
- [ ] Puede acceder a todas las URLs directamente
- [ ] Ve todos los tabs de producción
- [ ] Puede crear/editar productos y precios
- [ ] Puede desconectar WhatsApp
- [ ] Accede a Team y Settings

#### Admin
- [ ] No ve "Equipo y Seguridad" en sidebar
- [ ] No ve "Configuración" ni submódulos en sidebar
- [ ] Redirige a dashboard si intenta acceder a `/app/team`
- [ ] Redirige a dashboard si intenta acceder a `/app/settings/*`
- [ ] Accede a todos los demás módulos
- [ ] Ve todos los tabs de producción
- [ ] Puede crear/editar productos y precios
- [ ] Puede desconectar WhatsApp

#### Manager
- [ ] Accede a módulos permitidos
- [ ] Ve todos los tabs de producción
- [ ] Puede crear/editar productos
- [ ] Puede desconectar WhatsApp

#### Operador de Diseño
- [ ] No ve Proveedores en sidebar
- [ ] No ve ABM Core en sidebar
- [ ] No ve Finanzas en sidebar
- [ ] No ve Equipo en sidebar
- [ ] No ve Configuración en sidebar
- [ ] Accede a Clientes, Órdenes, Centro Copiado
- [ ] Ve módulo Producción con solo 2 tabs (Jobs y Estaciones)
- [ ] Ve productos pero sin botones de crear/editar
- [ ] Ve tab de Precios pero inputs deshabilitados
- [ ] Puede ejecutar pasos de producción
- [ ] Puede conectar WhatsApp pero no ve botón desconectar
- [ ] URLs directas redirigen correctamente

#### Operador de Taller
- [ ] SOLO ve "Producción" en sidebar
- [ ] Módulo producción muestra solo 2 tabs
- [ ] Puede ejecutar pasos de producción
- [ ] Todas las demás URLs redirigen a dashboard

#### Viewer
- [ ] Solo lectura en módulos permitidos
- [ ] No puede ejecutar pasos de producción

### Comandos de Validación

```bash
# Compilar TypeScript
npm run build

# Verificar que no hay errores de compilación
# Debe completar sin errores

# Ejecutar en desarrollo
npm run dev

# Probar navegación manual
```

---

## CÓMO SOLICITAR LA IMPLEMENTACIÓN

### Formato de Solicitud por Fase

Para solicitar la implementación paso a paso, usa el siguiente formato:

```
Implementa la FASE [número] del documento PLAN_IMPLEMENTACION_ROLES_PERMISOS.md

[Opcional: agregar alguna nota específica o aclaración]
```

### Ejemplos de Solicitudes

**Ejemplo 1 - Iniciar implementación**:
```
Implementa la FASE 1 del documento PLAN_IMPLEMENTACION_ROLES_PERMISOS.md
```

**Ejemplo 2 - Continuar con siguiente fase**:
```
Implementa la FASE 2 del documento PLAN_IMPLEMENTACION_ROLES_PERMISOS.md
```

**Ejemplo 3 - Implementar múltiples fases**:
```
Implementa las FASES 1 y 2 del documento PLAN_IMPLEMENTACION_ROLES_PERMISOS.md
```

**Ejemplo 4 - Solicitar testing**:
```
Realiza el testing completo según la sección "TESTING Y VALIDACIÓN"
del documento PLAN_IMPLEMENTACION_ROLES_PERMISOS.md para el rol operador_diseno
```

### Orden Recomendado de Implementación

1. **FASE 1**: Base de Datos y Tipos (crítico, base de todo)
2. **FASE 2**: Sistema de Permisos (define la lógica)
3. **FASE 3**: Proteger Rutas (seguridad básica)
4. **FASE 4**: Producción Tabs (funcionalidad específica)
5. **FASE 5**: Productos (funcionalidad específica)
6. **FASE 6**: WhatsApp (funcionalidad específica)
7. **FASE 7**: Bug Fix (corrección)
8. **FASE 8**: Validación (verificación)
9. **FASE 9**: Documentación (cierre)

### Importante

- ✅ Cada fase puede implementarse independientemente
- ✅ Se puede hacer commit después de cada fase
- ✅ Puedes probar cada fase antes de continuar
- ✅ Puedes pausar y retomar cuando quieras
- ✅ El documento sirve como referencia permanente

---

## NOTAS FINALES

### Cambios Incompatibles hacia Atrás
- ❌ Rol 'operator' ya no existe (reemplazado por operador_diseno y operador_taller)
- ✅ No hay usuarios existentes con ese rol, no hay impacto

### Beneficios del Sistema Actualizado
1. ✅ Roles más granulares y específicos
2. ✅ Mejor seguridad (todas las rutas protegidas)
3. ✅ Admin correctamente limitado
4. ✅ Operadores especializados para diferentes necesidades
5. ✅ Sistema más mantenible y escalable

### Contacto y Soporte
Para dudas sobre la implementación, consultar este documento.
Cada fase tiene instrucciones detalladas con nombres de archivos,
líneas de código y cambios específicos.

---

**Fin del Documento**
