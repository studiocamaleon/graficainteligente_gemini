# Fase 6: Hook de Cálculo de Precios Globales - COMPLETADA

## Resumen Ejecutivo
Se ha implementado exitosamente la Fase 6 del sistema de Servicios y Acabados Globales, creando el hook `useGlobalServicesPricing` que calcula precios para servicios y acabados de alcance "grupo" y los distribuye proporcionalmente entre las líneas de medición relacionadas.

---

## Cambios Implementados

### 1. Creación de `useGlobalServicesPricing.ts`

**Archivo**: `src/hooks/wizard/useGlobalServicesPricing.ts` (148 líneas)

Este hook es el núcleo del sistema de cálculo y distribución de precios globales.

#### 1.1 Interface `LineaParaCalcular`

Define la estructura de datos que cada línea de medición debe proveer:

```typescript
interface LineaParaCalcular {
  cantidad: number;
  precio_base_unitario: number;
  mt2_calculado?: number;
  metros_lineales?: number;
}
```

**Campos**:
- `cantidad`: Cantidad de unidades de esta línea
- `precio_base_unitario`: Precio base unitario (sin servicios ni acabados)
- `mt2_calculado`: Metros cuadrados totales (opcional, para cálculos por m²)
- `metros_lineales`: Metros lineales totales (opcional, para cálculos por metro lineal)

#### 1.2 Firma del Hook

```typescript
export function useGlobalServicesPricing(
  lineas: LineaParaCalcular[],
  serviciosGrupo: ServicioGlobalSeleccionado[],
  acabadosGrupo: AcabadoGlobalSeleccionado[]
)
```

**Parámetros**:
- `lineas`: Array de líneas de medición a considerar en el cálculo
- `serviciosGrupo`: Servicios con alcance "grupo" seleccionados por el usuario
- `acabadosGrupo`: Acabados con alcance "grupo" seleccionados por el usuario

**Retorno**: Array de `PreciosGlobalesLinea` con precios distribuidos para cada línea

---

## Lógica de Cálculo Implementada

### Paso 1: Calcular Totales del Grupo

El hook primero suma los totales de todas las líneas:

```typescript
const subtotal_total = lineas.reduce((sum, l) => sum + (l.precio_base_unitario * l.cantidad), 0);
const mt2_total = lineas.reduce((sum, l) => sum + (l.mt2_calculado || 0), 0);
const mt_lineal_total = lineas.reduce((sum, l) => sum + (l.metros_lineales || 0), 0);
```

Estos totales se usan como base para calcular los precios de servicios/acabados globales.

### Paso 2: Calcular Precio Total por Servicio Global

Para cada servicio de grupo, se calcula el precio total según su `tipo_impacto`:

| Tipo de Impacto | Fórmula | Ejemplo |
|----------------|---------|---------|
| `precio_fijo` | valor_monto | $500 fijo |
| `porcentual` | subtotal_total × (valor_monto / 100) | 10% del subtotal |
| `fijo_porcentual` | valor_monto + subtotal_total × (valor_monto_secundario / 100) | $200 + 5% |
| `fijo_mt2` | valor_monto + mt2_total × valor_monto_secundario | $300 + $50/m² |
| `fijo_mt_lineal` | valor_monto + mt_lineal_total × valor_monto_secundario | $200 + $30/ml |
| `por_mt2` | mt2_total × valor_monto | $50/m² |
| `por_mt_lineal` | mt_lineal_total × valor_monto | $30/ml |

**Ejemplo Concreto**:

```typescript
// Servicio: "Diseño Gráfico"
// tipo_impacto: 'precio_fijo'
// valor_monto: 500

switch ('precio_fijo') {
  case 'precio_fijo':
    precio_total = 500; // Se cobra una sola vez
    break;
}
```

### Paso 3: Calcular Precio Total por Acabado Global

Se aplica la misma lógica que para servicios. El código es idéntico pero opera sobre `acabadosGrupo`.

### Paso 4: Distribuir Proporcionalmente Entre Líneas

Una vez calculados los totales, se distribuyen entre las líneas según su peso:

```typescript
const peso_linea = (linea.precio_base_unitario * linea.cantidad) / subtotal_total;

return {
  precio_servicios_globales: total_servicios_globales * peso_linea,
  precio_acabados_globales: total_acabados_globales * peso_linea,
  servicios_detalle: [...],
  acabados_detalle: [...]
};
```

