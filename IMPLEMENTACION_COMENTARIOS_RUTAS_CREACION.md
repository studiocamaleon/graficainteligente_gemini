# Implementación: Comentarios en Rutas de Producción Durante Creación de Orden

## Resumen

Se ha implementado la funcionalidad para que los vendedores puedan agregar comentarios opcionales a los pasos de producción **durante la creación de una orden**, antes de que esta sea guardada en la base de datos.

**Motivación:**
El vendedor que toma un pedido necesita comunicar aclaraciones importantes del cliente directamente al operador que ejecutará cada paso de producción. Por ejemplo: "Cliente solicita impresión más saturada", "Verificar antes de cortar", "Incluir muestra de color".

---

## Archivos Creados

### 1. `src/hooks/useItemRoutesComments.ts` (NUEVO)

**Propósito:** Hook personalizado para gestionar comentarios de rutas en el estado local durante la creación.

**Funciones exportadas:**
```typescript
{
  updateStepComment: (itemIndex, stepId, comment) => void
  getStepComment: (itemIndex, stepId) => string | null
  countItemComments: (itemIndex) => number
  countAllComments: () => number
}
```

**Responsabilidades:**
- Actualizar comentario de un paso específico en el estado local
- Obtener comentario actual de un paso
- Contar cuántos comentarios tiene un item
- Contar total de comentarios en todos los items

---

### 2. `src/components/orders/StepCommentIndicator.tsx` (NUEVO)

**Propósito:** Badge visual que indica cuando un paso tiene comentario agregado.

**Características:**
- Muestra badge azul con ícono de mensaje
- Solo visible cuando hay comentario
- Diseño consistente con el sistema de diseño

**Ejemplo visual:**
```
[💬 Comentario]  ← Badge azul pequeño
```

---

## Archivos Modificados

### 3. `src/hooks/useGenerateProductionRoute.ts`

**Cambios en interface GeneratedStep:**
```typescript
export interface GeneratedStep {
  // ... campos existentes
  comentario_vendedor?: string | null;      // ← NUEVO
  origen_plantilla_id?: string | null;      // ← NUEVO
}
```

**Inicialización de campos nuevos:**
```typescript
return {
  // ... campos existentes
  comentario_vendedor: null,
  origen_plantilla_id: rutaId,
};
```

**Beneficio:** Los pasos generados incluyen el campo para comentarios desde el inicio.

---

### 4. `src/components/orders/OrdenRutasTab.tsx`

**Cambios en props:**
```typescript
interface OrdenRutasTabProps {
  items: any[];
  onUpdateStepComment?: (itemIndex, stepId, comment) => void;  // ← NUEVO
  readOnly?: boolean;                                           // ← NUEVO
}
```

**Nuevas funcionalidades:**

#### a) Contador de comentarios por item
```typescript
const commentCount = stepsWithComments.filter(
  s => s.comentario_vendedor && s.comentario_vendedor.trim().length > 0
).length;
```

Muestra junto al número de pasos:
```
✓ 5 pasos  💬 2 comentarios
```

#### b) Highlight visual en pasos con comentario
```typescript
className={`... ${
  tieneComentario
    ? 'bg-blue-50 border-blue-200'    // Con comentario
    : 'bg-gray-50 border-gray-200'    // Sin comentario
}`}
```

#### c) Editor de comentarios integrado
```typescript
{!readOnly && onUpdateStepComment && (
  <div className="ml-9 mr-3">
    <StepCommentEditor
      comentario={pasoConComentario.comentario_vendedor || null}
      onSave={async (comentario) => {
        onUpdateStepComment(index, paso.id, comentario);
      }}
      disabled={false}
    />
  </div>
)}
```

#### d) Indicador visual en header del paso
```typescript
<StepCommentIndicator hasComment={tieneComentario} />
```

**Mensaje informativo actualizado:**
```
"Estas rutas se generarán automáticamente en la base de datos al crear la orden.
Los pasos se evalúan según los servicios y acabados seleccionados en cada producto.
Puedes agregar comentarios opcionales en cada paso para el operador de producción."
```

---

### 5. `src/pages/app/orders/CreateOrderPage.tsx`

**Imports agregados:**
```typescript
import { useItemRoutesComments } from '../../../hooks/useItemRoutesComments';
```

