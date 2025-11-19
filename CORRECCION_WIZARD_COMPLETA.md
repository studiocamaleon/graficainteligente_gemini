# Corrección del Wizard de Items - Completa

## Fecha
19 de noviembre de 2025

## Resumen
Se han implementado correcciones críticas en el wizard de configuración de items para productos de Impresión Laser, mejorando el cálculo de precios, la validación y la captura de datos.

## Problemas Corregidos

### 1. Captura de IDs de Material y Variante

**Problema**: Los campos `material_id` y `variante_id` no se estaban capturando en el paso de búsqueda de productos, lo que causaba que faltaran datos importantes en la configuración final.

**Solución**:
- Actualizado el tipo `ProductSearchResult` en `src/types/wizard.ts` para incluir `material_id` y `variante_id`
- Modificado `useProductSearch.ts` para extraer y retornar estos IDs desde la base de datos
- Actualizado `handleProductSelect` en `AddItemWizard.tsx` para almacenar estos IDs en el estado

**Archivos modificados**:
- `src/types/wizard.ts`
- `src/hooks/wizard/useProductSearch.ts`
- `src/components/wizard/AddItemWizard.tsx`

### 2. Recálculo de Impactos de Servicios y Acabados

**Problema**: Cuando el precio base cambiaba (por ejemplo, al cambiar la cantidad y caer en un rango de precio diferente), los impactos de servicios y acabados que usan porcentajes no se recalculaban automáticamente.

**Solución**:
- Creada función `recalcularImpactosServiciosYAcabados` que recalcula todos los impactos basándose en el nuevo precio base
- Esta función se ejecuta automáticamente cada vez que se obtiene un nuevo precio base
- Los impactos recalculados se actualizan tanto en servicios como en acabados seleccionados
- El precio total se recalcula correctamente sumando: precio_base + servicios + acabados

**Archivos modificados**:
- `src/components/wizard/AddItemWizard.tsx`

### 3. Manejo de Precio Base Nulo

**Problema**: El cálculo de impactos podía fallar cuando `precio_base` era `null`, causando valores incorrectos.

**Solución**:
- En `handleSelectServicioNivel` y `handleSelectAcabadoNivel`, ahora se usa `const precioBase = state.config.precio_base || 0` para garantizar un valor numérico
- Esto permite calcular impactos incluso cuando no hay precio configurado (usando 0 como base)

**Archivos modificados**:
- `src/components/wizard/AddItemWizard.tsx`

### 4. Validación Simplificada de Servicios y Acabados

**Problema**: La validación de los pasos de servicios y acabados generaba warnings innecesarios cuando un servicio/acabado no tenía niveles configurados.

**Solución**:
- Eliminadas las validaciones que requerían nivel seleccionado
- Ahora solo se valida que el ID del servicio/acabado sea válido
- Los pasos de servicios y acabados son siempre válidos (son opcionales)

**Archivos modificados**:
- `src/hooks/wizard/useWizardValidation.ts`

### 5. Input de Cantidad Mejorado

**Problema**: Cuando el usuario borraba el valor en el input de cantidad, se establecía cantidad en 0, lo que causaba un estado inválido.

**Solución**:
- Modificado `handleInputChange` para que cuando el input esté vacío, no haga nada (no actualice el estado)
- Solo actualiza la cantidad cuando hay un número válido mayor a 0

**Archivos modificados**:
- `src/components/wizard/steps/QuantityStep.tsx`

## Flujo de Cálculo de Precio Mejorado

### Antes
1. Usuario configura producto (medida, tinta, cara, cantidad)
2. Se calcula precio base
3. Se suman impactos de servicios y acabados (calculados una sola vez)
4. Si cambiaba la cantidad, el precio base cambiaba pero los impactos porcentuales no

### Ahora
1. Usuario configura producto (medida, tinta, cara, cantidad)
2. Se calcula precio base
3. **Se recalculan automáticamente todos los impactos** basándose en el nuevo precio base
4. Se suman correctamente: precio_base + impactos_servicios + impactos_acabados
5. Si cualquier parámetro cambia, todo el proceso se repite correctamente