**Peso Proporcional**: Cada línea recibe una porción del precio global proporcional a su contribución al subtotal.

---

## Ejemplo de Uso Completo

### Escenario: 3 Tamaños de Vinilos con Diseño Gráfico

**Input - Líneas**:
```typescript
const lineas = [
  { cantidad: 10, precio_base_unitario: 100, mt2_calculado: 5 },   // Línea 1: $1,000 subtotal
  { cantidad: 5,  precio_base_unitario: 200, mt2_calculado: 8 },   // Línea 2: $1,000 subtotal
  { cantidad: 20, precio_base_unitario: 50,  mt2_calculado: 10 },  // Línea 3: $1,000 subtotal
];
// Subtotal total: $3,000
// mt2 total: 23 m²
```

**Input - Servicio Global**:
```typescript
const serviciosGrupo = [
  {
    servicio_nombre: "Diseño Gráfico",
    tipo_impacto: 'precio_fijo',
    valor_monto: 600,
    valor_monto_secundario: null
  }
];
```

**Procesamiento**:

1. **Calcular precio total del servicio**: $600 (precio fijo, una sola vez)

2. **Calcular peso de cada línea**:
   - Línea 1: $1,000 / $3,000 = 33.33%
   - Línea 2: $1,000 / $3,000 = 33.33%
   - Línea 3: $1,000 / $3,000 = 33.33%

3. **Distribuir el precio**:
   - Línea 1: $600 × 33.33% = $200
   - Línea 2: $600 × 33.33% = $200
   - Línea 3: $600 × 33.33% = $200

**Output**:
```typescript
[
  {
    precio_servicios_globales: 200,
    precio_acabados_globales: 0,
    servicios_detalle: [
      { servicio_nombre: "Diseño Gráfico", precio_calculado_total: 600, precio_asignado_linea: 200 }
    ],
    acabados_detalle: []
  },
  {
    precio_servicios_globales: 200,
    precio_acabados_globales: 0,
    servicios_detalle: [
      { servicio_nombre: "Diseño Gráfico", precio_calculado_total: 600, precio_asignado_linea: 200 }
    ],
    acabados_detalle: []
  },
  {
    precio_servicios_globales: 200,
    precio_acabados_globales: 0,
    servicios_detalle: [
      { servicio_nombre: "Diseño Gráfico", precio_calculado_total: 600, precio_asignado_linea: 200 }
    ],
    acabados_detalle: []
  }
]
```

### Resultado Final

- **Antes** (sin alcance de grupo): $600 × 3 = $1,800 por diseño
- **Ahora** (con alcance de grupo): $600 × 1 = $600 por diseño ✓

El precio se calculó una sola vez y se distribuyó equitativamente entre las 3 líneas.

---

## Tipos Soportados de Impacto

El hook soporta 7 tipos diferentes de impacto de precio:

### 1. `precio_fijo`
Precio fijo que se aplica una sola vez al grupo completo.

**Ejemplo**: Diseño gráfico por $500

### 2. `porcentual`
Porcentaje del subtotal total del grupo.

**Ejemplo**: Asesoramiento 5% sobre el subtotal

### 3. `fijo_porcentual`
Componente fijo + componente porcentual.

**Ejemplo**: $200 base + 3% del subtotal

### 4. `fijo_mt2`
Componente fijo + variable por metros cuadrados totales.

**Ejemplo**: $300 base + $50 por cada m² del grupo

### 5. `fijo_mt_lineal`
Componente fijo + variable por metros lineales totales.

**Ejemplo**: $200 base + $30 por cada metro lineal del grupo

### 6. `por_mt2`
Solo variable por metros cuadrados totales.

**Ejemplo**: $50 por cada m² del grupo

### 7. `por_mt_lineal`
Solo variable por metros lineales totales.

**Ejemplo**: $30 por cada metro lineal del grupo

---

## Optimización con useMemo

El hook utiliza `useMemo` para optimizar el rendimiento:

```typescript
const preciosGlobalesPorLinea = useMemo(() => {
  // ... cálculos ...
}, [lineas, serviciosGrupo, acabadosGrupo]);
```

