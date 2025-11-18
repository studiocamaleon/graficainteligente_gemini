# Corrección de Problemas en Productos Materiales Rígidos

**Fecha:** 2025-11-17

## Problemas Identificados

### 1. Producto Acrílico
- **Problema:** No se mostraba correctamente en la interfaz
- **Causa:** El producto existe en la base de datos pero sin combinaciones configuradas (0 registros en `productos_materiales_rigidos_materiales`)
- **Estado del Material Base:** El material "Acrílico" existe con 5 variantes disponibles:
  - Cristal: [2, 3, 4, 5, 6, 8]mm
  - Opalino / Traslucido: [2, 3, 4]mm
  - Negro: [2, 3]mm
  - Espejado Plata: [2]mm
  - Espejado Oro: [3]mm

### 2. Producto PVC Espumado
- **Problema:** Mostraba espesores incorrectos y "3 combinaciones seleccionadas" cuando solo debería tener 1
- **Causa:** Tenía combinaciones guardadas con espesores que no existen en la configuración del material base
- **Configuración del Material Base:** PVC Espumado - Variante Blanco: [2, 3]mm
- **Combinaciones Guardadas (incorrectas):**
  - Blanco 3mm ✅ (válido)
  - Blanco 5mm ❌ (no existe en el material base)
  - Blanco 10mm ❌ (no existe en el material base)

## Soluciones Implementadas

### 1. Limpieza de Datos en Base de Datos

```sql
-- Eliminadas las combinaciones inválidas del producto PVC Espumado
DELETE FROM productos_materiales_rigidos_materiales
WHERE producto_materiales_rigidos_id = '94e1858d-e744-4423-9af0-4dbf71f76b08'
  AND espesor NOT IN (2, 3);
```

**Resultado:**
- Producto PVC Espumado ahora tiene solo 1 combinación válida: Blanco 3mm
- Eliminadas 2 combinaciones inválidas (5mm y 10mm)

### 2. Mejoras en el Componente MaterialVarianteEspesorSelector

**Archivo modificado:** `src/components/productos/materiales-rigidos/MaterialVarianteEspesorSelector.tsx`

**Cambios implementados:**

1. **Detección Automática de Combinaciones Inválidas:**
   - Al cargar un producto para edición, el componente ahora valida cada combinación guardada contra la configuración actual del material base
   - Identifica combinaciones con espesores que ya no existen
   - Identifica combinaciones de variantes que ya no están disponibles

2. **Filtrado Automático:**
   - Las combinaciones inválidas se filtran automáticamente
   - Solo las combinaciones válidas se cargan en el selector
   - El contador de combinaciones ahora refleja solo las combinaciones válidas

3. **Advertencias Visuales:**
   - Se muestra un panel de advertencia cuando se detectan combinaciones inválidas
   - El panel lista todas las combinaciones problemáticas con detalles
   - Informa al usuario que estas combinaciones serán eliminadas al guardar
   - Sugiere actualizar el material base si esos espesores son necesarios

**Código agregado:**

```typescript
interface CombinacionInvalida {
  variante: string;
  espesor: number;
}

const [combinacionesInvalidas, setCombinacionesInvalidas] = useState<CombinacionInvalida[]>([]);

// Lógica de validación en useEffect
const combinacionesValidas: VarianteEspesorCombinacion[] = [];
combinaciones.forEach((comb) => {
  const varianteExistente = variantesMap.get(comb.variante_nombre);
  if (varianteExistente) {
    if (varianteExistente.espesoresDisponibles.includes(comb.espesor)) {
      varianteExistente.espesoresSeleccionados.push(comb.espesor);
      combinacionesValidas.push(comb);
    } else {
      invalidas.push({
        variante: comb.variante_nombre,
        espesor: comb.espesor,
      });
    }
  }
});

// Notificar al padre solo con combinaciones válidas
if (invalidas.length > 0) {
  onChange(materialId, combinacionesValidas);
}
```

### 3. Scripts de Diagnóstico Creados

**Archivos creados:**

1. **`scripts/diagnose-materiales-rigidos.ts`**
   - Script completo de diagnóstico para productos materiales rígidos
   - Muestra todos los productos, sus combinaciones, y detecta duplicados
   - Verifica integridad de referencias a materiales base
   - Lista precios configurados

2. **`scripts/verify-materiales-rigidos-fix.ts`**
   - Script de verificación post-corrección
   - Valida que las combinaciones son correctas
   - Compara contra configuración del material base
   - Genera reporte de estado actual

## Estado Actual de la Base de Datos

### Productos Materiales Rígidos

| Producto | Estado | Combinaciones |
|----------|--------|---------------|
| Acrílico | ✅ Activo | 0 (pendiente configuración) |
| PVC Espumado | ✅ Activo | 1 (Blanco 3mm) |

### Verificación de Validez

**PVC Espumado:**
- ✅ Todas las combinaciones son válidas según el material base
- Configuración: Blanco 3mm (existe en material base: [2, 3]mm)

**Acrílico:**
- ⚠️  Sin combinaciones configuradas
- Material base disponible con 5 variantes listas para configurar

## Acciones Pendientes para el Usuario

1. **Producto Acrílico:**
   - Acceder al módulo de Productos > Materiales Rígidos
   - Editar el producto Acrílico
   - Seleccionar las combinaciones de variantes y espesores deseadas
   - Guardar el producto

2. **Producto PVC Espumado:**
   - Verificar que la combinación actual (Blanco 3mm) es la correcta
   - Si necesita agregar más espesores (ej: 5mm, 10mm):
     - Primero actualizar el material base "PVC Espumado" en ABM Core > Materiales
     - Agregar los espesores deseados a la variante Blanco
     - Luego editar el producto y seleccionar las nuevas combinaciones

3. **Configurar Precios:**
   - Una vez configuradas las combinaciones, ir a la pestaña "Precios"
   - Configurar los precios por placa para cada combinación

## Beneficios de las Mejoras

1. **Prevención de Datos Inconsistentes:**
   - El sistema ahora detecta automáticamente combinaciones inválidas
   - Evita que se guarden espesores que no existen en el material base

2. **Mejor Experiencia de Usuario:**
   - Advertencias claras cuando hay problemas
   - Información detallada sobre qué combinaciones son inválidas
   - Guía sobre cómo resolver el problema

3. **Integridad de Datos:**
   - Validación automática contra el material base
   - Limpieza automática de combinaciones inválidas al guardar
   - Contador preciso de combinaciones seleccionadas

4. **Mantenibilidad:**
   - Scripts de diagnóstico disponibles para futuras verificaciones
   - Documentación clara del problema y la solución
   - Código más robusto y con mejor manejo de errores

## Verificación de la Compilación

✅ El proyecto compila correctamente sin errores
- Build completado en 13.13s
- Todos los módulos transformados correctamente
- No hay errores de TypeScript

## Comandos Útiles

```bash
# Ejecutar diagnóstico completo
npx tsx scripts/diagnose-materiales-rigidos.ts

# Verificar correcciones
npx tsx scripts/verify-materiales-rigidos-fix.ts

# Compilar proyecto
npm run build
```

## Notas Técnicas

- Las combinaciones inválidas se detectan comparando contra `materiales.variantes[].espesores`
- La validación se ejecuta en el `useEffect` cuando cambia el material o las combinaciones
- El filtrado es no destructivo: solo afecta la visualización, no modifica la DB hasta guardar
- Las advertencias son informativas y no bloquean la edición del producto
