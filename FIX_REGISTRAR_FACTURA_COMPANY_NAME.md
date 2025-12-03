# Fix: Error en fn_registrar_factura - Campo company_name

## Fecha
2025-12-03

## Problema Reportado
```
Error: record "v_company" has no field "company_name"
```

Error ocurría al intentar registrar una factura desde el hook `useFacturas`.

## Causa Raíz
En la función `fn_registrar_factura`, línea 276, se intentaba acceder al campo `v_company.company_name`, pero en la tabla `companies` el campo se llama `name`, no `company_name`.

### Código con error:
```sql
v_result := json_build_object(
  ...
  'company_name', v_company.company_name,  -- ❌ Campo incorrecto
  ...
);
```

### Estructura real de la tabla:
```sql
CREATE TABLE companies (
  id uuid PRIMARY KEY,
  name text,              -- ✅ El campo se llama "name"
  slug text,
  ...
);
```

## Solución Aplicada

### Migración: `fix_fn_registrar_factura_company_name.sql`

**Cambio único**: Línea 276 de la función
```sql
v_result := json_build_object(
  ...
  'company_name', v_company.name,  -- ✅ CORREGIDO
  ...
);
```

**Nota importante**:
- La **clave del JSON** sigue siendo `'company_name'` (compatibilidad con frontend)
- Solo se corrigió el **acceso al campo** de la base de datos: `v_company.name`

## Impacto
- ✅ Cambio mínimo (una línea)
- ✅ Sin breaking changes en el frontend
- ✅ La función ahora se ejecuta correctamente
- ✅ Todos los consumidores de la función siguen funcionando igual

## Verificación

### Comando de prueba:
```sql
-- Ejecutar desde Supabase SQL Editor
SELECT fn_registrar_factura(
  '[orden-id-valida]'::uuid,
  'FC-001-00000001',
  'company-id/orden-id/factura.pdf',
  'Prueba post-corrección',
  '[user-id-valido]'::uuid
);
```

### Resultado esperado:
```json
{
  "orden_id": "...",
  "numero_orden": "...",
  "numero_factura": "FC-001-00000001",
  "cliente_nombre": "...",
  "cliente_whatsapp": "...",
  "cliente_email": "...",
  "company_id": "...",
  "company_name": "Nombre de la empresa",  ← ✅ Ahora poblado correctamente
  "factura_storage_path": "...",
  "total": 0.00,
  "subtotal_iva": 0.00,
  "fecha_facturacion": "2025-12-03T..."
}
```

## Archivos Afectados
- ✅ `supabase/migrations/[timestamp]_fix_fn_registrar_factura_company_name.sql` (nuevo)
- 📝 Función corregida: `fn_registrar_factura`

## Estado
✅ **RESUELTO** - Migración aplicada exitosamente

## Próximos Pasos
Continuar con las fases del sistema de facturación sin este bloqueador.
