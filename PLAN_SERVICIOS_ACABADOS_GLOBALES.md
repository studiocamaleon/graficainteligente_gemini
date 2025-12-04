# Plan de Implementación: Sistema de Servicios y Acabados Globales para Items Multi-Línea

## Contexto y Problema

### Situación Actual
Cuando un usuario configura un producto con múltiples líneas de medidas en el wizard (ejemplo: Vinilo impreso con 3 tamaños diferentes), cada línea se convierte en un **item individual** en la orden de trabajo:

- **Línea 1**: 2 unidades de 20x30 cm → `ordenes_trabajo_items` (Item 1)
- **Línea 2**: 3 unidades de 60x70 cm → `ordenes_trabajo_items` (Item 2)
- **Línea 3**: 5 unidades de 80x110 cm → `ordenes_trabajo_items` (Item 3)

### El Problema
Actualmente, si el usuario selecciona servicios o acabados en cada línea:

1. **Servicio "Diseño Gráfico Básico"**: Se cobra 3 veces (una por cada item)
   - **Debería cobrarse**: 1 sola vez para todo el trabajo

2. **Acabado "Instalación" (tipo `fijo_mt2`)**:
   - Componente fijo ($500): Se cobra 3 veces
   - Componente variable ($50/m²): Se calcula por separado para cada item
   - **Debería ser**: Fijo se cobra 1 vez, variable se calcula sobre el total de m² de todos los items

### Solución Propuesta
Implementar un sistema que permita:
- Definir servicios y acabados con **alcance "grupo"** que se aplican a todos los items relacionados
- Definir servicios y acabados con **alcance "por_item"** que se aplican individualmente
- Agrupar items relacionados con un `item_grupo_id`
- Calcular y distribuir correctamente los precios de servicios/acabados globales

---

## Validación de Estructura de Base de Datos Actual

