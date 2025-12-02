# PLAN DETALLADO: Sistema de Ingresos Manuales para Tesorería

**Versión:** 1.0
**Fecha:** 2 de Diciembre, 2025
**Estado:** Listo para Implementación
**Validación:** Todos los nombres de tablas y campos verificados contra el schema actual

---

## ÍNDICE

1. [Contexto y Objetivo](#1-contexto-y-objetivo)
2. [Análisis del Sistema Actual](#2-análisis-del-sistema-actual)
3. [Fase 1: Base de Datos](#fase-1-base-de-datos)
4. [Fase 2: Backend (TypeScript)](#fase-2-backend-typescript)
5. [Fase 3: Frontend (Componentes)](#fase-3-frontend-componentes)
6. [Fase 4: Integración y Testing](#fase-4-integración-y-testing)
7. [Validaciones y Reglas de Negocio](#validaciones-y-reglas-de-negocio)
8. [Checklist de Implementación](#checklist-de-implementación)

---

## 1. CONTEXTO Y OBJETIVO

### 1.1 Problema Actual

El sistema de tesorería actualmente solo permite registrar ingresos a través de:
- **Pagos de órdenes de trabajo** → `ordenes_trabajo_pagos`
- **Pagos de centro de copiado** → `copiado_ordenes_pagos`

**Gap:** No es posible registrar ingresos manuales como:
- Préstamos recibidos
- Venta de activos
- Aportes de capital
- Reintegros
- Subsidios
- Ingresos por alquiler
- Otros ingresos extraordinarios

### 1.2 Objetivo

Implementar un sistema simétrico al de **egresos manuales** existente, que permita:
- Registrar ingresos de cualquier tipo
- Categorizar ingresos con tipos configurables
- Actualizar automáticamente el saldo de cajas
- Mantener trazabilidad completa
- Generar reportes consolidados

---

## 2. ANÁLISIS DEL SISTEMA ACTUAL

### 2.1 Tablas Existentes (Validadas)

#### A. **cajas**
```sql
CREATE TABLE cajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('efectivo', 'banco', 'pasarela')),
  identificador text,
  saldo_actual numeric DEFAULT 0 NOT NULL,
  moneda text DEFAULT 'ARS' NOT NULL,
  color text,
  icono text,
  es_principal boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT cajas_nombre_company_unique UNIQUE(company_id, nombre),
  CONSTRAINT cajas_saldo_no_negativo CHECK (saldo_actual >= 0)
);
```

#### B. **cajas_movimientos**
```sql
CREATE TABLE cajas_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id uuid NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
  tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('ingreso', 'egreso', 'transferencia', 'ajuste')),
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  referencia_tipo text CHECK (referencia_tipo IN ('pago_orden', 'pago_copiado', 'gasto', 'transferencia', 'ajuste')),
  referencia_id uuid,
  medio_cobro_id uuid REFERENCES medios_cobro(id) ON DELETE SET NULL,
  caja_destino_id uuid REFERENCES cajas(id) ON DELETE SET NULL,
  comision_aplicada numeric DEFAULT 0 NOT NULL CHECK (comision_aplicada >= 0),
  notas text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

#### C. **tipos_egreso**
```sql
CREATE TABLE tipos_egreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  codigo text NOT NULL,
  color text DEFAULT '#ef4444',
  icono text DEFAULT 'ArrowDownCircle',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tipos_egreso_nombre_unique UNIQUE (company_id, nombre),
  CONSTRAINT tipos_egreso_codigo_unique UNIQUE (company_id, codigo)
);
```

#### D. **egresos**
```sql
CREATE TABLE egresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  caja_id uuid NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
  tipo_egreso_id uuid NOT NULL REFERENCES tipos_egreso(id) ON DELETE RESTRICT,
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  numero_comprobante text,
  proveedor_nombre text,
  medio_pago text,
  notas text,
  movimiento_id uuid,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT egresos_medio_pago_check CHECK (
    medio_pago IS NULL OR
    medio_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'debito', 'otro')
  )
);
```

### 2.2 Archivos Frontend Existentes (Validados)

**Ubicaciones:**
- `src/pages/app/finanzas/TesoreriaView.tsx`
- `src/components/tesoreria/IngresosPanel.tsx`
- `src/components/tesoreria/EgresosPanel.tsx`
- `src/components/tesoreria/RegistrarEgresoModal.tsx`
- `src/hooks/useTesoreria.ts`
- `src/hooks/useEgresos.ts`
- `src/hooks/useTiposEgreso.ts`
- `src/types/tesoreria.ts`

---

## FASE 1: BASE DE DATOS

### 1.1 Nueva Tabla: `tipos_ingreso`

**Propósito:** Categorías configurables de ingresos manuales por empresa.

```sql
CREATE TABLE tipos_ingreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  codigo text NOT NULL,
  color text DEFAULT '#10b981',
  icono text DEFAULT 'ArrowUpCircle',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT tipos_ingreso_nombre_unique UNIQUE (company_id, nombre),
  CONSTRAINT tipos_ingreso_codigo_unique UNIQUE (company_id, codigo)
);
```

**Índices:**
```sql
CREATE INDEX idx_tipos_ingreso_company ON tipos_ingreso(company_id);
CREATE INDEX idx_tipos_ingreso_active ON tipos_ingreso(is_active) WHERE is_active = true;
```

**Datos iniciales:**
```sql
-- Nota: Se insertarán por empresa cuando sea necesario
-- Categorías sugeridas:
-- - Préstamo recibido
-- - Venta de activos
-- - Aporte de capital
-- - Reintegro
-- - Subsidio
-- - Ingreso por alquiler
-- - Otro ingreso
```

---

### 1.2 Nueva Tabla: `ingresos`

**Propósito:** Registro de ingresos manuales.

```sql
CREATE TABLE ingresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  caja_id uuid NOT NULL REFERENCES cajas(id) ON DELETE RESTRICT,
  tipo_ingreso_id uuid NOT NULL REFERENCES tipos_ingreso(id) ON DELETE RESTRICT,
  monto numeric NOT NULL CHECK (monto > 0),
  concepto text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  numero_comprobante text,
  origen text,
  medio_cobro_id uuid REFERENCES medios_cobro(id) ON DELETE SET NULL,
  notas text,
  movimiento_id uuid,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Índices:**
```sql
CREATE INDEX idx_ingresos_company ON ingresos(company_id);
CREATE INDEX idx_ingresos_caja ON ingresos(caja_id);
CREATE INDEX idx_ingresos_tipo ON ingresos(tipo_ingreso_id);
CREATE INDEX idx_ingresos_fecha ON ingresos(fecha DESC);
CREATE INDEX idx_ingresos_movimiento ON ingresos(movimiento_id);
```

---

### 1.3 Actualizar Constraint en `cajas_movimientos`

**Cambio necesario:** Agregar 'ingreso_manual' a `referencia_tipo`

```sql
ALTER TABLE cajas_movimientos DROP CONSTRAINT IF EXISTS cajas_movimientos_referencia_tipo_check;

ALTER TABLE cajas_movimientos ADD CONSTRAINT cajas_movimientos_referencia_tipo_check
CHECK (referencia_tipo IN ('pago_orden', 'pago_copiado', 'gasto', 'transferencia', 'ajuste', 'ingreso_manual'));
```

---

### 1.4 Función Trigger: Crear Movimiento Automático

```sql
CREATE OR REPLACE FUNCTION fn_crear_movimiento_ingreso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_movimiento_id uuid;
  v_comision numeric := 0;
BEGIN
  -- Obtener comisión del medio de cobro si existe
  IF NEW.medio_cobro_id IS NOT NULL THEN
    SELECT COALESCE(porcentaje_comision, 0) INTO v_comision
    FROM medios_cobro
    WHERE id = NEW.medio_cobro_id;

    v_comision := (NEW.monto * v_comision / 100);
  END IF;

  -- Crear movimiento de ingreso en la caja
  INSERT INTO cajas_movimientos (
    caja_id,
    tipo_movimiento,
    monto,
    concepto,
    fecha,
    referencia_tipo,
    referencia_id,
    medio_cobro_id,
    comision_aplicada,
    notas,
    created_by
  ) VALUES (
    NEW.caja_id,
    'ingreso',
    NEW.monto,
    NEW.concepto,
    NEW.fecha,
    'ingreso_manual',
    NEW.id,
    NEW.medio_cobro_id,
    v_comision,
    NEW.notas,
    NEW.created_by
  ) RETURNING id INTO v_movimiento_id;

  -- Actualizar movimiento_id en el ingreso
  UPDATE ingresos
  SET movimiento_id = v_movimiento_id
  WHERE id = NEW.id;

  -- Si hay comisión, crear movimiento de egreso
  IF v_comision > 0 THEN
    INSERT INTO cajas_movimientos (
      caja_id,
      tipo_movimiento,
      monto,
      concepto,
      fecha,
      referencia_tipo,
      referencia_id,
      notas,
      created_by
    ) VALUES (
      NEW.caja_id,
      'egreso',
      v_comision,
      'Comisión ' || NEW.concepto,
      NEW.fecha,
      'ingreso_manual',
      NEW.id,
      'Comisión aplicada por medio de cobro',
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;
```

**Asociar trigger:**
```sql
CREATE TRIGGER trg_ingresos_crear_movimiento
AFTER INSERT ON ingresos
FOR EACH ROW EXECUTE FUNCTION fn_crear_movimiento_ingreso();
```

---

### 1.5 Función Trigger: Eliminar Movimiento

```sql
CREATE OR REPLACE FUNCTION fn_eliminar_movimiento_ingreso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Eliminar movimiento(s) asociado(s)
  DELETE FROM cajas_movimientos
  WHERE referencia_tipo = 'ingreso_manual'
  AND referencia_id = OLD.id;

  RETURN OLD;
END;
$$;
```

**Asociar trigger:**
```sql
CREATE TRIGGER trg_ingresos_eliminar_movimiento
BEFORE DELETE ON ingresos
FOR EACH ROW EXECUTE FUNCTION fn_eliminar_movimiento_ingreso();
```

---

### 1.6 Triggers para `updated_at`

```sql
CREATE TRIGGER update_tipos_ingreso_updated_at
BEFORE UPDATE ON tipos_ingreso
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingresos_updated_at
BEFORE UPDATE ON ingresos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 1.7 Políticas RLS

#### Para `tipos_ingreso`:
```sql
ALTER TABLE tipos_ingreso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company tipos_ingreso"
ON tipos_ingreso FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert tipos_ingreso"
ON tipos_ingreso FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Admins can update own company tipos_ingreso"
ON tipos_ingreso FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Super admins can delete tipos_ingreso"
ON tipos_ingreso FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);
```

#### Para `ingresos`:
```sql
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ingresos"
ON ingresos FOR SELECT
TO authenticated
USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can insert ingresos"
ON ingresos FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin', 'manager')
  )
);

CREATE POLICY "Admins can delete own company ingresos"
ON ingresos FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);
```

---

### 1.8 Comentarios de Documentación

```sql
COMMENT ON TABLE tipos_ingreso IS 'Categorías configurables de ingresos manuales por empresa';
COMMENT ON TABLE ingresos IS 'Registro de ingresos manuales (no provenientes de ventas)';