**Uso del hook:**
```typescript
const { updateStepComment, countAllComments } = useItemRoutesComments({
  items,
  setItems,
});
```

**Badge en tab de Rutas:**
```typescript
const totalComentarios = countAllComments();

{
  id: 'rutas',
  label: 'Rutas de Producción',
  disabled: items.length === 0,
  badge: totalComentarios > 0 ? totalComentarios : undefined,  // ← NUEVO
}
```

**Muestra:** `Rutas de Producción (3)` cuando hay 3 comentarios totales.

**Conexión con OrdenRutasTab:**
```typescript
<OrdenRutasTab
  items={items}
  onUpdateStepComment={updateStepComment}  // ← NUEVO
  readOnly={false}                         // ← NUEVO
/>
```

---

### 6. `src/hooks/useOrdenTrabajo.ts`

**Cambio crítico en createOrdenConItems:**

```typescript
// ANTES:
comentario_vendedor: null,

// DESPUÉS:
comentario_vendedor: ruta.comentario_vendedor || null,
```

**Código completo:**
```typescript
const rutasToInsert = itemOriginal.rutas_generadas.map((ruta: any) => ({
  company_id: profile.company_id,
  orden_item_id: item.id,
  tipo_etapa: ruta.etapa,
  paso_id: ruta.paso_id,
  paso_nombre: ruta.paso_nombre,
  orden: ruta.orden,
  es_modificado: false,
  origen_plantilla_id: ruta.origen_plantilla_id || null,
  comentario_vendedor: ruta.comentario_vendedor || null,  // ← ACTUALIZADO
}));
```

**Resultado:** Los comentarios agregados durante la creación se insertan en la tabla `ordenes_trabajo_items_rutas` al crear la orden.

---

## Flujo de Usuario Completo

### Escenario: Vendedor crea orden con instrucciones especiales

#### **Paso 1: Agregar Items**

```
[Tab: Items]
- Vendedor agrega "Tarjetas personales x1000"
- Sistema genera automáticamente rutas de producción en background
```

---

#### **Paso 2: Navegar a Tab "Rutas de Producción"**

```
[Tab: Rutas de Producción]

Vista previa muestra:
┌─────────────────────────────────────────┐
│ ℹ️  Vista previa de rutas de producción│
│                                         │
│ Estas rutas se generarán automáticamen-│
│ te al crear la orden. Puedes agregar   │
│ comentarios opcionales en cada paso.   │
└─────────────────────────────────────────┘

Item #1: Tarjetas personales
Cantidad: 1000    ✓ 5 pasos
```

---

#### **Paso 3: Agregar Comentarios (Opcional)**

**Pre-prensa:**
```
┌─────────────────────────────────────────┐
│ 1  Diseño                    [Obligatorio]│
│                                         │
│    [Click para agregar comentario...]  │
│                                         │
│    → Usuario hace click                │
│    → Aparece editor de texto           │
│    → Escribe: "Cliente solicita logo   │
│      más grande que en la muestra"     │
│    → Guarda con Ctrl+Enter             │
└─────────────────────────────────────────┘

Resultado:
┌─────────────────────────────────────────┐
│ 1  Diseño  [Obligatorio] [💬 Comentario]│
│    ← Card ahora tiene fondo azul claro │
│                                         │
│    💬 "Cliente solicita logo más grande│
│        que en la muestra"              │
│    ← Comentario visible                │
└─────────────────────────────────────────┘
```

**Producción:**
```
┌─────────────────────────────────────────┐
│ 2  Impresión CMYK                       │
│                                         │
│    [Sin comentario] ← Paso sin comentario
└─────────────────────────────────────────┘
```

**Terminación:**
```
┌─────────────────────────────────────────┐
│ 3  Corte                                │
│                                         │
│    [Click para agregar comentario...]  │
│                                         │
│    → Usuario agrega:                   │
│    "Verificar esquinas - cliente muy   │
│     exigente con terminaciones"        │
└─────────────────────────────────────────┘
```

---

#### **Paso 4: Visualización de Contador**

```
Header del item ahora muestra:
┌─────────────────────────────────────────┐
│ 1  Tarjetas personales                  │
│    Cantidad: 1000                       │
│    ✓ 5 pasos  💬 2 comentarios         │
│    ↑ Contador actualizado               │
└─────────────────────────────────────────┘

Tab "Rutas de Producción" ahora muestra:
[Rutas de Producción (2)]
                       ↑ Badge con total
```