### Tabla: `ordenes_trabajo_items` (Existente)
**Campos actuales validados**:
- `id` (uuid)
- `orden_id` (uuid)
- `producto_id` (uuid, nullable)
- `cantidad` (numeric)
- `configuracion` (jsonb)
- `precio_base` (numeric)
- `precio_servicios` (numeric)
- `precio_acabados` (numeric)
- `precio_unitario_final` (numeric)
- `precio_total` (numeric)
- `producto_nombre` (text)
- `producto_categoria` (text)
- `tipo_item` (text: 'catalogo' | 'personalizado')
- `descripcion` (text, nullable)
- `tiempo_produccion_dias` (integer, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### Tabla: `servicios` (Existente)
**Campos actuales validados**:
- `id` (uuid)
- `company_id` (uuid)
- `nombre` (text)
- `categoria_id` (uuid)
- `estacion_id` (uuid)
- `disponible_independiente` (boolean)
- `tiene_niveles_precio` (boolean)
- `tipo_impacto` (text, nullable)
- `valor_impacto` (numeric, nullable)
- `valor_impacto_secundario` (numeric, nullable)
- `is_active` (boolean)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Constraint actual**:
```sql
CHECK (tipo_impacto IS NULL OR tipo_impacto IN (
  'sin_impacto', 'precio_fijo', 'por_unidad', 'por_minuto', 'porcentual',
  'por_mt2', 'por_mt_lineal', 'fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'
))
```

### Tabla: `acabados` (Existente)
**Campos actuales validados**: (idénticos a `servicios`)

### Tabla: `servicios_niveles_precio` (Existente)
**Campos actuales validados**:
- `id` (uuid)
- `servicio_id` (uuid)
- `nombre` (text)
- `tipo_impacto` (text)
- `valor_impacto` (numeric)
- `valor_impacto_secundario` (numeric, nullable)
- `paso_id` (uuid, nullable)
- `grupo_paso_id` (uuid, nullable)
- `orden` (integer)
- `created_at` (timestamptz)

### Tabla: `acabados_niveles_precio` (Existente)
**Campos actuales validados**: (idénticos a `servicios_niveles_precio`)

---

## FASE 1: Actualización de Base de Datos

### 1.1 Migration: Agregar campo `alcance` a `servicios`

**Archivo**: `supabase/migrations/YYYYMMDDHHMMSS_add_alcance_to_servicios_acabados.sql`

```sql
/*
  # Agregar campo alcance a servicios y acabados

  ## Descripción
  Agrega el campo `alcance` a las tablas `servicios` y `acabados` para permitir
  definir si un servicio/acabado se aplica por item individual o al grupo completo.

  ## Cambios
  1. Agregar columna `alcance` a `servicios`
  2. Agregar columna `alcance` a `acabados`
  3. Actualizar registros existentes con valor default 'por_item'
  4. Agregar constraints de validación

  ## Valores de alcance
  - 'por_item': Se aplica a cada item individual (default)
  - 'grupo': Se aplica una vez para todos los items del grupo

  ## Retrocompatibilidad
  - Todos los servicios/acabados existentes se marcan como 'por_item'
  - No afecta funcionalidad actual
*/

-- =====================================================
-- 1. AGREGAR CAMPO ALCANCE A SERVICIOS
-- =====================================================

-- Agregar columna alcance
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS alcance text NOT NULL DEFAULT 'por_item';

-- Agregar constraint para validar valores
ALTER TABLE servicios
  DROP CONSTRAINT IF EXISTS check_servicios_alcance_valido;

ALTER TABLE servicios
  ADD CONSTRAINT check_servicios_alcance_valido
    CHECK (alcance IN ('por_item', 'grupo'));

-- Actualizar todos los registros existentes
UPDATE servicios
SET alcance = 'por_item'
WHERE alcance IS NULL OR alcance = '';

-- Crear índice para mejorar queries
CREATE INDEX IF NOT EXISTS idx_servicios_alcance
  ON servicios(alcance);

-- Comentario para documentación
COMMENT ON COLUMN servicios.alcance IS
'Alcance del servicio: por_item (se aplica a cada item) o grupo (se aplica una vez a todos los items del grupo)';

-- =====================================================
-- 2. AGREGAR CAMPO ALCANCE A ACABADOS
-- =====================================================

-- Agregar columna alcance
ALTER TABLE acabados
  ADD COLUMN IF NOT EXISTS alcance text NOT NULL DEFAULT 'por_item';

-- Agregar constraint para validar valores
ALTER TABLE acabados
  DROP CONSTRAINT IF EXISTS check_acabados_alcance_valido;

ALTER TABLE acabados
  ADD CONSTRAINT check_acabados_alcance_valido
    CHECK (alcance IN ('por_item', 'grupo'));

-- Actualizar todos los registros existentes
UPDATE acabados
SET alcance = 'por_item'
WHERE alcance IS NULL OR alcance = '';

-- Crear índice para mejorar queries
CREATE INDEX IF NOT EXISTS idx_acabados_alcance
  ON acabados(alcance);

-- Comentario para documentación
COMMENT ON COLUMN acabados.alcance IS
'Alcance del acabado: por_item (se aplica a cada item) o grupo (se aplica una vez a todos los items del grupo)';
```

### 1.2 Migration: Agregar campos de agrupación a `ordenes_trabajo_items`

**Archivo**: `supabase/migrations/YYYYMMDDHHMMSS_add_grupo_fields_to_items.sql`

```sql
/*
  # Agregar campos para agrupación y servicios globales

  ## Descripción
  Agrega campos necesarios para:
  - Agrupar items relacionados del mismo wizard
  - Almacenar precios de servicios/acabados globales distribuidos
  - Almacenar información de servicios/acabados globales del grupo

  ## Cambios
  1. Agregar `item_grupo_id` para agrupar items relacionados
  2. Agregar `precio_servicios_globales` para porción distribuida
  3. Agregar `precio_acabados_globales` para porción distribuida
  4. Agregar `servicios_globales_grupo` (JSONB) para info completa
  5. Agregar `acabados_globales_grupo` (JSONB) para info completa
  6. Crear índices para optimizar queries

  ## Notas
  - Todos los campos son nullable para retrocompatibilidad
  - Items sin `item_grupo_id` son items individuales (no agrupados)
  - Solo el primer item de un grupo tiene `servicios_globales_grupo` y `acabados_globales_grupo`
*/

-- =====================================================
-- 1. AGREGAR CAMPOS DE AGRUPACIÓN
-- =====================================================

-- Campo para agrupar items relacionados
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS item_grupo_id uuid;

-- Índice para buscar items del mismo grupo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_item_grupo_id
  ON ordenes_trabajo_items(item_grupo_id)
  WHERE item_grupo_id IS NOT NULL;

COMMENT ON COLUMN ordenes_trabajo_items.item_grupo_id IS
'UUID que agrupa items relacionados creados desde el mismo wizard. NULL para items individuales.';

-- =====================================================
-- 2. AGREGAR CAMPOS DE PRECIOS GLOBALES
-- =====================================================

-- Precio de servicios globales distribuido
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS precio_servicios_globales numeric DEFAULT 0;

-- Precio de acabados globales distribuido
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS precio_acabados_globales numeric DEFAULT 0;

-- Constraints para validar valores positivos
ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_precio_servicios_globales_positivo;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_precio_servicios_globales_positivo
    CHECK (precio_servicios_globales >= 0);

ALTER TABLE ordenes_trabajo_items
  DROP CONSTRAINT IF EXISTS check_precio_acabados_globales_positivo;

ALTER TABLE ordenes_trabajo_items
  ADD CONSTRAINT check_precio_acabados_globales_positivo
    CHECK (precio_acabados_globales >= 0);

COMMENT ON COLUMN ordenes_trabajo_items.precio_servicios_globales IS
'Porción del precio de servicios globales asignada a este item (distribuida proporcionalmente)';

COMMENT ON COLUMN ordenes_trabajo_items.precio_acabados_globales IS
'Porción del precio de acabados globales asignada a este item (distribuida proporcionalmente)';

-- =====================================================
-- 3. AGREGAR CAMPOS JSONB PARA INFO COMPLETA
-- =====================================================

-- Información completa de servicios globales del grupo
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS servicios_globales_grupo jsonb DEFAULT NULL;

-- Información completa de acabados globales del grupo
ALTER TABLE ordenes_trabajo_items
  ADD COLUMN IF NOT EXISTS acabados_globales_grupo jsonb DEFAULT NULL;

-- Índices GIN para búsquedas en JSONB
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_servicios_globales_grupo
  ON ordenes_trabajo_items USING gin(servicios_globales_grupo)
  WHERE servicios_globales_grupo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_items_acabados_globales_grupo
  ON ordenes_trabajo_items USING gin(acabados_globales_grupo)
  WHERE acabados_globales_grupo IS NOT NULL;

COMMENT ON COLUMN ordenes_trabajo_items.servicios_globales_grupo IS
'Array JSONB con información completa de servicios globales del grupo. Solo en el primer item del grupo.';

COMMENT ON COLUMN ordenes_trabajo_items.acabados_globales_grupo IS
'Array JSONB con información completa de acabados globales del grupo. Solo en el primer item del grupo.';

-- =====================================================
-- 4. ACTUALIZAR VALORES DEFAULT PARA ITEMS EXISTENTES
-- =====================================================

-- Los items existentes ya tienen precio_servicios y precio_acabados
-- Simplemente aseguramos que los nuevos campos sean 0
UPDATE ordenes_trabajo_items
SET
  precio_servicios_globales = 0,
  precio_acabados_globales = 0
WHERE
  precio_servicios_globales IS NULL OR
  precio_acabados_globales IS NULL;
```

---

## FASE 2: Actualización de Tipos TypeScript

### 2.1 Actualizar tipos de Servicios y Acabados

**Archivo**: `src/types/wizard.ts`

Agregar campos de alcance a los tipos existentes:

```typescript
// Agregar después de la línea 85 (interface ProductConfiguration)

export interface ServicioConAlcance {
  id: string;
  servicio_id: string;
  servicio_nombre: string;
  alcance: 'por_item' | 'grupo';
  tiene_niveles: boolean;
  niveles?: Array<{
    id: string;
    nombre: string;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }>;
}

export interface AcabadoConAlcance {
  id: string;
  acabado_id: string;
  acabado_nombre: string;
  alcance: 'por_item' | 'grupo';
  tiene_niveles: boolean;
  niveles?: Array<{
    id: string;
    nombre: string;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
  }>;
}

// Tipo para servicios/acabados seleccionados a nivel de grupo
export interface ServicioGlobalSeleccionado {
  servicio_id: string;
  servicio_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_monto: number | null;
  valor_monto_secundario: number | null;
}

export interface AcabadoGlobalSeleccionado {
  acabado_id: string;
  acabado_nombre: string;
  nivel_id: string | null;
  nivel_nombre: string | null;
  tipo_impacto: string;
  valor_monto: number | null;
  valor_monto_secundario: number | null;
}

// Tipo para la información de precios globales calculados
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

### 2.2 Actualizar tipo ProductConfiguration

**Archivo**: `src/types/wizard.ts`

Modificar el interface `ProductConfiguration` para separar servicios/acabados por alcance:

```typescript
export interface ProductConfiguration {
  // ... campos existentes ...

  // MODIFICAR: Separar servicios por alcance
  servicios_por_item: ServicioConAlcance[];
  servicios_grupo: ServicioConAlcance[];

  // MODIFICAR: Separar acabados por alcance
  acabados_por_item: AcabadoConAlcance[];
  acabados_grupo: AcabadoConAlcance[];

  // ... resto de campos ...
}
```

---

## FASE 3: Actualización de Hook de Configuración

### 3.1 Modificar `useProductConfiguration` para cargar alcance

**Archivo**: `src/hooks/wizard/useProductConfiguration.ts`

**Cambios en línea 603** (función `loadServiciosForProduct`):

```typescript
// ANTES (línea 603):
.select(`
  id,
  servicio_id,
  servicios!inner(id, nombre, tiene_niveles_precio)
`)

// DESPUÉS:
.select(`
  id,
  servicio_id,
  servicios!inner(id, nombre, tiene_niveles_precio, alcance)
`)
```

**Cambios en línea 665** (return del servicio):

```typescript
// ANTES:
return {
  id: rel.id,
  servicio_id: rel.servicio_id,
  servicio_nombre: servicio.nombre,
  tiene_niveles: servicio.tiene_niveles_precio,
  niveles
};

// DESPUÉS:
return {
  id: rel.id,
  servicio_id: rel.servicio_id,
  servicio_nombre: servicio.nombre,
  alcance: servicio.alcance || 'por_item', // Default para retrocompatibilidad
  tiene_niveles: servicio.tiene_niveles_precio,
  niveles
};
```

**Cambios similares en línea 688** (función `loadAcabadosForProduct`):

```typescript
// Línea 688:
.select(`
  id,
  acabado_id,
  acabados!inner(id, nombre, tiene_niveles_precio, alcance)
`)

// Línea 750:
return {
  id: rel.id,
  acabado_id: rel.acabado_id,
  acabado_nombre: acabado.nombre,
  alcance: acabado.alcance || 'por_item', // Default para retrocompatibilidad
  tiene_niveles: acabado.tiene_niveles_precio,
  niveles
};
```

### 3.2 Separar servicios y acabados por alcance en cada loader

Ejemplo para `loadImpresionLaserConfig` (aplicar patrón similar a todos los loaders):

```typescript
// Después de cargar servicios y acabados (alrededor de línea 200):
const serviciosCargados = await loadServiciosForProduct(...);
const acabadosCargados = await loadAcabadosForProduct(...);

// Separar por alcance
const servicios_por_item = serviciosCargados.filter(s => s.alcance === 'por_item');
const servicios_grupo = serviciosCargados.filter(s => s.alcance === 'grupo');
const acabados_por_item = acabadosCargados.filter(a => a.alcance === 'por_item');
const acabados_grupo = acabadosCargados.filter(a => a.alcance === 'grupo');

return {
  // ... resto de configuración ...
  servicios_por_item,
  servicios_grupo,
  acabados_por_item,
  acabados_grupo,
  // ... resto de campos ...
};
```

---

## FASE 4: Actualización de ABM - Servicios

### 4.1 Agregar selector de alcance en formulario

**Archivo**: `src/components/abm-core/ServicioForm.tsx`

Agregar selector después del campo "Disponible Independiente" (alrededor de línea 150):

```typescript
{/* Campo Alcance */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Alcance del Servicio
  </label>
  <select
    value={formData.alcance || 'por_item'}
    onChange={(e) => setFormData({ ...formData, alcance: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    <option value="por_item">Por Item (individual)</option>
    <option value="grupo">Grupo de Items</option>
  </select>
  <p className="mt-1 text-xs text-gray-500">
    {formData.alcance === 'grupo'
      ? '✓ Este servicio se cobrará UNA SOLA VEZ para todos los items del grupo'
      : '✓ Este servicio se cobrará por cada item individual'
    }
  </p>
</div>
```

### 4.2 Actualizar hook useServicios

**Archivo**: `src/hooks/useServicios.ts`

Agregar campo `alcance` en:
- Query SELECT (incluir campo en la consulta)
- Función create (incluir en INSERT)
- Función update (incluir en UPDATE)
- Tipo TypeScript del servicio

---

## FASE 5: Actualización de ABM - Acabados

### 5.1 Agregar selector de alcance en formulario

**Archivo**: `src/components/abm-core/AcabadoForm.tsx`

Aplicar los mismos cambios que en ServicioForm (FASE 4.1).

### 5.2 Actualizar hook useAcabados

**Archivo**: `src/hooks/useAcabados.ts`

Aplicar los mismos cambios que en useServicios (FASE 4.2).

---

## FASE 6: Crear Hook de Cálculo de Precios Globales

### 6.1 Crear nuevo hook

**Archivo**: `src/hooks/wizard/useGlobalServicesPricing.ts`

```typescript
import { useMemo } from 'react';
import type { ServicioGlobalSeleccionado, AcabadoGlobalSeleccionado, PreciosGlobalesLinea } from '../../types/wizard';

interface LineaParaCalcular {
  cantidad: number;
  precio_base_unitario: number;
  mt2_calculado?: number;
  metros_lineales?: number;
}

export function useGlobalServicesPricing(
  lineas: LineaParaCalcular[],
  serviciosGrupo: ServicioGlobalSeleccionado[],
  acabadosGrupo: AcabadoGlobalSeleccionado[]
) {
  const preciosGlobalesPorLinea = useMemo(() => {
    if (lineas.length === 0) return [];

    // Calcular totales para toda la colección de líneas
    const subtotal_total = lineas.reduce((sum, l) => sum + (l.precio_base_unitario * l.cantidad), 0);
    const mt2_total = lineas.reduce((sum, l) => sum + (l.mt2_calculado || 0), 0);
    const mt_lineal_total = lineas.reduce((sum, l) => sum + (l.metros_lineales || 0), 0);

    // Calcular precios de servicios globales
    const serviciosCalculados = serviciosGrupo.map(servicio => {
      let precio_total = 0;

      switch (servicio.tipo_impacto) {
        case 'precio_fijo':
          precio_total = servicio.valor_monto || 0;
          break;

        case 'porcentual':
          precio_total = subtotal_total * ((servicio.valor_monto || 0) / 100);
          break;

        case 'fijo_porcentual':
          const fijo = servicio.valor_monto || 0;
          const porcentual = subtotal_total * ((servicio.valor_monto_secundario || 0) / 100);
          precio_total = fijo + porcentual;
          break;

        case 'fijo_mt2':
          const fijo_mt2 = servicio.valor_monto || 0;
          const variable_mt2 = mt2_total * (servicio.valor_monto_secundario || 0);
          precio_total = fijo_mt2 + variable_mt2;
          break;

        case 'fijo_mt_lineal':
          const fijo_ml = servicio.valor_monto || 0;
          const variable_ml = mt_lineal_total * (servicio.valor_monto_secundario || 0);
          precio_total = fijo_ml + variable_ml;
          break;

        case 'por_mt2':
          precio_total = mt2_total * (servicio.valor_monto || 0);
          break;

        case 'por_mt_lineal':
          precio_total = mt_lineal_total * (servicio.valor_monto || 0);
          break;
      }

      return {
        servicio_nombre: servicio.servicio_nombre,
        precio_calculado_total: precio_total
      };
    });

    // Calcular precios de acabados globales (misma lógica)
    const acabadosCalculados = acabadosGrupo.map(acabado => {
      let precio_total = 0;

      switch (acabado.tipo_impacto) {
        case 'precio_fijo':
          precio_total = acabado.valor_monto || 0;
          break;

        case 'porcentual':
          precio_total = subtotal_total * ((acabado.valor_monto || 0) / 100);
          break;

        case 'fijo_porcentual':
          const fijo = acabado.valor_monto || 0;
          const porcentual = subtotal_total * ((acabado.valor_monto_secundario || 0) / 100);
          precio_total = fijo + porcentual;
          break;

        case 'fijo_mt2':
          const fijo_mt2 = acabado.valor_monto || 0;
          const variable_mt2 = mt2_total * (acabado.valor_monto_secundario || 0);
          precio_total = fijo_mt2 + variable_mt2;
          break;

        case 'fijo_mt_lineal':
          const fijo_ml = acabado.valor_monto || 0;
          const variable_ml = mt_lineal_total * (acabado.valor_monto_secundario || 0);
          precio_total = fijo_ml + variable_ml;
          break;

        case 'por_mt2':
          precio_total = mt2_total * (acabado.valor_monto || 0);
          break;

        case 'por_mt_lineal':
          precio_total = mt_lineal_total * (acabado.valor_monto || 0);
          break;
      }

      return {
        acabado_nombre: acabado.acabado_nombre,
        precio_calculado_total: precio_total
      };
    });

    // Calcular totales
    const total_servicios_globales = serviciosCalculados.reduce((sum, s) => sum + s.precio_calculado_total, 0);
    const total_acabados_globales = acabadosCalculados.reduce((sum, a) => sum + a.precio_calculado_total, 0);

    // Distribuir proporcionalmente entre las líneas según su precio base
    return lineas.map(linea => {
      const peso_linea = (linea.precio_base_unitario * linea.cantidad) / subtotal_total;

      return {
        precio_servicios_globales: total_servicios_globales * peso_linea,
        precio_acabados_globales: total_acabados_globales * peso_linea,
        servicios_detalle: serviciosCalculados.map(s => ({
          ...s,
          precio_asignado_linea: s.precio_calculado_total * peso_linea
        })),
        acabados_detalle: acabadosCalculados.map(a => ({
          ...a,
          precio_asignado_linea: a.precio_calculado_total * peso_linea
        }))
      } as PreciosGlobalesLinea;
    });

  }, [lineas, serviciosGrupo, acabadosGrupo]);

  return preciosGlobalesPorLinea;
}
```

---

## FASE 7: Actualizar Wizard - Nuevo Paso Servicios/Acabados de Grupo

### 7.1 Agregar estado para servicios/acabados globales

**Archivo**: `src/components/wizard/UniversalAddItemWizard.tsx`

Agregar después de la línea 50 (estados existentes):

```typescript
// Estados para servicios/acabados de grupo
const [selectedServiciosGrupo, setSelectedServiciosGrupo] = useState<ServicioGlobalSeleccionado[]>([]);
const [selectedAcabadosGrupo, setSelectedAcabadosGrupo] = useState<AcabadoGlobalSeleccionado[]>([]);
```

### 7.2 Crear componente de paso

**Archivo**: `src/components/wizard/steps/GroupServicesStep.tsx`

```typescript
import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import type { ServicioConAlcance, AcabadoConAlcance, ServicioGlobalSeleccionado, AcabadoGlobalSeleccionado } from '../../../types/wizard';

interface GroupServicesStepProps {
  serviciosGrupo: ServicioConAlcance[];
  acabadosGrupo: AcabadoConAlcance[];
  selectedServiciosGrupo: ServicioGlobalSeleccionado[];
  selectedAcabadosGrupo: AcabadoGlobalSeleccionado[];
  onServiciosChange: (servicios: ServicioGlobalSeleccionado[]) => void;
  onAcabadosChange: (acabados: AcabadoGlobalSeleccionado[]) => void;
}

export default function GroupServicesStep({
  serviciosGrupo,
  acabadosGrupo,
  selectedServiciosGrupo,
  selectedAcabadosGrupo,
  onServiciosChange,
  onAcabadosChange
}: GroupServicesStepProps) {

  // Lógica para seleccionar/deseleccionar servicios y niveles
  // Similar a ServicesStep pero para servicios de grupo

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">
              Servicios y Acabados de Grupo
            </h3>
            <p className="text-sm text-blue-700">
              Estos servicios y acabados se aplicarán <strong>una sola vez</strong> para
              todas las líneas que agregues. Son ideales para servicios como "Diseño Gráfico"
              o "Instalación" que corresponden al trabajo completo.
            </p>
          </div>
        </div>
      </div>

      {/* Sección de Servicios de Grupo */}
      {serviciosGrupo.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Servicios de Grupo Disponibles
          </h3>
          <div className="space-y-3">
            {/* Renderizar checkboxes para servicios */}
            {serviciosGrupo.map(servicio => (
              // ... implementación similar a ServicesStep
            ))}
          </div>
        </div>
      )}

      {/* Sección de Acabados de Grupo */}
      {acabadosGrupo.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Acabados de Grupo Disponibles
          </h3>
          <div className="space-y-3">
            {/* Renderizar checkboxes para acabados */}
            {acabadosGrupo.map(acabado => (
              // ... implementación similar a FinishingsStep
            ))}
          </div>
        </div>
      )}

      {/* Mensaje si no hay servicios/acabados de grupo */}
      {serviciosGrupo.length === 0 && acabadosGrupo.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No hay servicios o acabados de grupo disponibles para este producto.</p>
        </div>
      )}
    </div>
  );
}
```

### 7.3 Integrar paso en el wizard

**Archivo**: `src/components/wizard/UniversalAddItemWizard.tsx`

Modificar la lógica de pasos para incluir "group_services" después de configuration y antes de agregar líneas.

---

## FASE 8: Actualizar Generación de Items en Wizard

### 8.1 Modificar handleAgregar

**Archivo**: `src/components/wizard/UniversalAddItemWizard.tsx` (línea 397)

Modificar la función para:
1. Generar un único `item_grupo_id`
2. Calcular precios globales usando el nuevo hook
3. Incluir precios globales en cada item
4. Guardar info completa de servicios/acabados globales solo en el primer item

```typescript
const handleAgregar = async () => {
  if (!selectedProduct || !config) return;

  setIsSubmitting(true);
  try {
    // Si el producto permite múltiples líneas
    if (config.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0) {

      // 1. Generar un único item_grupo_id para todos los items
      const itemGrupoId = crypto.randomUUID();

      // 2. Calcular precios globales distribuidos
      const preciosGlobales = useGlobalServicesPricing(
        selectedConfig.lineas_medidas,
        selectedServiciosGrupo,
        selectedAcabadosGrupo
      );

      // 3. Crear items con precios globales
      for (let i = 0; i < selectedConfig.lineas_medidas.length; i++) {
        const linea = selectedConfig.lineas_medidas[i];
        const preciosGlobalesLinea = preciosGlobales[i];

        // ... construcción del item similar a la actual ...

        const itemData = {
          producto_id: selectedProduct.id,
          producto_nombre: selectedProduct.nombre,
          categoria: selectedProduct.categoria,
          cantidad: linea.cantidad,
          configuracion: configuracionLinea,
          precio_base: linea.precio_base_unitario || 0,
          precio_servicios: linea.precio_servicios_unitario || 0,
          precio_acabados: linea.precio_acabados_unitario || 0,
          precio_servicios_globales: preciosGlobalesLinea.precio_servicios_globales,
          precio_acabados_globales: preciosGlobalesLinea.precio_acabados_globales,
          precio_unitario_final: calcularPrecioUnitarioFinal(...), // Incluir globales
          precio_total: calcularPrecioTotal(...), // Incluir globales
          item_grupo_id: itemGrupoId,

          // Solo en el primer item: guardar info completa
          servicios_globales_grupo: i === 0 ? selectedServiciosGrupo : null,
          acabados_globales_grupo: i === 0 ? selectedAcabadosGrupo : null,

          rutas_generadas: rutasGeneradas
        };

        await onAgregar(itemData);
      }
    } else {
      // Lógica tradicional para items sin múltiples líneas (sin cambios)
      // ...
    }

    handleClose();
  } catch (error) {
    console.error('Error al agregar items:', error);
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## FASE 9: Actualizar Visualización en Órdenes

### 9.1 Detectar y agrupar items en OrdenItemsTab

**Archivo**: `src/components/orders/OrdenItemsTab.tsx`

Modificar para detectar items con `item_grupo_id` y agruparlos visualmente:

```typescript
// Detectar items agrupados
const itemsAgrupados = useMemo(() => {
  const grupos = new Map<string, typeof items>();
  const individuales: typeof items = [];

  items.forEach(item => {
    if (item.item_grupo_id) {
      const grupo = grupos.get(item.item_grupo_id) || [];
      grupo.push(item);
      grupos.set(item.item_grupo_id, grupo);
    } else {
      individuales.push(item);
    }
  });

  return { grupos: Array.from(grupos.entries()), individuales };
}, [items]);

// Renderizar items agrupados y luego individuales
```

### 9.2 Crear componente de visualización de grupo

**Archivo**: `src/components/orders/ItemsGrupoCard.tsx`

Componente para mostrar un grupo de items con servicios/acabados globales.

---

## FASE 10: Actualizar Footer de Totales

### 10.1 Incluir precios globales en cálculo

**Archivo**: `src/components/orders/OrdenFooterTotales.tsx`

Modificar para sumar correctamente los campos de precios globales:

```typescript
const subtotal = items.reduce((sum, item) => sum + item.precio_base * item.cantidad, 0);
const totalServicios = items.reduce((sum, item) => sum + item.precio_servicios, 0);
const totalAcabados = items.reduce((sum, item) => sum + item.precio_acabados, 0);
const totalServiciosGlobales = items.reduce((sum, item) => sum + (item.precio_servicios_globales || 0), 0);
const totalAcabadosGlobales = items.reduce((sum, item) => sum + (item.precio_acabados_globales || 0), 0);
```

---

## Resumen de Fases

1. **FASE 1**: Migrations de BD (alcance + agrupación)
2. **FASE 2**: Tipos TypeScript
3. **FASE 3**: Hook de configuración (cargar alcance)
4. **FASE 4**: ABM Servicios (selector alcance)
5. **FASE 5**: ABM Acabados (selector alcance)
6. **FASE 6**: Hook cálculo precios globales
7. **FASE 7**: Wizard - paso servicios/acabados grupo
8. **FASE 8**: Wizard - generación items con grupo
9. **FASE 9**: Visualización órdenes (agrupar items)
10. **FASE 10**: Footer totales (incluir globales)

---

## Documentación Adicional

Al finalizar todas las fases, crear archivo:
- `GUIA_USO_SERVICIOS_GLOBALES.md`: Guía de usuario explicando cómo usar servicios de grupo

---

## Notas de Implementación

- **Retrocompatibilidad total**: Items existentes funcionan sin cambios
- **Sin datos obligatorios**: Todos los nuevos campos son nullable
- **Validación exhaustiva**: Verificar que no se pierdan datos en ninguna transición
- **Testing**: Probar con órdenes existentes antes de cada fase
