# Problema de Precios en el Wizard - Resuelto

## Problema Identificado

El sistema mostraba el error: **"No se encontró precio para los parámetros especificados"** cuando se intentaba calcular el precio de un producto de Material Rígido en el wizard de creación de órdenes.

## Causa Raíz

Después de ejecutar diagnósticos exhaustivos, se identificó que **no hay productos creados en la base de datos**. El error se debe a que:

1. El `productoId` utilizado en el wizard (`a33878e0-72ca-4563-8177-3c3b5e03639d`) no existe en la tabla `productos`
2. No hay materiales creados en la tabla `materiales`
3. No hay precios configurados en la tabla `productos_precios`

En resumen: **el sistema está intentando calcular precios para productos que aún no han sido creados**.

## Solución Implementada

Se han realizado las siguientes mejoras al sistema:

### 1. Mejor Manejo de Errores

Se agregó logging más detallado en `usePriceCalculator.ts` para identificar exactamente cuándo y por qué fallan las búsquedas de precios:

- `getPrecioBase`: Ahora muestra advertencias claras cuando no encuentra un precio
- `getPrecioBaseRango`: Incluye mensajes informativos sobre posibles causas del problema
- `calculatePrice`: Muestra una guía de verificación cuando el precio base es 0

### 2. Corrección en la Lógica de Rangos

Se mejoró la función `getPrecioBaseRango` para:
- Manejar correctamente valores `null` en `rango_max` (rangos ilimitados)
- Proporcionar mejor feedback sobre por qué no se encuentran precios
- Separar la lógica de filtrado para mayor claridad

### 3. Scripts de Diagnóstico

Se crearon dos scripts útiles para diagnosticar problemas:

**`scripts/diagnose-pricing-issue.ts`**
```bash
npx tsx scripts/diagnose-pricing-issue.ts
```
Verifica un producto específico y sus precios configurados.

**`scripts/list-existing-products.ts`**
```bash
npx tsx scripts/list-existing-products.ts
```
Lista todos los productos, materiales y rangos de precio existentes en la base de datos.

## Pasos para Resolver el Problema

Para que el sistema funcione correctamente, debes seguir estos pasos en orden:

### 1. Crear Materiales (si es para Materiales Rígidos)

Ve a **Sistema > Materiales** y crea los materiales que necesitas:
- Forex
- PVC
- Dibond
- etc.

Para cada material, define sus variantes (por ejemplo: "Blanco", "Negro", "Transparente").

### 2. Crear Rangos de Precio (si usarás descuentos por volumen)

Ve a **Sistema > Rangos de Precio** y crea los rangos:
- Nombre: Por ejemplo "Rangos Gran Formato"
- Define los rangos: `[{min: 1, max: 5}, {min: 5.01, max: 20}, {min: 20.01, max: null}]`

### 3. Crear Productos

Ve a **Catálogo > Materiales Rígidos** (o la categoría correspondiente) y crea tus productos:
- Nombre: Por ejemplo "Impresión sobre Forex"
- Tipo de medida: "Superficie Variable (m²)"
- Configuración de precios:
  - Unidad de pricing: "Metro cuadrado (m²)"
  - ¿Tiene descuentos por volumen?: Sí/No
  - Si tiene descuentos, selecciona el rango de precio

### 4. Configurar Precios

Ve a **Precios > Materiales Rígidos** y configura los precios para cada producto:
- Selecciona el producto
- Para cada combinación de material, variante y rango (si aplica):
  - Ingresa el precio por m²
- Guarda los cambios

### 5. Probar el Wizard

Ahora puedes ir a **Pedidos > Crear Orden** y usar el wizard:
- Selecciona el producto
- Elige el material y variante
- Ingresa las medidas
- El sistema calculará el precio correctamente

## Verificación

Para verificar que todo está configurado correctamente:

```bash
npx tsx scripts/list-existing-products.ts
```

Deberías ver:
- ✅ Productos listados
- ✅ Materiales disponibles
- ✅ Rangos de precio configurados
- ✅ Precios configurados para cada producto

## Mensajes de Error Mejorados

Ahora, cuando el sistema no encuentre un precio, mostrará en la consola del navegador mensajes claros como:

```
[getPrecioBase] No se encontró precio base para los parámetros especificados
[getPrecioBase] Parámetros: {...}

[calculatePrice] No se encontró precio base. Verifica que:
  1. El producto existe en la base de datos
  2. Se han configurado precios para este producto en la sección de Precios
  3. Los parámetros de búsqueda (material, variante, cantidad, etc.) coinciden con los precios configurados
```

## Conclusión

El error no era un bug en el código, sino que **el sistema necesita datos para funcionar**. Los cambios implementados:

1. ✅ Mejoran el manejo de errores
2. ✅ Proporcionan mensajes más claros al usuario
3. ✅ Incluyen herramientas de diagnóstico
4. ✅ Documentan el flujo correcto de configuración

Una vez que sigas los pasos para crear productos, materiales y configurar precios, el wizard funcionará perfectamente.
