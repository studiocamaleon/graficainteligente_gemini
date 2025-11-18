# Solución: Precios no se calculan en el Wizard de Pedidos

## Problema Identificado

El wizard de pedidos no calcula precios para productos de Materiales Rígidos (ni para ningún otro producto).

### Diagnóstico

Se ejecutó un análisis completo de la base de datos y se encontró que:

**❌ La tabla `productos_precios` está vacía**

No hay registros de precios configurados en el sistema, por lo tanto:
- El hook `usePriceCalculator.ts` no encuentra precios para calcular
- Los logs muestran que la consulta SQL se ejecuta correctamente, pero no retorna datos
- El problema NO es del código del wizard, sino de datos faltantes en la base de datos

## Solución

Para que el wizard calcule precios correctamente, debes configurar los precios de tus productos a través de la interfaz del sistema:

### Pasos para Configurar Precios

#### 1. Para Productos de Materiales Rígidos

1. Ve a **Precios > Materiales Rígidos** en el menú principal
2. Selecciona el producto que deseas configurar
3. Configura los precios para cada combinación de:
   - Material
   - Variante del material
   - Espesor
   - Rango de metros cuadrados (si tiene descuentos por volumen)

#### 2. Para Productos de Gran Formato

1. Ve a **Precios > Gran Formato**
2. Selecciona el producto
3. Configura precios para cada combinación de:
   - Tecnología de impresión
   - Tipo de tinta
   - Cara de impresión
   - Rango de metros cuadrados (si aplica)

#### 3. Para Productos de Impresión Láser

1. Ve a **Precios > Impresión Láser**
2. Selecciona el producto
3. Configura precios según las cantidades fijas disponibles

### Estructura de Precios Requerida

La tabla `productos_precios` debe contener registros con la siguiente estructura:

```sql
CREATE TABLE productos_precios (
  id UUID PRIMARY KEY,
  producto_id UUID NOT NULL,
  material_id UUID,
  variante_nombre TEXT,
  tecnologia_id UUID,
  tipo_tinta TEXT,
  cara_impresion TEXT,
  cantidad INTEGER,
  rango_min NUMERIC,
  rango_max NUMERIC,
  precio_venta NUMERIC NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Ejemplo de Registro de Precio

Para un producto de Materiales Rígidos con las siguientes características:
- Material: Forex
- Variante: Blanco
- Espesor: 2mm
- Rango: 1-5 m²
- Precio: $150 por m²

El registro se vería así:

```sql
INSERT INTO productos_precios (
  producto_id,
  material_id,
  variante_nombre,
  rango_min,
  rango_max,
  precio_venta,
  company_id
) VALUES (
  'a33878e0-72ca-4563-8177-3c3b5e03639d',  -- ID del producto
  'a598a9df-2773-4965-8a2b-4c774e96e85e',  -- ID del material
  'Blanco',                                  -- Variante
  1,                                         -- Rango mínimo
  5,                                         -- Rango máximo
  150,                                       -- Precio por m²
  'company-uuid'                            -- ID de tu compañía
);
```

## Mejoras Implementadas

Se agregaron logs detallados en `usePriceCalculator.ts` para facilitar la depuración:

1. **`[getPrecioBaseRango]`**: Muestra los parámetros normalizados y el resultado de la consulta
2. **`[getPrecioConRangos]`**: Muestra el rango aplicable para la cantidad solicitada
3. **`[calculatePrice]`**: Muestra el inicio del cálculo con todos los parámetros

Estos logs te permitirán ver exactamente qué está buscando el sistema y por qué no encuentra precios.

## Verificación

Para verificar que los precios están correctamente configurados:

1. Ejecuta el script de diagnóstico:
   ```bash
   npx tsx scripts/diagnose-pricing.ts
   ```

2. El script te mostrará:
   - Cuántos productos tienen precios configurados
   - La estructura de precios de un producto de ejemplo
   - Una simulación de búsqueda como la que hace el wizard

3. Si todo está correcto, verás:
   ```
   ✅ Búsqueda exitosa:
      Precio encontrado: $XXX.XX
   ```

## Próximos Pasos

1. ✅ **Configurar precios**: Ve a la sección de Precios y configura los precios de tus productos
2. ✅ **Verificar**: Ejecuta el script de diagnóstico para confirmar
3. ✅ **Probar el wizard**: Crea un nuevo pedido y verifica que los precios se calculen correctamente

## Notas Técnicas

### Cómo Funciona el Cálculo de Precios

El sistema busca precios en la tabla `productos_precios` usando los siguientes filtros:

```typescript
// Para productos con unidad_pricing = 'mt2'
- producto_id
- material_id
- variante_nombre
- rango_min y rango_max (basado en los m² totales)
- tecnologia_id (null para materiales rígidos sin impresión)
- tipo_tinta (null para materiales rígidos sin impresión)
- cara_impresion (null para materiales rígidos)
```

Todos estos campos deben coincidir EXACTAMENTE con los valores almacenados en la base de datos. Si algún campo no coincide, la consulta no retornará resultados.

### Logs de Consola del Navegador

Cuando uses el wizard, abre las DevTools del navegador (F12) y observa la consola. Verás logs como:

```
[calculatePrice] Inicio: {...}
[getPrecioConRangos] DEBUG: {...}
[getPrecioConRangos] Rango aplicable: {min: 1, max: 5}
[getPrecioBaseRango] Parámetros normalizados: {...}
[getPrecioBaseRango] Resultado de consulta: {...}
```

Estos logs te ayudarán a identificar exactamente qué está buscando el sistema y si encuentra o no los precios.
