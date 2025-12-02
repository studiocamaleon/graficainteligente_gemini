# Plan de Implementación: Módulo de Negociación (Presupuestos/Cotizaciones)

## Índice
1. [Visión General](#visión-general)
2. [Análisis de Impacto](#análisis-de-impacto)
3. [Estructura de Base de Datos](#estructura-de-base-de-datos)
4. [Fases de Implementación](#fases-de-implementación)
5. [Mejoras y Agregados Propuestos](#mejoras-y-agregados-propuestos)

---

## Visión General

### Objetivo
Crear un módulo completo de Negociación que permita gestionar presupuestos/cotizaciones de manera independiente a las órdenes de trabajo, con capacidad de:
- Crear presupuestos con items del sistema o personalizados
- Generar PDFs de cotización con condiciones comerciales
- Enviar notificaciones WhatsApp automáticas
- Tracking público para que clientes consulten estado
- Aprobación/rechazo desde el cliente
- Conversión automática de presupuesto aprobado → orden de trabajo

### Estados del Presupuesto
- **borrador**: En proceso de creación, aún no enviado
- **pendiente**: Completado pero esperando envío al cliente
- **enviado**: Enviado al cliente, esperando respuesta
- **aprobado**: Cliente aprobó el presupuesto
- **rechazado**: Cliente rechazó el presupuesto
- **convertido**: Ya se convirtió en orden de trabajo
- **vencido**: Superó la fecha de validez sin respuesta

---

## Análisis de Impacto

### Módulos Afectados

#### 1. **Órdenes de Trabajo** ✅
- **Impacto**: Bajo - Solo se agregará relación opcional
- **Cambios**:
  - Agregar campo `presupuesto_id` (uuid nullable) a `ordenes_trabajo`
  - Permitir crear OT desde presupuesto aprobado copiando configuración
  - No rompe lógica existente

#### 2. **WhatsApp Notificaciones** ✅
- **Impacto**: Medio - Extensión de funcionalidad
- **Cambios**:
  - Agregar campo `presupuesto_id` (uuid nullable) a `whatsapp_notificaciones`
  - Agregar nuevos tipos de notificación en constraint:
    - `presupuesto_creado`
    - `presupuesto_listo`
    - `presupuesto_enviado`
    - `presupuesto_aprobado`
    - `presupuesto_rechazado`
    - `presupuesto_vencido`
  - No afecta notificaciones existentes

#### 3. **Storage/Archivos** ✅
- **Impacto**: Bajo - Nuevo bucket independiente
- **Cambios**:
  - Crear bucket `presupuestos-archivos` para PDFs generados
  - Reutilizar sistema de archivos temporales existente
  - No afecta buckets actuales

#### 4. **Clientes** ✅
- **Impacto**: Ninguno
- **Cambios**: Solo lectura, sin modificaciones

#### 5. **Tracking Público** ✅
- **Impacto**: Medio - Nueva función similar
- **Cambios**:
  - Crear función `fn_get_public_presupuesto_tracking`
  - Reutilizar sistema de tokens único
  - Página pública independiente

#### 6. **Notificaciones Internas** ✅
- **Impacto**: Bajo
- **Cambios**:
  - Agregar notificaciones para aprobaciones/rechazos de clientes
  - Usar tabla `notificaciones` existente

---

## Estructura de Base de Datos

### Tablas Nuevas (Validadas)

#### 1. `presupuestos`
```sql
CREATE TABLE presupuestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  cliente_id uuid NOT NULL REFERENCES clients(id),
  numero_presupuesto text NOT NULL, -- Auto-generado
  vendedor_id uuid NOT NULL REFERENCES profiles(id),
  canal_venta text NOT NULL CHECK (canal_venta IN ('Web', 'WhatsApp', 'Mostrador')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN (
    'borrador', 'pendiente', 'enviado', 'aprobado',
    'rechazado', 'convertido', 'vencido'
  )),

  -- Fechas
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_validez timestamptz, -- Hasta cuándo es válido
  fecha_enviado timestamptz, -- Cuándo se envió al cliente
  fecha_respuesta timestamptz, -- Cuándo respondió el cliente
  fecha_vencimiento_auto timestamptz, -- Para auto-vencer

  -- Tracking público
  tracking_token varchar(32) UNIQUE,

  -- Montos
  subtotal numeric NOT NULL DEFAULT 0,
  total_descuentos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,

  -- Condiciones comerciales (texto libre o template)
  condiciones_comerciales text,
  notas_internas text,
  observaciones_cliente text, -- Comentarios del cliente al aprobar/rechazar

  -- Conversión
  orden_trabajo_id uuid REFERENCES ordenes_trabajo(id), -- Si ya se convirtió

  -- Archivos
  pdf_path text, -- Path del PDF en storage
  pdf_url text, -- URL pública temporal

  -- Auditoría
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT presupuestos_numero_unique UNIQUE (company_id, numero_presupuesto),
  CONSTRAINT check_subtotal_positivo CHECK (subtotal >= 0),
  CONSTRAINT check_total_positivo CHECK (total >= 0),
  CONSTRAINT check_fecha_validez CHECK (fecha_validez IS NULL OR fecha_validez > fecha_creacion),
  CONSTRAINT check_tracking_token_format CHECK (
    tracking_token IS NULL OR
    (length(tracking_token) = 32 AND tracking_token ~ '^[A-Z0-9]{32}$')
  )
);
```

#### 2. `presupuestos_items`
```sql
CREATE TABLE presupuestos_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,

  -- Tipo de item
  tipo_item text NOT NULL DEFAULT 'producto_sistema' CHECK (tipo_item IN (
    'producto_sistema', -- Item del catálogo
    'item_personalizado' -- Item ingresado manualmente
  )),

  -- Si es producto del sistema
  producto_id uuid, -- Nullable, solo si tipo_item = 'producto_sistema'
  producto_nombre text NOT NULL, -- Siempre se guarda para histórico
  producto_categoria text, -- Categoría para histórico

  -- Configuración (para productos del sistema)
  configuracion jsonb NOT NULL DEFAULT '{}',

  -- Cantidades y precios
  cantidad numeric NOT NULL,
  precio_base numeric NOT NULL DEFAULT 0,
  precio_servicios numeric NOT NULL DEFAULT 0,
  precio_acabados numeric NOT NULL DEFAULT 0,
  precio_unitario_final numeric NOT NULL DEFAULT 0,
  precio_total numeric NOT NULL DEFAULT 0,

  -- Descripción adicional (útil para items personalizados)
  descripcion text,

  -- Tiempos estimados (para dar expectativas al cliente)
  tiempo_produccion_dias integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT check_producto_sistema CHECK (
    (tipo_item = 'producto_sistema' AND producto_id IS NOT NULL) OR
    (tipo_item = 'item_personalizado' AND producto_id IS NULL)
  ),
  CONSTRAINT check_cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT check_precios_positivos CHECK (
    precio_base >= 0 AND
    precio_servicios >= 0 AND
    precio_acabados >= 0 AND
    precio_unitario_final >= 0 AND
    precio_total >= 0
  )
);
```

#### 3. `presupuestos_condiciones_comerciales`
```sql
-- Templates de condiciones comerciales configurables
CREATE TABLE presupuestos_condiciones_comerciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  nombre text NOT NULL, -- "Condiciones Estándar", "Condiciones Gran Formato", etc.
  contenido text NOT NULL, -- Texto de las condiciones (soporta markdown)
  es_default boolean DEFAULT false,
  orden integer DEFAULT 0, -- Para ordenar en selects
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT condiciones_nombre_unique UNIQUE (company_id, nombre)
);
```

#### 4. `presupuestos_archivos`
```sql
-- Archivos adjuntos al presupuesto (referencias, ejemplos, etc.)
CREATE TABLE presupuestos_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid REFERENCES presupuestos(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id),

  nombre_archivo text NOT NULL,
  nombre_storage text NOT NULL,
  tipo_mime text NOT NULL,
  tamano_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  descripcion text,

  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),

  -- Soporte para archivos temporales (antes de crear presupuesto)
  presupuesto_temporal_id uuid,
  temporal_creado_en timestamptz,

  CONSTRAINT check_presupuesto_o_temporal CHECK (
    presupuesto_id IS NOT NULL OR presupuesto_temporal_id IS NOT NULL
  )
);
```

#### 5. `presupuestos_historial`
```sql
-- Auditoría de cambios en presupuestos
CREATE TABLE presupuestos_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  accion text NOT NULL, -- 'creado', 'modificado', 'enviado', 'aprobado', etc.
  estado_anterior text,
  estado_nuevo text,
  usuario_id uuid REFERENCES profiles(id),
  detalles jsonb, -- Información adicional del cambio
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Tablas Modificadas

#### 1. `ordenes_trabajo` (Agregar campo)
```sql
ALTER TABLE ordenes_trabajo
  ADD COLUMN presupuesto_id uuid REFERENCES presupuestos(id);

CREATE INDEX idx_ordenes_trabajo_presupuesto_id
  ON ordenes_trabajo(presupuesto_id)
  WHERE presupuesto_id IS NOT NULL;
```

#### 2. `whatsapp_notificaciones` (Agregar campo y constraint)
```sql
ALTER TABLE whatsapp_notificaciones
  ADD COLUMN presupuesto_id uuid REFERENCES presupuestos(id);

-- Actualizar constraint de tipo_notificacion
ALTER TABLE whatsapp_notificaciones
  DROP CONSTRAINT IF EXISTS whatsapp_notificaciones_tipo_notificacion_check;

ALTER TABLE whatsapp_notificaciones
  ADD CONSTRAINT whatsapp_notificaciones_tipo_notificacion_check
  CHECK (tipo_notificacion IN (
    'orden_finalizada',
    'orden_copiado_finalizada',
    'presupuesto_creado',
    'presupuesto_listo',
    'presupuesto_enviado',
    'presupuesto_aprobado',
    'presupuesto_rechazado',
    'presupuesto_vencido'
  ));

-- Check para asegurar que al menos una referencia existe
ALTER TABLE whatsapp_notificaciones
  ADD CONSTRAINT check_referencia_notificacion
  CHECK (
    orden_trabajo_id IS NOT NULL OR
    orden_copiado_id IS NOT NULL OR
    presupuesto_id IS NOT NULL
  );

CREATE INDEX idx_whatsapp_notif_presupuesto
  ON whatsapp_notificaciones(presupuesto_id)
  WHERE presupuesto_id IS NOT NULL;
```

---

## Fases de Implementación

### **FASE 1: Base de Datos y Backend Core**
**Objetivo**: Crear estructura de datos completa y funciones básicas

#### Migraciones SQL:
1. Crear tabla `presupuestos` con todos los campos validados
2. Crear tabla `presupuestos_items`
3. Crear tabla `presupuestos_condiciones_comerciales`
4. Crear tabla `presupuestos_archivos`
5. Crear tabla `presupuestos_historial`
6. Modificar `ordenes_trabajo` agregando `presupuesto_id`
7. Modificar `whatsapp_notificaciones` agregando `presupuesto_id` y tipos

#### Funciones y Triggers:
```sql
-- Función para generar número de presupuesto automático
CREATE OR REPLACE FUNCTION fn_generar_numero_presupuesto(p_company_id uuid)
RETURNS text;

-- Trigger para actualizar updated_at
CREATE TRIGGER tr_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para generar tracking_token
CREATE TRIGGER tr_presupuestos_tracking_token
  BEFORE INSERT ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION set_tracking_token();

-- Trigger para registrar en historial
CREATE OR REPLACE FUNCTION fn_presupuestos_registro_historial()
RETURNS TRIGGER;

-- Trigger para actualizar totales al modificar items
CREATE OR REPLACE FUNCTION fn_actualizar_totales_presupuesto()
RETURNS TRIGGER;

-- Función para vencimiento automático de presupuestos
CREATE OR REPLACE FUNCTION fn_vencer_presupuestos_expirados()
RETURNS void;
```

#### RLS Policies:
- Presupuestos: Solo usuarios de la company pueden ver/editar
- Items: Heredan permisos del presupuesto padre
- Condiciones comerciales: Solo admin/super_admin edita, todos leen
- Archivos: Solo usuarios de la company
- Historial: Solo lectura para usuarios de la company

#### Storage Bucket:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'presupuestos-archivos',
  'presupuestos-archivos',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.adobe.illustrator',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/svg+xml',
    'application/zip',
    'text/plain'
  ]::text[]
);
```

---

### **FASE 2: TypeScript Types y Hooks Backend**
**Objetivo**: Definir tipos e interfaces para el frontend

#### Archivos a crear:

**`src/types/presupuestos.ts`**
```typescript
export interface Presupuesto {
  id: string;
  company_id: string;
  cliente_id: string;
  numero_presupuesto: string;
  vendedor_id: string;
  canal_venta: 'Web' | 'WhatsApp' | 'Mostrador';
  estado: 'borrador' | 'pendiente' | 'enviado' | 'aprobado' | 'rechazado' | 'convertido' | 'vencido';
  fecha_creacion: string;
  fecha_validez?: string;
  fecha_enviado?: string;
  fecha_respuesta?: string;
  tracking_token?: string;
  subtotal: number;
  total_descuentos: number;
  total: number;
  condiciones_comerciales?: string;
  notas_internas?: string;
  observaciones_cliente?: string;
  orden_trabajo_id?: string;
  pdf_path?: string;
  pdf_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PresupuestoItem {
  id: string;
  presupuesto_id: string;
  tipo_item: 'producto_sistema' | 'item_personalizado';
  producto_id?: string;
  producto_nombre: string;
  producto_categoria?: string;
  configuracion: any;
  cantidad: number;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_unitario_final: number;
  precio_total: number;
  descripcion?: string;
  tiempo_produccion_dias?: number;
}

export interface CondicionComercial {
  id: string;
  company_id: string;
  nombre: string;
  contenido: string;
  es_default: boolean;
  orden: number;
  is_active: boolean;
}

export interface CreatePresupuestoData {
  cliente_id: string;
  vendedor_id: string;
  canal_venta: 'Web' | 'WhatsApp' | 'Mostrador';
  fecha_validez?: string;
  condiciones_comerciales?: string;
  notas_internas?: string;
}

export interface UpdatePresupuestoData {
  fecha_validez?: string;
  condiciones_comerciales?: string;
  notas_internas?: string;
  estado?: string;
}
```

#### Hooks a crear:
- `usePresupuestos()` - CRUD presupuestos
- `usePresupuesto(id)` - Detalle individual
- `usePresupuestoItems()` - Gestión de items
- `useCondicionesComerciales()` - ABM condiciones
- `usePresupuestoArchivos()` - Gestión archivos
- `usePresupuestoHistorial(id)` - Ver historial
- `useConvertirPresupuesto()` - Conversión a OT

---

### **FASE 3: UI - ABM Condiciones Comerciales**
**Objetivo**: Configuración de templates de condiciones

#### Componentes a crear:
- `src/pages/app/negociacion/CondicionesComerciales.tsx` - Página principal
- `src/components/negociacion/CondicionComercialForm.tsx` - Formulario modal
- `src/components/negociacion/CondicionComercialCard.tsx` - Card individual

#### Funcionalidad:
- Listar condiciones con búsqueda
- Crear/editar/eliminar condiciones
- Marcar como default
- Editor de texto con markdown (opcional)
- Ordenamiento drag-and-drop
- Preview del contenido

---

### **FASE 4: UI - Creación de Presupuestos**
**Objetivo**: Wizard para crear presupuestos similar a órdenes

#### Componentes a crear:
- `src/pages/app/negociacion/CrearPresupuesto.tsx` - Página wizard
- `src/components/negociacion/PresupuestoGeneralSection.tsx` - Info general
- `src/components/negociacion/PresupuestoItemsSection.tsx` - Gestión items
- `src/components/negociacion/AddItemPresupuestoModal.tsx` - Agregar item sistema
- `src/components/negociacion/AddItemPersonalizadoModal.tsx` - Item manual
- `src/components/negociacion/PresupuestoCondicionesSection.tsx` - Selector condiciones
- `src/components/negociacion/PresupuestoResumenSection.tsx` - Resumen final

#### Funcionalidad:
- Sección 1: Info general (cliente, vendedor, canal, fecha validez)
- Sección 2: Items del presupuesto
  - Agregar productos del sistema (reutilizar wizard universal)
  - Agregar items personalizados (input manual precio/descripción)
  - Editar/eliminar items
  - Ver totales en tiempo real
- Sección 3: Condiciones comerciales (selector template + edición)
- Sección 4: Archivos adjuntos (referencias, ejemplos)
- Sección 5: Resumen y acciones
  - Guardar como borrador
  - Guardar y enviar
  - Cancelar

---

### **FASE 5: UI - Listado y Gestión de Presupuestos**
**Objetivo**: Visualización y administración de presupuestos

#### Componentes a crear:
- `src/pages/app/negociacion/Presupuestos.tsx` - Listado principal
- `src/components/negociacion/PresupuestoCard.tsx` - Card en vista kanban
- `src/components/negociacion/PresupuestoFilters.tsx` - Filtros búsqueda
- `src/components/negociacion/PresupuestoStatusBadge.tsx` - Badge de estado

#### Funcionalidad:
- Vista tipo Kanban por estados (borrador, pendiente, enviado, etc.)
- Vista tabla con filtros avanzados
- Búsqueda por número, cliente, vendedor
- Filtros por fecha, estado, canal
- Acciones rápidas:
  - Ver detalle
  - Editar (solo si borrador/pendiente)
  - Enviar al cliente
  - Duplicar
  - Eliminar
  - Ver tracking público

---

### **FASE 6: UI - Detalle de Presupuesto**
**Objetivo**: Vista completa con todas las acciones

#### Componentes a crear:
- `src/pages/app/negociacion/DetallePresupuesto.tsx` - Página detalle
- `src/components/negociacion/PresupuestoHeader.tsx` - Header con info
- `src/components/negociacion/PresupuestoItemsTab.tsx` - Tab items
- `src/components/negociacion/PresupuestoArchivosTab.tsx` - Tab archivos
- `src/components/negociacion/PresupuestoHistorialTab.tsx` - Tab historial
- `src/components/negociacion/PresupuestoAccionesMenu.tsx` - Menú acciones

#### Funcionalidad:
- Tabs: Items, Archivos, Historial
- Botones de acción según estado:
  - **Borrador**: Editar, Eliminar, Enviar
  - **Pendiente**: Enviar, Editar, Eliminar
  - **Enviado**: Reenviar, Ver tracking, Cancelar
  - **Aprobado**: Convertir a OT, Ver OT (si ya se convirtió)
  - **Rechazado**: Duplicar, Ver motivo rechazo
- Ver PDF generado
- Copiar link de tracking
- Ver observaciones del cliente

---

### **FASE 7: Generación de PDF de Presupuesto**
**Objetivo**: Crear PDF profesional con jsPDF

#### Componentes a crear:
- `src/utils/pdfGenerators/presupuestoPDF.ts` - Generador principal
- `src/components/pdf/templates/PresupuestoPDFTemplate.tsx` - Template visual

#### Funcionalidad PDF:
- Header con logo y datos de la empresa
- Datos del cliente
- Número de presupuesto y fecha
- Tabla de items con:
  - Descripción
  - Cantidad
  - Precio unitario
  - Subtotal
- Subtotal, descuentos, total
- Condiciones comerciales
- Validez del presupuesto
- Datos de contacto
- Footer con información legal

#### Proceso:
1. Generar PDF en base64
2. Guardar en storage bucket `presupuestos-archivos`
3. Actualizar `pdf_path` en registro
4. Generar URL temporal para compartir (1 semana validez)

---

### **FASE 8: Integración WhatsApp - Notificaciones**
**Objetivo**: Envío automático de notificaciones

#### Edge Function a crear/modificar:
- Modificar `notify-orden-finalizada` para soportar presupuestos
- O crear `notify-presupuesto` específica

#### Tipos de notificaciones:

**1. Presupuesto Creado (solicitud pendiente)**
```
🔔 *Hola {cliente}!*

Hemos recibido tu solicitud de presupuesto.

📋 Número: *{numero_presupuesto}*
📅 Fecha: {fecha}

Nuestro equipo está trabajando en preparar tu cotización. Te notificaremos cuando esté lista.

🔗 Seguí el estado acá: {tracking_url}

¿Consultas? Escribinos!
```

**2. Presupuesto Listo**
```
✅ *Tu presupuesto está listo!*

📋 Presupuesto: *{numero_presupuesto}*
💰 Total: *${total}*
📅 Válido hasta: {fecha_validez}

📄 Descargá el PDF: {pdf_url}
🔗 Ver online: {tracking_url}

Desde el link podés aprobar el presupuesto directamente.

¿Dudas? ¡Contactanos!
```

**3. Presupuesto Aprobado (confirmación al cliente)**
```
🎉 *Presupuesto aprobado!*

Gracias por tu confirmación. Ya comenzamos a procesar tu orden.

📋 Presupuesto: {numero_presupuesto}
🆔 Orden de Trabajo: {numero_orden}
📅 Entrega estimada: {fecha_entrega}

🔗 Seguí tu pedido: {tracking_orden_url}
```

**4. Presupuesto Vencido**
```
⏰ *Presupuesto vencido*

El presupuesto #{numero_presupuesto} ha vencido.

Si aún te interesa, podemos:
- Renovarlo
- Ajustar precios actuales
- Modificar lo que necesites

¿Seguimos adelante? ¡Escribinos!
```

#### Triggers para envío:
- Al cambiar estado → `enviado`: Enviar "Presupuesto Listo"
- Al cambiar estado → `aprobado`: Notificar empresa y cliente
- Job diario: Detectar vencidos y notificar

---

### **FASE 9: Tracking Público de Presupuesto**
**Objetivo**: Página pública para consultar estado

#### Función de base de datos:
```sql
CREATE OR REPLACE FUNCTION fn_get_public_presupuesto_tracking(p_tracking_token varchar)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
-- Retorna info pública del presupuesto
$$;
```

#### Componentes a crear:
- `src/pages/public/PresupuestoTracking.tsx` - Página principal
- `src/components/tracking-presupuesto/PresupuestoHeader.tsx` - Header
- `src/components/tracking-presupuesto/PresupuestoEstado.tsx` - Estado visual
- `src/components/tracking-presupuesto/PresupuestoItems.tsx` - Items
- `src/components/tracking-presupuesto/PresupuestoAccionesCliente.tsx` - Botones

#### Funcionalidad:
- Ver estado del presupuesto en tiempo real
- Descargar PDF
- Ver items cotizados
- Ver condiciones comerciales
- Ver fecha de validez
- **Botones de acción** (solo si estado = enviado):
  - ✅ Aprobar presupuesto (abre modal confirmación)
  - ❌ Rechazar (abre modal con motivo)
  - 💬 Consultar (link a WhatsApp)

#### Modal de Aprobación:
- Confirmación del cliente
- Campo opcional: Observaciones
- Botón "Confirmar aprobación"
- Al confirmar:
  - Cambia estado → `aprobado`
  - Envía notificación al sistema
  - Muestra mensaje: "Tu aprobación fue registrada. Pronto nos contactaremos."

#### Modal de Rechazo:
- Razón del rechazo (requerido)
- Campo observaciones
- Botón "Confirmar rechazo"
- Al confirmar:
  - Cambia estado → `rechazado`
  - Guarda observaciones
  - Notifica al sistema
  - Muestra mensaje: "Gracias por tu respuesta. Te contactaremos pronto."

---

### **FASE 10: Notificaciones Internas (Empresa)**
**Objetivo**: Alertar al equipo sobre acciones del cliente

#### Componentes a modificar:
- `src/components/notifications/NotificationsPanel.tsx` - Agregar tipos

#### Tipos de notificación interna:
- 🎉 **Presupuesto Aprobado**: "{Cliente} aprobó el presupuesto #{numero}"
- ❌ **Presupuesto Rechazado**: "{Cliente} rechazó el presupuesto #{numero}"
- ⏰ **Presupuesto por Vencer**: "El presupuesto #{numero} vence en {dias} días"
- ⏰ **Presupuesto Vencido**: "El presupuesto #{numero} ha vencido"

#### Triggers en base de datos:
```sql
CREATE OR REPLACE FUNCTION fn_notificar_aprobacion_presupuesto()
RETURNS TRIGGER;

CREATE OR REPLACE FUNCTION fn_notificar_rechazo_presupuesto()
RETURNS TRIGGER;
```

---

### **FASE 11: Conversión Presupuesto → Orden de Trabajo**
**Objetivo**: Crear OT automáticamente desde presupuesto aprobado

#### Función de base de datos:
```sql
CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_orden(
  p_presupuesto_id uuid,
  p_fecha_entrega_estimada timestamptz DEFAULT NULL,
  p_notas_adicionales text DEFAULT NULL
)
RETURNS uuid -- Retorna ID de la orden creada
LANGUAGE plpgsql
AS $$
DECLARE
  v_orden_id uuid;
  v_item record;
BEGIN
  -- Validar que presupuesto está aprobado
  IF NOT EXISTS (
    SELECT 1 FROM presupuestos
    WHERE id = p_presupuesto_id AND estado = 'aprobado'
  ) THEN
    RAISE EXCEPTION 'El presupuesto debe estar aprobado para convertirse';
  END IF;

  -- Crear orden de trabajo copiando datos del presupuesto
  INSERT INTO ordenes_trabajo (...)
  RETURNING id INTO v_orden_id;

  -- Copiar items (solo productos del sistema, items personalizados requieren revisión)
  FOR v_item IN
    SELECT * FROM presupuestos_items
    WHERE presupuesto_id = p_presupuesto_id
      AND tipo_item = 'producto_sistema'
  LOOP
    INSERT INTO ordenes_trabajo_items (...);
  END LOOP;

  -- Actualizar presupuesto
  UPDATE presupuestos
  SET
    estado = 'convertido',
    orden_trabajo_id = v_orden_id
  WHERE id = p_presupuesto_id;

  RETURN v_orden_id;
END;
$$;
```

#### Componente UI:
- `src/components/negociacion/ConvertirPresupuestoModal.tsx`

#### Funcionalidad:
- Modal de confirmación
- Campos adicionales:
  - Fecha entrega estimada (opcional)
  - Notas internas adicionales
  - Checkbox: "Copiar archivos adjuntos"
- Advertencia si hay items personalizados:
  - "Este presupuesto tiene {N} items personalizados que no se pueden copiar automáticamente. Deberás agregarlos manualmente a la orden."
- Al confirmar:
  - Ejecuta función de conversión
  - Genera rutas de producción automáticas
  - Redirige a detalle de la orden creada
  - Muestra toast: "Orden #{numero} creada desde presupuesto #{numero_presupuesto}"

---

### **FASE 12: Integración con Menú y Navegación**
**Objetivo**: Agregar módulo al sistema

#### Archivos a modificar:

**`src/constants/modules.ts`**
```typescript
{
  id: 'negociacion',
  name: 'Negociación',
  description: 'Presupuestos y cotizaciones',
  icon: FileText, // o Calculator, o Receipt
  path: '/app/negociacion',
  color: 'text-blue-600',
  children: [
    {
      id: 'negociacion-presupuestos',
      name: 'Presupuestos',
      description: 'Gestión de presupuestos y cotizaciones',
      path: '/app/negociacion/presupuestos',
      icon: FileText,
    },
    {
      id: 'negociacion-crear',
      name: 'Crear Presupuesto',
      description: 'Nuevo presupuesto',
      path: '/app/negociacion/crear',
      icon: FilePlus,
    },
    {
      id: 'negociacion-condiciones',
      name: 'Condiciones Comerciales',
      description: 'Templates de condiciones',
      path: '/app/negociacion/condiciones',
      icon: FileCheck,
    },
  ],
}
```

**`src/App.tsx`**
- Agregar rutas del módulo
- Ruta pública: `/tracking/presupuesto/:token`

---

## Mejoras y Agregados Propuestos

### 1. **Versiones de Presupuesto** 📝
**Problema**: Cliente pide ajustes, necesitamos nueva versión
**Solución**:
- Agregar campo `version` a `presupuestos`
- Agregar campo `presupuesto_padre_id` (self-reference)
- Función `fn_duplicar_presupuesto()` que crea v2, v3, etc.
- En tracking mostrar: "Este presupuesto tiene una nueva versión: Ver v2"

### 2. **Descuentos por Item y General** 💰
**Mejora actual**: Solo hay `total_descuentos` global
**Propuesta**:
- Agregar `descuento_porcentaje` y `descuento_monto` en `presupuestos_items`
- Agregar `descuento_general_porcentaje` en `presupuestos`
- Calcular totales considerando ambos niveles

### 3. **Comparador de Presupuestos** 📊
**Funcionalidad**: Comparar versiones o múltiples presupuestos
- Vista lado a lado
- Destacar diferencias en items y precios
- Útil para cliente que pidió varias opciones

### 4. **Plantillas de Presupuesto** 📋
**Uso**: Presupuestos recurrentes (ej: folletos mensuales)
- Tabla `presupuestos_plantillas`
- Crear presupuesto desde plantilla con 1 click
- Actualiza precios automáticamente

### 5. **Recordatorios Automáticos** ⏰
**Edge Function programada**:
- Cada 2 días: "Recordá que tu presupuesto vence en X días"
- Solo si estado = `enviado` y no respondió
- Máximo 2 recordatorios

### 6. **Análisis y Métricas** 📈
**Dashboard de negociación**:
- Tasa de conversión presupuesto → orden
- Tiempo promedio de respuesta del cliente
- Presupuestos por estado (gráfico)
- Valor total en negociación
- Top clientes por presupuestos solicitados
- Motivos de rechazo más comunes

### 7. **Firma Digital del Cliente** ✍️
**Mejora tracking público**:
- Opción para cliente firme digitalmente
- Canvas para firma con dedo/mouse
- Guardar imagen firma en storage
- Campo `firma_path` en presupuestos

### 8. **Múltiples Variantes en Mismo Presupuesto** 🔀
**Caso**: Cliente quiere 3 opciones de precio
- Agrupar items en "Opción A", "Opción B", "Opción C"
- Cliente elige cuál aprobar
- Campo `grupo_opcion` en items

### 9. **Integración con CRM** 📇
**Si se agrega CRM futuro**:
- Registrar presupuesto como actividad del cliente
- Pipeline de ventas con estados
- Score de probabilidad de cierre

### 10. **Exportar a Excel** 📊
**Funcionalidad extra**:
- Botón "Exportar presupuesto a Excel"
- Útil para clientes corporativos
- Formato editable para su proceso interno

### 11. **Comentarios Cliente-Empresa en Tracking** 💬
**Chat simple en tracking**:
- Cliente pregunta sobre item específico
- Empresa responde (notificación WhatsApp)
- Historial de conversación
- Sin necesidad de salir del tracking

### 12. **Auto-guardado de Borradores** 💾
**UX mejorado**:
- Guardar automáticamente cada X segundos
- Toast: "Guardado automáticamente"
- Recuperar borradores si se cierra navegador

---

## Consideraciones Técnicas

### Performance
- Índices en campos de búsqueda frecuente
- Paginación en listados
- Lazy loading de items
- Cache de PDFs generados (1 semana)

### Seguridad
- RLS en todas las tablas nuevas
- Validación de tracking_token server-side
- Rate limiting en endpoint público de tracking
- Sanitización de inputs en observaciones cliente

### Escalabilidad
- Job para limpiar archivos temporales viejos
- Job para vencer presupuestos expirados
- Soft delete en lugar de eliminación física
- Archival de presupuestos antiguos

### Testing
- Probar flujo completo: Crear → Enviar → Aprobar → Convertir
- Validar generación de PDF con diferentes cantidades de items
- Verificar notificaciones WhatsApp en sandbox
- Test de tracking público sin autenticación

---

## Dependencias Existentes Reutilizadas

✅ Sistema de clientes (tabla `clients`)
✅ Sistema de usuarios/vendedores (tabla `profiles`)
✅ Sistema de productos (todos los catálogos)
✅ Wizard universal de items (reutilizar completo)
✅ Sistema de archivos temporales
✅ Generación de tokens únicos
✅ Integración WhatsApp (Evolution API)
✅ Storage de Supabase (buckets)
✅ Sistema de notificaciones internas
✅ Cálculo de precios (hooks existentes)
✅ PDF generation con jsPDF

---

## Estimación de Tiempo

- **Fase 1** (DB): 4-6 horas
- **Fase 2** (Types/Hooks): 3-4 horas
- **Fase 3** (Condiciones): 2-3 horas
- **Fase 4** (Creación): 6-8 horas
- **Fase 5** (Listado): 3-4 horas
- **Fase 6** (Detalle): 4-5 horas
- **Fase 7** (PDF): 4-6 horas
- **Fase 8** (WhatsApp): 3-4 horas
- **Fase 9** (Tracking): 5-6 horas
- **Fase 10** (Notificaciones): 2-3 horas
- **Fase 11** (Conversión): 3-4 horas
- **Fase 12** (Integración): 1-2 horas

**Total estimado**: 40-55 horas de desarrollo

---

## Próximos Pasos

1. ✅ Revisar y aprobar este documento
2. Implementar fase por fase según indicación
3. Testing en cada fase antes de continuar
4. Deploy progresivo en producción