COMMENT ON COLUMN ingresos.origen IS 'Describe de quién o dónde proviene el ingreso (ej: nombre del prestamista, comprador del activo, etc.)';
COMMENT ON COLUMN ingresos.numero_comprobante IS 'Número de factura, recibo o comprobante asociado';
COMMENT ON COLUMN ingresos.movimiento_id IS 'Referencia al movimiento automático creado en cajas_movimientos';
```

---

## FASE 2: BACKEND (TYPESCRIPT)

### 2.1 Actualizar: `src/types/tesoreria.ts`

**Agregar interfaces:**

```typescript
// ===== TIPOS DE INGRESO =====
export interface TipoIngreso {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  color: string;
  icono: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== INGRESO =====
export interface Ingreso {
  id: string;
  company_id: string;
  caja_id: string;
  tipo_ingreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante: string | null;
  origen: string | null;
  medio_cobro_id: string | null;
  notas: string | null;
  movimiento_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Relaciones
  caja?: {
    nombre: string;
    moneda: string;
    tipo: string;
  };
  tipo_ingreso?: {
    nombre: string;
    color: string;
    icono: string;
  };
  medio_cobro?: {
    nombre: string;
    categoria: string;
  };
  created_by_profile?: {
    full_name: string;
  };
}

// ===== CREATE INGRESO =====
export interface CreateIngresoData {
  caja_id: string;
  tipo_ingreso_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  numero_comprobante?: string;
  origen?: string;
  medio_cobro_id?: string;
  notas?: string;
}

// ===== UPDATE INGRESO =====
export interface UpdateIngresoData {
  monto?: number;
  concepto?: string;
  fecha?: string;
  numero_comprobante?: string;
  origen?: string;
  medio_cobro_id?: string;
  notas?: string;
}
```

---

## NOMBRES VALIDADOS - REFERENCIA RÁPIDA

### Tablas Existentes
- `cajas`
- `cajas_movimientos`
- `tipos_egreso`
- `egresos`
- `medios_cobro`
- `profiles`
- `companies`

### Tablas Nuevas
- `tipos_ingreso`
- `ingresos`

### Campos Clave
**cajas:**
- `saldo_actual` (numeric)
- `is_active` (boolean)

**cajas_movimientos:**
- `tipo_movimiento` ('ingreso', 'egreso', 'transferencia', 'ajuste')
- `referencia_tipo` ('pago_orden', 'pago_copiado', 'gasto', 'transferencia', 'ajuste', **'ingreso_manual'**)
- `comision_aplicada` (numeric)

**ingresos:**
- `tipo_ingreso_id` (uuid → tipos_ingreso)
- `origen` (text) - De quién/dónde viene
- `movimiento_id` (uuid → cajas_movimientos)

---

## CHECKLIST DE IMPLEMENTACIÓN

### FASE 1: Base de Datos ✅
- [ ] Crear tabla `tipos_ingreso`
- [ ] Crear tabla `ingresos`
- [ ] Actualizar constraint de `cajas_movimientos.referencia_tipo`
- [ ] Crear función `fn_crear_movimiento_ingreso()`
- [ ] Crear trigger para INSERT en `ingresos`
- [ ] Crear función `fn_eliminar_movimiento_ingreso()`
- [ ] Crear trigger para DELETE en `ingresos`
- [ ] Crear triggers para `updated_at`
- [ ] Configurar RLS en `tipos_ingreso`
- [ ] Configurar RLS en `ingresos`
- [ ] Agregar comentarios de documentación

### FASE 2: Backend ✅
- [ ] Actualizar `src/types/tesoreria.ts`
- [ ] Crear `src/hooks/useTiposIngreso.ts`
- [ ] Crear `src/hooks/useIngresos.ts`

### FASE 3: Frontend ✅
- [ ] Crear `src/components/tesoreria/RegistrarIngresoModal.tsx`
- [ ] Actualizar `src/components/tesoreria/IngresosPanel.tsx`

### FASE 4: Testing ✅
- [ ] Test: Registro básico
- [ ] Test: Ingreso con comisión
- [ ] Test: Validaciones
- [ ] Test: Eliminación
- [ ] Test: Filtros
- [ ] Build final

---

**FIN DEL DOCUMENTO**