---

#### **Paso 5: Crear Orden**

```
- Vendedor completa datos generales
- Click en "Crear Orden"
- Sistema ejecuta:

  INSERT INTO ordenes_trabajo (...)
  INSERT INTO ordenes_trabajo_items (...)
  INSERT INTO ordenes_trabajo_items_rutas VALUES
    (..., paso_nombre: 'Diseño',
     comentario_vendedor: 'Cliente solicita logo más grande...'),
    (..., paso_nombre: 'Impresión',
     comentario_vendedor: NULL),
    (..., paso_nombre: 'Corte',
     comentario_vendedor: 'Verificar esquinas - cliente muy exigente...')

✅ Orden #ORD-2024-123 creada exitosamente
```

---

#### **Paso 6: Operador ve la Orden**

**Vista Kanban:**
```
┌───────────────────────────┐
│ [→ Diseño]    #ORD-123    │ ← Primer paso
│ Cliente: López            │
│ 📦 Tarjetas personales    │
│ ░░░░░░░░░░ 0%            │
└───────────────────────────┘
```

**Al abrir detalle del Job:**
```
Job #ORD-2024-123 - Item #1
─────────────────────────────

Pre-prensa
  1. Diseño                    [Pendiente]

     💬 Comentario del vendedor:
     "Cliente solicita logo más grande que en la muestra"

     [Iniciar Paso]

Producción
  2. Impresión CMYK           [Bloqueado]
     (Sin comentarios)

Terminación
  3. Corte                    [Bloqueado]

     💬 Comentario del vendedor:
     "Verificar esquinas - cliente muy exigente con terminaciones"
```

---

## Características Implementadas

### ✅ Funcionalidad Core

1. **Agregar comentarios durante creación**
   - Click en área de comentario abre editor
   - Textarea con límite de 500 caracteres
   - Guardado con Ctrl+Enter o botón
   - Cancelación con Esc o botón

2. **Visualización de comentarios**
   - Indicador visual en pasos con comentario
   - Highlight con fondo azul en cards con comentario
   - Badge "Comentario" junto al nombre del paso

3. **Contadores automáticos**
   - Contador por item (muestra cuántos pasos tienen comentario)
   - Contador total en badge del tab
   - Actualización en tiempo real al agregar/editar

4. **Persistencia**
   - Comentarios se guardan en estado local durante creación
   - Se insertan en BD al crear la orden
   - Campo `comentario_vendedor` en tabla `ordenes_trabajo_items_rutas`

---

### ✅ UX/UI

1. **Feedback Visual**
   - Cards cambian de gris a azul cuando tienen comentario
   - Badge azul indica "Comentario" junto al nombre del paso
   - Contador en header del item: `💬 2 comentarios`
   - Badge en tab: `Rutas de Producción (5)`

2. **Modo Edición Intuitivo**
   - Click en cualquier parte del área activa el editor
   - Auto-focus en textarea
   - Atajos de teclado (Ctrl+Enter, Esc)
   - Contador de caracteres (0/500)

3. **Estados Visuales**
   - Placeholder sugerente: "Click para agregar comentario..."
   - Loading state mientras guarda
   - Disabled state cuando no se puede editar

---

### ✅ Modo Read-Only

La prop `readOnly` permite reutilizar el componente:

```typescript
// Durante creación (editable)
<OrdenRutasTab items={items} readOnly={false} />

// En vista de detalle (solo lectura)
<OrdenRutasTab items={items} readOnly={true} />
```

---

## Compatibilidad y Seguridad

### ✅ Base de Datos

**Campo ya existente:**
```sql
ordenes_trabajo_items_rutas {
  comentario_vendedor text | null
}
```

**Retrocompatible:**
- Valores null son perfectamente válidos
- Órdenes antiguas sin comentarios funcionan sin cambios
- No requiere migración de datos existentes

---

### ✅ Validación

**Límites implementados:**
- Máximo 500 caracteres por comentario
- Validación en frontend (StepCommentEditor)
- Trimming automático de espacios

**Opcional:**
- Comentarios no son obligatorios
- No bloquea la creación de la orden
- Se puede crear orden sin ningún comentario

---

### ✅ Seguridad

**Sanitización:**
- StepCommentEditor maneja input seguro
- Texto plano (no HTML)
- No permite scripts ni código