## Lógica de Cálculo de Impactos

```javascript
// Para cada servicio/acabado seleccionado:

if (tipo_impacto === 'porcentaje') {
  impacto = precio_base * (valor_porcentaje / 100)
}

if (tipo_impacto === 'monto_fijo') {
  impacto = valor_monto
}

if (tipo_impacto === 'ambos') {
  impacto = (precio_base * (valor_porcentaje / 100)) + valor_monto
}

// Total final:
precio_total = precio_base + sum(impactos_servicios) + sum(impactos_acabados)
```

## Casos de Uso Validados

### Caso 1: Producto con precio configurado
- ✅ Búsqueda y selección de producto
- ✅ Captura de material_id y variante_id
- ✅ Selección de cantidad y medida
- ✅ Configuración de tinta y caras
- ✅ Cálculo correcto de precio base
- ✅ Selección de servicios con niveles
- ✅ Recálculo automático de impactos
- ✅ Precio total correcto

### Caso 2: Producto sin precio configurado
- ✅ Permite completar todo el wizard
- ✅ Muestra advertencia clara
- ✅ Precio base = 0
- ✅ Servicios y acabados calculan sobre precio 0
- ✅ Permite agregar el item (para configurar precio después)

### Caso 3: Cambio de cantidad con servicios porcentuales
- ✅ Usuario selecciona cantidad 100 → precio base $500
- ✅ Usuario agrega servicio con 10% → impacto $50
- ✅ Usuario cambia cantidad a 500 → precio base $400 (descuento por volumen)
- ✅ **Impacto se recalcula automáticamente** → $40
- ✅ Precio total correcto: $440

### Caso 4: Servicios con tipo de impacto "ambos"
- ✅ Servicio con 10% + $100 fijo
- ✅ Con precio base $500: impacto = $50 + $100 = $150
- ✅ Si cambia precio base a $400: impacto = $40 + $100 = $140
- ✅ Recálculo automático funciona correctamente

## Mejoras Adicionales Implementadas

### 1. Consistencia en Manejo de Datos
- Todos los datos del producto se capturan completamente
- No se pierden IDs necesarios para operaciones posteriores
- La configuración final tiene toda la información necesaria

### 2. UX Mejorada
- El panel de precio se actualiza en tiempo real
- Los impactos se muestran correctamente actualizados
- No hay estados inconsistentes visibles al usuario

### 3. Robustez
- Manejo correcto de valores null
- Validaciones apropiadas sin ser excesivamente restrictivas
- Permite flujos válidos sin bloquear al usuario

## Estado del Proyecto

✅ Build exitoso sin errores
✅ Todas las correcciones aplicadas
✅ Tipos TypeScript correctos
✅ Lógica de negocio consistente
✅ UX mejorada

## Próximos Pasos Recomendados

### Fase 2: Extender a Otras Categorías
Una vez validado el wizard de Impresión Laser, se puede extender a:
1. Gran Formato
2. Materiales Rígidos
3. Plotter de Corte
4. Portabanners
5. Sellos

### Mejoras Futuras Opcionales
1. **Caché de precios**: Cachear consultas de precio para mejorar rendimiento
2. **Validación asíncrona**: Validar disponibilidad de stock en tiempo real
3. **Historial de configuraciones**: Guardar configuraciones frecuentes para reutilizar
4. **Plantillas**: Permitir guardar configuraciones como plantillas
5. **Sugerencias inteligentes**: Sugerir configuraciones basadas en historial del cliente

## Conclusión

El wizard de items ahora funciona correctamente con todas las validaciones y cálculos de precio necesarios. Los cambios implementados son retrocompatibles y mejoran significativamente la experiencia del usuario y la precisión de los datos capturados.

La arquitectura modular permite extender fácilmente el wizard a otras categorías de productos siguiendo el mismo patrón establecido.
