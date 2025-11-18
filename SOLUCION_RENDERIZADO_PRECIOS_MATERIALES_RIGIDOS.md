# Solución: Renderizado de Todos los Precios de Materiales Rígidos

## Problema Identificado

El sistema no estaba renderizando todos los precios de productos de Materiales Rígidos. La causa raíz era una inconsistencia entre el modelo de datos (que permitía múltiples combinaciones variante-espesor por producto) y las restricciones de la base de datos (que solo permitían un precio por producto).

### Síntomas
- Solo se mostraba un precio por producto, aunque el producto tuviera múltiples combinaciones de variante-espesor
- El constraint único `unique_precio_por_producto_mr` impedía guardar múltiples precios para el mismo producto

## Solución Implementada

### 1. Análisis de la Estructura Existente

Se verificó que la tabla `productos_materiales_rigidos_materiales` ya tenía:
- Una columna `espesor` individual (decimal)
- Una columna `espesores` (array) por compatibilidad
- Un constraint único por combinación: `unique_producto_mr_material_variante_espesor`

### 2. Actualización del Schema de Precios

La tabla `productos_materiales_rigidos_precios` ya contaba con:
- Columna `espesor` individual (decimal) ✅
- Columna `espesores` (array) mantenida por compatibilidad ✅
- Constraint único actualizado: `unique_precio_por_variante_espesor` ✅
  - Permite múltiples precios por producto
  - Diferenciados por: (company_id, producto_id, material_id, variante_nombre, espesor)

### 3. Actualización de Hooks

#### `useAllProductosMaterialesRigidosPrecios.ts`
**Cambios realizados:**

- **Normalización de espesores:** Convertir espesores a formato decimal con 2 decimales para evitar problemas de comparación
  ```typescript
  const espesorStr = String(Number(precio.espesor).toFixed(2));
  ```

- **Mapeo de precios por combinación completa:** Usar la clave compuesta `productoId-variante-espesor`
  ```typescript
  const key = `${precio.producto_materiales_rigidos_id}-${precio.variante_nombre}-${espesorStr}`;
  ```

- **Construcción de productos por combinación:** Cada registro de material se convierte en una fila independiente en la tabla
  ```typescript
  const comboKey = `${producto.id}-${materialRelacion.variante_nombre}-${espesorNormalizado}`;
  ```

- **Actualización de `saveAllPrecios`:** Búsqueda y guardado por combinación completa incluyendo espesor

#### `useProductosMaterialesRigidos.ts`
**Cambios realizados:**

- **Actualización de tipos:**
  - `MaterialRelacion` ahora usa `espesor: number` (singular) en lugar de `espesores: number[]`
  - Nuevo tipo `VarianteEspesorCombinacion` para el formulario
  - `ProductoMaterialesRigidosFormData` ahora usa `materiales: Array<{...}>` en lugar de campos individuales

- **Función `createProducto`:** Inserta múltiples registros, uno por cada combinación
  ```typescript
  const materialesData = formData.materiales.map((mat) => ({
    producto_materiales_rigidos_id: producto.id,
    material_id: mat.material_id,
    variante_nombre: mat.variante_nombre,
    espesor: mat.espesor,
    espesores: [mat.espesor], // Mantener array para compatibilidad
  }));
  ```

- **Función `updateProducto`:** Elimina y recrea todos los registros de materiales

### 4. Actualización de Componentes UI

#### `ProductoMaterialesRigidosForm.tsx`
**Cambios realizados:**

- **Conversión de datos:** Transformar las combinaciones del formulario al formato esperado por el hook
  ```typescript
  const materialesData = combinaciones.map((comb) => ({
    material_id: materialId,
    variante_nombre: comb.variante_nombre,
    espesor: comb.espesor,
  }));
  ```

#### `MaterialesRigidosPreciosTable.tsx`
No requirió cambios - ya estaba diseñado para manejar múltiples filas por producto.

## Verificación de la Solución

### Datos de Prueba Creados

Se configuró el producto "PVC Espumado" con 3 combinaciones:

