# Condiciones de Rutas de Producción

## Introducción

Las rutas de producción pueden incluir pasos obligatorios y pasos condicionales. Los pasos condicionales se ejecutan solo si se cumplen ciertas condiciones basadas en la configuración del producto elegido por el cliente.

---

## Tipos de Condiciones

### 1. Sin Condición (Obligatorio)

**Descripción:** El paso siempre se ejecuta como parte obligatoria de la ruta de producción.

**Cuándo usar:** Para pasos que SIEMPRE deben ejecutarse, independientemente de la configuración del producto.

**Ejemplos:**
- Control de calidad final
- Empaquetado
- Despacho

---

### 2. Servicio Sin Nivel de Precio

**Descripción:** El paso se ejecuta cuando el cliente selecciona un servicio específico que no tiene niveles de precio.

**Configuración:**
- Seleccionar el servicio específico

**Ejemplo:**
```
Servicio: Perforado
→ Si cliente elige "Perforado"
→ Ejecuta paso: "Perforación con Taladro"
```

---

### 3. Servicio Con Niveles de Precio

**Descripción:** El paso se ejecuta según el nivel de precio del servicio elegido por el cliente. Cada nivel puede tener un paso diferente.

**Configuración:**
- Seleccionar el servicio
- Ver los niveles configurados en ABM Core

**Ejemplo:**
```
Servicio: Laminado
  - Nivel "Básico" → Paso: "Laminado Estándar"
  - Nivel "Premium" → Paso: "Laminado Alta Calidad"
  - Nivel "Deluxe" → Paso: "Laminado Texturizado"

→ Si cliente elige "Laminado Premium"
→ Ejecuta paso: "Laminado Alta Calidad"
```

---

### 4. Acabado Sin Nivel de Precio

**Descripción:** El paso se ejecuta cuando el cliente selecciona un acabado específico que no tiene niveles de precio.

**Configuración:**
- Seleccionar el acabado específico

**Ejemplo:**
```
Acabado: Barnizado UV
→ Si cliente elige "Barnizado UV"
→ Ejecuta paso: "Aplicación de Barniz UV"
```

---

### 5. Acabado Con Niveles de Precio

**Descripción:** El paso se ejecuta según el nivel de precio del acabado elegido por el cliente. Cada nivel puede tener un paso diferente.

**Configuración:**
- Seleccionar el acabado
- Ver los niveles configurados en ABM Core

**Ejemplo:**
```
Acabado: Terminación de Bordes
  - Nivel "Standard" → Paso: "Corte Simple"
  - Nivel "Redondeado" → Paso: "Redondeado de Esquinas"
  - Nivel "Biselado" → Paso: "Biselado Completo"

→ Si cliente elige "Terminación de Bordes Redondeado"
→ Ejecuta paso: "Redondeado de Esquinas"
```

---

### 6. Tecnología + Tinta (Evaluación Automática) ⭐

**Descripción:** El sistema evalúa AUTOMÁTICAMENTE la tecnología y el tipo de tinta del producto seleccionado por el cliente, y ejecuta el paso correspondiente configurado en ABM Core → Tecnologías.

**🔑 Característica Principal:** Esta condición NO requiere seleccionar una tecnología específica. Funciona para TODAS las tecnologías configuradas en el sistema.

---

## Tecnología + Tinta - Funcionamiento Detallado

### ¿Cómo Funciona?

1. **Cliente elige un producto** (por ejemplo: "Banner UV 3x2m")
2. **Sistema identifica automáticamente:**
   - Tecnología del producto: `Impresión UV`
   - Tipo de tinta del producto: `CMYK+W`
3. **Sistema busca en configuración** `tecnologias_tintas_pasos`:
   - Combinación: `(Impresión UV, CMYK+W)`
   - Resultado: `"Impresión UV con Blanco"`
4. **Sistema ejecuta el paso encontrado:** `"Impresión UV con Blanco"`

### Configuración Previa Requerida

**En ABM Core → Tecnologías:**

Para cada tecnología, debes configurar qué paso se ejecuta para cada tipo de tinta:

```
Tecnología: Impresión UV
  ├─ K        → Paso: "Impresión UV Monocromática"
  ├─ CMYK     → Paso: "Impresión UV Full Color"
  ├─ CMYK+W   → Paso: "Impresión UV con Blanco"
  └─ CMYK+W+V → Paso: "Impresión UV con Blanco y Barniz"

Tecnología: Serigrafía
  ├─ K        → Paso: "Serigrafía Monocromática"
  └─ CMYK     → Paso: "Serigrafía Full Color"

Tecnología: Offset
  ├─ K        → Paso: "Offset Monocromático"
  └─ CMYK     → Paso: "Offset Full Color"
```

### En Ruta de Producción

Cuando agregas un paso con condición "Tecnología + Tinta (Evaluación Automática)":