**Beneficio**: Los cálculos solo se re-ejecutan cuando cambian las dependencias:
- Las líneas de medición cambian
- Se agregan/eliminan servicios de grupo
- Se agregan/eliminan acabados de grupo

Esto evita cálculos innecesarios en cada re-render del componente.

---

## Manejo de Casos Edge

### Caso 1: Sin Líneas
```typescript
if (lineas.length === 0) return [];
```
Si no hay líneas, retorna un array vacío inmediatamente.

### Caso 2: Valores Null/Undefined
```typescript
const fijo = servicio.valor_monto || 0;
const mt2_total = lineas.reduce((sum, l) => sum + (l.mt2_calculado || 0), 0);
```
Todos los valores opcionales tienen fallback a 0 para evitar `NaN`.

### Caso 3: Sin Servicios/Acabados de Grupo
Si los arrays están vacíos, el cálculo continúa normalmente y retorna precios globales de 0.

---

## Integración con Tipos Existentes

El hook utiliza interfaces ya definidas en `src/types/wizard.ts`:

### `ServicioGlobalSeleccionado` (líneas 114-122)
```typescript
export interface ServicioGlobalSeleccionado {
  servicio_id: string;
  servicio_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_monto: number | null;
  valor_monto_secundario: number | null;
}
```

### `AcabadoGlobalSeleccionado` (líneas 124-132)
```typescript
export interface AcabadoGlobalSeleccionado {
  acabado_id: string;
  acabado_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_monto: number | null;
  valor_monto_secundario: number | null;
}
```

### `PreciosGlobalesLinea` (líneas 138-151)
```typescript
export interface PreciosGlobalesLinea {
  precio_servicios_globales: number;
  precio_acabados_globales: number;
  servicios_detalle: Array<{
    servicio_nombre: string;
    precio_calculado_total: number;
    precio_asignado_linea: number;
  }>;
  acabados_detalle: Array<{
    acabado_nombre: string;
    precio_calculado_total: number;
    precio_asignado_linea: number;
  }>;
}
```

Estas interfaces se definieron en fases anteriores del plan, asegurando total compatibilidad.

---

## Validación Técnica

✅ **Build exitoso**: `npm run build` completado sin errores de TypeScript
✅ **Tipos alineados**: Todas las interfaces importadas existen en `wizard.ts`
✅ **Optimización**: `useMemo` implementado para evitar cálculos innecesarios
✅ **Manejo de errores**: Valores null/undefined con fallbacks a 0
✅ **7 tipos de impacto**: Todos los casos contemplados en los switch statements
✅ **Distribución proporcional**: Lógica de peso implementada correctamente

---

## Impacto en el Sistema

### Componentes Afectados
1. ✅ `useGlobalServicesPricing.ts` - Nuevo hook creado
2. ⏳ `UniversalAddItemWizard.tsx` (Fase 7) - Pendiente de integración
3. ⏳ `GroupServicesStep.tsx` (Fase 7) - Pendiente de creación

### Próximos Pasos (Fase 7)

**Fase 7**: Actualizar Wizard - Nuevo Paso Servicios/Acabados de Grupo
- Agregar estados para servicios/acabados globales en wizard
- Crear componente `GroupServicesStep.tsx`
- Integrar hook de precios en el flujo del wizard
- Agregar paso al flujo de navegación

---

## Testing Recomendado

### 1. Test Básico: Precio Fijo
```typescript
const lineas = [
  { cantidad: 1, precio_base_unitario: 100 },
  { cantidad: 1, precio_base_unitario: 100 }
];

const serviciosGrupo = [{
  servicio_nombre: "Test",
  tipo_impacto: 'precio_fijo',
  valor_monto: 200,
  valor_monto_secundario: null
}];

const resultado = useGlobalServicesPricing(lineas, serviciosGrupo, []);

// Esperado: Cada línea recibe $100 (50% del precio fijo)
expect(resultado[0].precio_servicios_globales).toBe(100);
expect(resultado[1].precio_servicios_globales).toBe(100);
```