**Permisos:**
- Solo usuarios autenticados pueden crear órdenes
- Solo usuarios autenticados pueden agregar comentarios
- Los comentarios se asocian al vendedor que crea la orden

---

## Casos de Uso Reales

### Caso 1: Color específico
```
Paso: Impresión
Comentario: "Cliente necesita pantone 285C exacto - tiene muestra física en archivo"
```

### Caso 2: Material delicado
```
Paso: Plastificado
Comentario: "Aplicar con cuidado - papel es sensible al calor"
```

### Caso 3: Instrucción de entrega
```
Paso: Empaque
Comentario: "Cliente retira personalmente mañana 10am - separar de otros pedidos"
```

### Caso 4: Control de calidad
```
Paso: Control de Calidad
Comentario: "Cliente muy exigente - verificar cada unidad antes de entregar"
```

### Caso 5: Especificación técnica
```
Paso: Corte
Comentario: "Esquinas redondeadas radio 5mm - cliente rechazó muestra anterior"
```

---

## Beneficios

### 1. Comunicación Directa
- El vendedor transmite información crítica directamente al operador
- Reduce malentendidos y consultas posteriores
- Evita errores por falta de comunicación

### 2. Trazabilidad
- Queda registro permanente de instrucciones especiales
- Se puede auditar qué se comunicó y cuándo
- Ayuda en caso de disputas con clientes

### 3. Flexibilidad
- Comentarios son opcionales - no agregan fricción
- Se pueden agregar solo donde sean relevantes
- No requiere cambiar el flujo de trabajo existente

### 4. Reduce Errores y Reprocesos
- Información clave llega al momento correcto
- Operador tiene contexto antes de empezar el trabajo
- Menos posibilidad de malinterpretar requisitos del cliente

### 5. Mejora Experiencia del Cliente
- Sus solicitudes especiales quedan registradas
- Reduce probabilidad de entregas incorrectas
- Mayor satisfacción con el resultado final

---

## Testing Sugerido

### Tests Funcionales

✅ **Agregar comentario:**
1. Crear nueva orden
2. Agregar item
3. Ir a tab "Rutas de Producción"
4. Click en "Agregar comentario" en un paso
5. Escribir texto
6. Guardar con Ctrl+Enter
7. Verificar que aparece en UI
8. Verificar que contador aumenta

✅ **Editar comentario:**
1. Click en comentario existente
2. Modificar texto
3. Guardar
4. Verificar actualización

✅ **Cancelar edición:**
1. Click en comentario
2. Modificar texto
3. Presionar Esc
4. Verificar que vuelve al original

✅ **Crear orden con comentarios:**
1. Agregar 2 items
2. Agregar comentarios en 3 pasos diferentes
3. Completar datos generales
4. Crear orden
5. Verificar en BD que se insertaron correctamente

✅ **Visualización post-creación:**
1. Abrir orden creada
2. Ir a detalle de item
3. Verificar que comentarios son visibles
4. Verificar que se pueden editar

✅ **Contadores:**
1. Badge en tab actualiza correctamente
2. Contador por item correcto
3. Actualización en tiempo real

---

## Próximas Mejoras Potenciales

### 1. Notificaciones
- Notificar al operador cuando hay comentario en paso activo
- Highlight visual en modal de ejecución

### 2. Historial de Ediciones
- Registrar quién editó comentarios y cuándo
- Mostrar versiones anteriores

### 3. Templates de Comentarios
- Comentarios frecuentes pre-configurados
- Selector rápido de frases comunes

### 4. Adjuntos
- Permitir adjuntar imágenes a comentarios
- Útil para muestras de color, referencias visuales

### 5. Menciones
- Poder mencionar a operadores específicos (@usuario)
- Notificación directa al usuario mencionado

---

## Conclusión

La implementación permite que los vendedores comuniquen eficientemente requisitos especiales del cliente directamente a los operadores de producción, mejorando la calidad del servicio y reduciendo errores.

**Características clave:**
- ✅ Opcional y no intrusivo
- ✅ Integrado naturalmente en el flujo existente
- ✅ Reutiliza componentes existentes (StepCommentEditor)
- ✅ Sin cambios en base de datos (campo ya existía)
- ✅ Retrocompatible con órdenes antiguas
- ✅ Compilación exitosa sin errores

La funcionalidad está lista para usar en producción! 🚀