**✅ LO QUE VES:**
- Alerta azul explicando la evaluación automática
- Lista completa de TODAS las tecnologías configuradas
- Para cada tecnología: sus tintas y pasos asignados
- Indicadores de configuraciones completas/incompletas

**❌ LO QUE NO VES:**
- ~~Selector para elegir UNA tecnología específica~~
- ~~Configuración que limite a una sola tecnología~~

**💡 IMPORTANTE:** No necesitas (ni puedes) seleccionar una tecnología. El sistema evaluará automáticamente la tecnología de CADA producto del cliente.

---

### Ejemplo Completo

**Escenario:** Imprenta que ofrece productos con diferentes tecnologías.

#### Paso 1: Configurar Tecnologías (ABM Core → Tecnologías)

```
Impresión UV:
  - K        → "Impresión UV Mono"
  - CMYK     → "Impresión UV Color"
  - CMYK+W   → "Impresión UV con Blanco"

Serigrafía:
  - K        → "Serigrafía Mono"
  - CMYK     → "Serigrafía Color"

Impresión Digital:
  - K        → "Digital Mono"
  - CMYK     → "Digital Color"
```

#### Paso 2: Crear Ruta de Producción

```
Ruta: "Impresión Genérica"
  Paso 1: Pre-prensa → "Diseño y Arte Final" (Obligatorio)
  Paso 2: Principal → CONDICIÓN: "Tecnología + Tinta (Evaluación Automática)"
  Paso 3: Post-prensa → "Control de Calidad" (Obligatorio)
```

#### Paso 3: Asignar Ruta a Productos

```
Producto A: "Banner UV"
  → Tecnología: Impresión UV
  → Ruta: "Impresión Genérica"

Producto B: "Vinilo Serigrafía"
  → Tecnología: Serigrafía
  → Ruta: "Impresión Genérica"

Producto C: "Cartel Digital"
  → Tecnología: Impresión Digital
  → Ruta: "Impresión Genérica"
```

#### Paso 4: Cliente Crea Orden

**Cliente elige:**
- 1x Banner UV (CMYK+W)
- 2x Vinilo Serigrafía (K)
- 3x Cartel Digital (CMYK)

**Rutas generadas:**

```
ITEM 1: Banner UV (CMYK+W)
  ✓ Diseño y Arte Final
  ✓ Impresión UV con Blanco     ← Evaluó: (UV, CMYK+W)
  ✓ Control de Calidad

ITEM 2: Vinilo Serigrafía (K) - Unidad 1
  ✓ Diseño y Arte Final
  ✓ Serigrafía Mono             ← Evaluó: (Serigrafía, K)
  ✓ Control de Calidad

ITEM 2: Vinilo Serigrafía (K) - Unidad 2
  ✓ Diseño y Arte Final
  ✓ Serigrafía Mono             ← Evaluó: (Serigrafía, K)
  ✓ Control de Calidad

ITEM 3: Cartel Digital (CMYK) - Unidad 1
  ✓ Diseño y Arte Final
  ✓ Digital Color                ← Evaluó: (Digital, CMYK)
  ✓ Control de Calidad

... (repite para las 3 unidades)
```

**Resultado:** Cada producto ejecutó el paso correcto según su tecnología y tinta, ¡sin necesidad de crear rutas separadas para cada tecnología!

---

### Ventajas de Este Enfoque

**1. Reutilización de Rutas:**
- Una sola ruta sirve para múltiples tecnologías
- No necesitas crear "Ruta UV", "Ruta Serigrafía", etc.
- Mantenimiento centralizado

**2. Flexibilidad:**
- Agregas nueva tecnología en ABM Core
- Automáticamente funciona con rutas existentes
- Sin modificar rutas de producción

**3. Escalabilidad:**
- Soporta ilimitadas combinaciones (tecnología, tinta)
- Cada producto evalúa su propia configuración
- Sin límites ni restricciones

**4. Claridad:**
- UI muestra TODAS las posibles evaluaciones
- Usuario sabe exactamente qué pasará
- Sin confusiones sobre qué tecnología se evalúa

---

### Casos de Uso Reales

#### Caso 1: Imprenta Multitecnología

```
Tecnologías: UV, Látex, Ecosolvente, Sublimación
Productos: 50+ diferentes
Rutas: Solo 3 (según tipo de material)

→ Gracias a "Tecnología + Tinta", las 3 rutas sirven para todas las tecnologías
→ Sin esta condición: necesitarías 4 rutas × 3 tipos = 12 rutas diferentes
```

#### Caso 2: Centro de Copiado con Opciones

```
Tecnologías: Laser B/N, Laser Color, Inkjet
Servicios adicionales: Laminado, Anillado, Perforado

Ruta única que:
  - Evalúa tecnología + tinta → Paso de impresión correcto
  - Evalúa laminado → Si cliente lo pidió
  - Evalúa anillado → Si cliente lo pidió

→ Una sola ruta para todos los casos
```

#### Caso 3: Señalética Variada

