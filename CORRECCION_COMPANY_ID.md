# Corrección de Acceso a company_id en Productos Láser

## Problema Identificado

Los componentes del módulo de Productos Láser estaban intentando acceder a `user.companyId`, pero esta propiedad no existe en el objeto `User` de Supabase. El `company_id` se encuentra en el objeto `Profile` que se carga de forma asíncrona.

### Síntomas del Error

- Logs de consola: `⚠️ No hay companyId disponible`
- Los selectores de tecnologías, servicios y acabados no cargaban datos
- Los componentes mostraban estado de carga indefinidamente o vacíos

## Solución Implementada

### 1. Actualización de Componentes Selectores

Se actualizaron tres componentes para usar `profile.company_id` en lugar de `user.companyId`:

#### TecnologiaTintasSelector.tsx
- ✅ Cambio de `const { user } = useAuth()` a `const { user, profile } = useAuth()`
- ✅ Actualización de dependencias: `[user?.companyId]` → `[profile?.company_id, user]`
- ✅ Validación de estado: distingue entre "usuario sin perfil cargado" y "sin company_id"
- ✅ Todas las consultas ahora usan `profile?.company_id`

#### ServiciosSelector.tsx
- ✅ Cambio de `const { user } = useAuth()` a `const { user, profile } = useAuth()`
- ✅ Actualización de dependencias: `[user?.companyId]` → `[profile?.company_id, user]`
- ✅ Validación de estado: distingue entre "usuario sin perfil cargado" y "sin company_id"
- ✅ Todas las consultas ahora usan `profile?.company_id`

#### AcabadosSelector.tsx
- ✅ Cambio de `const { user } = useAuth()` a `const { user, profile } = useAuth()`
- ✅ Actualización de dependencias: `[user?.companyId]` → `[profile?.company_id, user]`
- ✅ Validación de estado: distingue entre "usuario sin perfil cargado" y "sin company_id"
- ✅ Todas las consultas ahora usan `profile?.company_id`

### 2. Actualización del Hook useProductosImpresionLaser

#### useProductosImpresionLaser (lista)
- ✅ Cambio de `const { user } = useAuth()` a `const { user, profile } = useAuth()`
- ✅ Actualización de dependencias en useEffect
- ✅ Manejo de tres estados:
  - Perfil cargado: ejecuta consulta
  - Usuario autenticado pero perfil no cargado: muestra loading
  - Sin usuario: finaliza loading
- ✅ Todas las consultas ahora usan `profile?.company_id`

#### useProductoImpresionLaser (individual)
- ✅ Cambio de `const { user } = useAuth()` a `const { user, profile } = useAuth()`
- ✅ Actualización de todas las operaciones:
  - fetchProducto: usa `profile?.company_id`
  - createProducto: usa `profile?.company_id`
  - updateProducto: usa `profile?.company_id`
  - toggleStatus: usa `profile?.company_id`
  - deleteProducto: usa `profile?.company_id`

### 3. Optimización de ProductoLaserModal

- ✅ Agregado reset de estado `hasChanges` cuando el modal se cierra
- ✅ Reducción de logs innecesarios (solo loguea ID del producto, no objeto completo)

## Archivos Modificados

1. `/src/components/productos/impresion-laser/TecnologiaTintasSelector.tsx`
2. `/src/components/productos/impresion-laser/ServiciosSelector.tsx`
3. `/src/components/productos/impresion-laser/AcabadosSelector.tsx`
4. `/src/hooks/useProductosImpresionLaser.ts`
5. `/src/components/productos/impresion-laser/ProductoLaserModal.tsx`

## Validación

✅ El proyecto compila sin errores TypeScript
✅ Build exitoso con Vite

## Comportamiento Esperado Después de la Corrección

1. Los selectores ahora cargan correctamente los datos al abrir el modal
2. No más warnings de "companyId no disponible" en consola
3. Los datos de tecnologías, servicios y acabados se muestran correctamente
4. La creación y edición de productos funciona correctamente

## Notas Técnicas

### Estructura de Datos en Supabase Auth

```typescript
// User (de @supabase/supabase-js)
{
  id: string,
  email: string,
  // NO tiene companyId directamente
}

// Profile (cargado desde tabla profiles)
{
  id: string,
  company_id: string,  // ← Aquí está el company_id
  role: UserRole,
  // ... otros campos
}
```

### Patrón de Carga Asíncrona

El contexto de autenticación carga los datos en este orden:
1. `user` - Se carga primero (auth.getSession)
2. `profile` - Se carga después (consulta a tabla profiles)

Por eso es importante validar tanto `user` como `profile` antes de realizar consultas que requieran `company_id`.

---

**Fecha de corrección:** 2025-11-14
**Estado:** ✅ Completado y validado

## Optimizaciones Adicionales

### Limpieza de Logs de Depuración

Para mejorar la experiencia del desarrollador y reducir el ruido en la consola, se eliminaron logs excesivos:

#### TecnologiaTintasSelector.tsx
- ✅ Removidos logs de renderizado y montaje/desmontaje del componente
- ✅ Removidos logs detallados de queries y respuestas
- ✅ Mantenidos solo logs de errores relevantes

#### ServiciosSelector.tsx
- ✅ Removidos logs de renderizado y montaje/desmontaje del componente
- ✅ Removidos logs detallados de queries y respuestas
- ✅ Mantenidos solo logs de errores relevantes

#### AcabadosSelector.tsx
- ✅ Removidos logs de renderizado y montaje/desmontaje del componente
- ✅ Removidos logs detallados de queries y respuestas
- ✅ Mantenidos solo logs de errores relevantes

#### MaterialCascadeSelector.tsx
- ✅ Removidos logs de materiales cargados
- ✅ Removidos logs de selección de material y variante
- ✅ Componente ahora es silencioso a menos que haya errores

#### ProductoLaserForm.tsx
- ✅ Removidos logs de inicialización del formulario
- ✅ Removidos logs de carga de datos para edición
- ✅ Componente ahora es silencioso

#### ProductoLaserModal.tsx
- ✅ Removido log de renderizado
- ✅ Componente ahora es silencioso

### Resultado

La consola del navegador ahora es mucho más limpia, mostrando solo:
- Errores relevantes cuando ocurren
- Sin logs de depuración innecesarios durante el funcionamiento normal
- Mejor experiencia de desarrollo

---

**Última actualización:** 2025-11-14
**Build Status:** ✅ Exitoso (936.80 kB)