| Variante | Espesor | Precio Placa | Precio m² | Estado |
|----------|---------|--------------|-----------|--------|
| Blanco   | 3mm     | $97,029      | $32,595   | ✅     |
| Blanco   | 5mm     | $120,000     | $40,312   | ✅     |
| Blanco   | 10mm    | $180,000     | $60,468   | ✅     |

### Pruebas Realizadas

1. ✅ **Constraint Único:** Se verificó que el constraint impide duplicados pero permite múltiples combinaciones
2. ✅ **Cálculo Automático:** El trigger calcula correctamente el precio por m² para cada combinación
3. ✅ **Normalización:** Cada combinación variante-espesor se almacena como un registro independiente
4. ✅ **Build:** El proyecto compila sin errores

### Query de Verificación

```sql
SELECT
  pmr.nombre as producto,
  pmrm.variante_nombre,
  pmrm.espesor,
  pmrp.precio_placa,
  pmrp.precio_mt2
FROM productos_materiales_rigidos pmr
JOIN productos_materiales_rigidos_materiales pmrm
  ON pmr.id = pmrm.producto_materiales_rigidos_id
LEFT JOIN productos_materiales_rigidos_precios pmrp
  ON pmr.id = pmrp.producto_materiales_rigidos_id
  AND pmrm.material_id = pmrp.material_id
  AND pmrm.variante_nombre = pmrp.variante_nombre
  AND pmrm.espesor = pmrp.espesor
WHERE pmr.nombre = 'PVC Espumado'
ORDER BY pmrm.espesor;
```

## Beneficios de la Solución

1. **Flexibilidad de Precios:** Cada combinación variante-espesor puede tener su propio precio independiente
2. **Escalabilidad:** El sistema soporta cualquier cantidad de combinaciones por producto
3. **Integridad de Datos:** Los constraints aseguran que no haya duplicados ni inconsistencias
4. **Cálculos Automáticos:** El precio por m² se calcula automáticamente mediante trigger
5. **Compatibilidad:** Se mantiene la columna `espesores` (array) para evitar breaking changes

## Estructura Final de Datos

### productos_materiales_rigidos
- Información básica del producto (nombre, dimensiones, impuestos)

### productos_materiales_rigidos_materiales
- **Un registro por cada combinación variante-espesor**
- Campos: `producto_id`, `material_id`, `variante_nombre`, `espesor`
- Constraint único: `(producto_id, material_id, variante_nombre, espesor)`

### productos_materiales_rigidos_precios
- **Un registro por cada combinación con precio**
- Campos: `producto_id`, `material_id`, `variante_nombre`, `espesor`, `precio_placa`, `precio_mt2`
- Constraint único: `(company_id, producto_id, material_id, variante_nombre, espesor)`
- Relación 1:1 con registros de `productos_materiales_rigidos_materiales`

## Uso en la Aplicación

### Crear Producto con Múltiples Combinaciones

El formulario permite seleccionar:
1. Un material base
2. Múltiples variantes del material
3. Múltiples espesores para cada variante

Cada combinación se guarda como un registro independiente.

### Configurar Precios

En la pestaña "Precios":
1. Se muestran todas las combinaciones disponibles agrupadas por material
2. Cada fila representa una combinación única variante-espesor
3. Se puede configurar un precio independiente para cada fila
4. Los cambios se guardan de forma atómica

### Renderizado en Tabla

La tabla `MaterialesRigidosPreciosTable` muestra:
- Una fila por cada combinación
- Información de variante y espesor
- Precio de placa (editable)
- Precio por m² (calculado automáticamente)
- Indicador visual de cambios pendientes

## Notas Técnicas

- La normalización de espesores a 2 decimales evita problemas de comparación de punto flotante
- El sistema mantiene compatibilidad con código legacy mediante la columna `espesores` (array)
- Los hooks están optimizados para cargar datos en paralelo usando `Promise.all`
- El constraint único asegura que no pueda haber precios duplicados para la misma combinación

## Conclusión

El problema se resolvió exitosamente al actualizar el schema de precios para soportar múltiples combinaciones y ajustar los hooks para trabajar correctamente con la estructura normalizada. El sistema ahora puede manejar cualquier cantidad de combinaciones variante-espesor con sus respectivos precios independientes, proporcionando la flexibilidad necesaria para la gestión de productos de materiales rígidos.