```
Materiales: Rígidos (UV), Flexibles (Látex), Telas (Sublimación)
Tintas: K, CMYK, CMYK+W

→ Cada material puede usar su tecnología apropiada
→ Sistema evalúa automáticamente y asigna paso correcto
→ Sin limitar opciones ni crear complejidad
```

---

## Errores Comunes y Soluciones

### ❌ Error: "Esta tecnología no tiene tintas configuradas"

**Causa:** La tecnología existe en el sistema pero no tiene configurados los tipos de tinta con sus pasos.

**Solución:**
1. Ir a ABM Core → Tecnologías
2. Editar la tecnología
3. En sección "Configuración de Pasos por Tinta":
   - Seleccionar las tintas que usa esta tecnología
   - Asignar un paso a cada tinta
4. Guardar

---

### ❌ Error: "Tintas sin paso asignado"

**Causa:** La tecnología tiene tintas pero algunas no tienen paso configurado.

**Solución:**
1. Ir a ABM Core → Tecnologías
2. Editar la tecnología
3. Completar las tintas faltantes
4. Todas las tintas deben tener un paso asignado

---

### ❌ Problema: El paso condicional no se ejecuta

**Posibles causas:**

1. **El producto no tiene tecnología asignada**
   - Verificar en el producto que tiene `tecnologia_id`

2. **El producto no tiene tipo de tinta configurado**
   - Verificar que el producto tiene `tipo_tinta` o `tinta`

3. **La combinación (tecnología, tinta) no existe en BD**
   - Verificar en `tecnologias_tintas_pasos` que existe la combinación
   - Agregar la combinación si falta

4. **El paso asignado está inactivo**
   - Verificar que el paso en `pasos` tiene `activo = true`

---

## Preguntas Frecuentes

### ¿Puedo limitar la evaluación a una sola tecnología?

**No.** Esta condición evalúa TODAS las tecnologías del sistema. Si necesitas limitar a una tecnología específica, usa otra estrategia:

- Opción 1: Crear ruta específica para esa tecnología
- Opción 2: Usar servicios/acabados para diferenciar

### ¿Qué pasa si un producto usa una tecnología sin configurar?

El paso condicional simplemente **no se incluirá** en la ruta de ese item. Los pasos obligatorios sí se ejecutarán normalmente.

### ¿Puedo tener múltiples pasos con "Tecnología + Tinta"?

**Sí.** Puedes tener varios pasos condicionales de este tipo en la misma ruta. Cada uno evaluará independientemente.

Ejemplo:
```
Ruta: "Producción Completa"
  Paso 1: Pre-prensa (Obligatorio)
  Paso 2: CONDICIÓN "Tecnología + Tinta" → Impresión
  Paso 3: CONDICIÓN "Tecnología + Tinta" → Secado específico por tecnología
  Paso 4: Post-prensa (Obligatorio)
```

### ¿Cómo sé qué tecnologías están configuradas correctamente?

En la interfaz de configuración de rutas, al seleccionar "Tecnología + Tinta (Evaluación Automática)", verás:

- ✅ Badge verde "Completo" = Todas las tintas tienen paso asignado
- ⚠️ Badge naranja con contador = Faltan tintas por configurar
- 🔗 Link directo a ABM Core para completar configuración

---

## Mejores Prácticas

### 1. Nombrar Pasos Descriptivamente

**❌ Mal:**
```
Paso: "Impresión"  (ambiguo)
```

**✅ Bien:**
```
Paso: "Impresión UV CMYK+W"  (específico)
Paso: "Impresión Serigrafía K"  (específico)
```

### 2. Configurar TODAS las Tintas

Antes de usar una tecnología en producción, asegúrate de configurar TODOS los tipos de tinta que esa tecnología puede usar.

### 3. Mantener Consistencia en Etapas

Los pasos de impresión normalmente van en etapa **"principal"**. Mantén consistencia para facilitar el orden de ejecución.

### 4. Documentar Tecnologías Especiales

Si una tecnología tiene requisitos especiales (ej: requiere secado prolongado), documéntalo en el campo de notas o código de la tecnología.

### 5. Revisar Configuración Periódicamente

Cuando agregas una nueva tecnología al sistema:
- Configura sus tintas inmediatamente
- Verifica que las rutas existentes la incluyen correctamente
- Prueba con una orden de ejemplo

---

## Conclusión

La condición "Tecnología + Tinta (Evaluación Automática)" es una herramienta poderosa para crear rutas de producción flexibles y escalables. Permite que una sola ruta soporte múltiples tecnologías sin duplicación ni complejidad.

**Recuerda:**
- ✅ Configura primero las tecnologías en ABM Core
- ✅ Asigna pasos a TODAS las tintas de cada tecnología
- ✅ No necesitas seleccionar una tecnología específica
- ✅ El sistema evalúa automáticamente cada producto
- ✅ Una ruta puede servir para todas tus tecnologías

**Para más ayuda:** Consulta la documentación de ABM Core → Tecnologías o contacta al equipo de soporte.