### 2. Test Porcentual
```typescript
const lineas = [
  { cantidad: 1, precio_base_unitario: 500 },
  { cantidad: 1, precio_base_unitario: 500 }
];

const serviciosGrupo = [{
  servicio_nombre: "Comisión",
  tipo_impacto: 'porcentual',
  valor_monto: 10, // 10%
  valor_monto_secundario: null
}];

const resultado = useGlobalServicesPricing(lineas, serviciosGrupo, []);

// Subtotal total: $1,000
// 10% de $1,000 = $100
// Distribuido 50/50: $50 por línea
expect(resultado[0].precio_servicios_globales).toBe(50);
expect(resultado[1].precio_servicios_globales).toBe(50);
```

### 3. Test Fijo + Variable (mt2)
```typescript
const lineas = [
  { cantidad: 1, precio_base_unitario: 100, mt2_calculado: 5 },
  { cantidad: 1, precio_base_unitario: 100, mt2_calculado: 5 }
];

const acabadosGrupo = [{
  acabado_nombre: "Instalación",
  tipo_impacto: 'fijo_mt2',
  valor_monto: 300,          // Fijo
  valor_monto_secundario: 50 // Por m²
}];

const resultado = useGlobalServicesPricing(lineas, [], acabadosGrupo);

// mt2 total: 10 m²
// Precio total: $300 + (10 × $50) = $800
// Distribuido 50/50: $400 por línea
expect(resultado[0].precio_acabados_globales).toBe(400);
expect(resultado[1].precio_acabados_globales).toBe(400);
```

### 4. Test Distribución Asimétrica
```typescript
const lineas = [
  { cantidad: 1, precio_base_unitario: 300 },  // 75% del subtotal
  { cantidad: 1, precio_base_unitario: 100 }   // 25% del subtotal
];

const serviciosGrupo = [{
  servicio_nombre: "Servicio",
  tipo_impacto: 'precio_fijo',
  valor_monto: 400,
  valor_monto_secundario: null
}];

const resultado = useGlobalServicesPricing(lineas, serviciosGrupo, []);

// Línea 1 recibe 75%: $300
// Línea 2 recibe 25%: $100
expect(resultado[0].precio_servicios_globales).toBe(300);
expect(resultado[1].precio_servicios_globales).toBe(100);
```

---

## Fórmulas de Cálculo Documentadas

### Peso Proporcional de una Línea
```
peso_linea = (precio_base_unitario × cantidad) / subtotal_total
```

### Distribución del Precio Global
```
precio_asignado_linea = precio_calculado_total × peso_linea
```

### Precio Total Fijo + Porcentual
```
precio_total = valor_monto + (subtotal_total × (valor_monto_secundario / 100))
```

### Precio Total Fijo + Por m²
```
precio_total = valor_monto + (mt2_total × valor_monto_secundario)
```

### Precio Total Fijo + Por Metro Lineal
```
precio_total = valor_monto + (mt_lineal_total × valor_monto_secundario)
```

---

## Beneficios de esta Implementación

### 1. Cálculo Centralizado
Todo el cálculo de precios globales está en un solo lugar, facilitando mantenimiento y debugging.

### 2. Reutilizable
El hook puede ser utilizado en cualquier parte del sistema que necesite calcular precios de servicios/acabados de grupo.

### 3. Optimizado
`useMemo` asegura que los cálculos solo se ejecutan cuando es necesario.

### 4. Transparente
El detalle completo de precios permite mostrar al usuario exactamente cómo se calculó cada monto.

### 5. Flexible
Soporta todos los tipos de impacto definidos en el sistema, desde precios fijos hasta fórmulas complejas combinadas.

---

## Conclusión

La Fase 6 se ha completado exitosamente. El sistema ahora cuenta con:

✅ Hook de cálculo de precios globales funcional
✅ Soporte para 7 tipos diferentes de impacto de precio
✅ Distribución proporcional entre líneas basada en subtotales
✅ Optimización con useMemo para performance
✅ Manejo robusto de casos edge
✅ Total compatibilidad con tipos existentes

El hook `useGlobalServicesPricing` está listo para ser integrado en el wizard durante la Fase 7, donde se creará la interfaz de usuario para seleccionar servicios y acabados de grupo.

---

**Fecha de Implementación**: 2025-12-04
**Estado**: ✅ COMPLETADA
**Build**: ✅ EXITOSO (sin errores TypeScript)
**Líneas de Código**: 148 líneas
**Próxima Fase**: Fase 7 - Actualizar Wizard con Paso de Servicios/Acabados de Grupo
