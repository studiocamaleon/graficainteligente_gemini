# Plan de Implementación: Sistema de Facturas

## Análisis del Estado Actual

### ✅ Lo que ya existe:
1. **Frontend**:
   - Variable local `requiereFactura` en `CreateOrderPage.tsx` (línea 52)
   - Función `setRequiereFactura` que actualiza el estado
   - Cálculo automático de IVA (21%) cuando `requiereFactura` es `true` (línea 143)
   - Componente `OrdenFooterTotales` que muestra el IVA calculado
   - Props pasadas a `OrdenItemsTab`: `requiereFactura` y `setRequiereFactura`

2. **Base de Datos**:
   - Tabla `ordenes_trabajo` existente en migración `20251112000000_create_ordenes_trabajo_system.sql`
   - Campos actuales: `subtotal`, `total_descuentos`, `total`
   - Sistema de pagos: tabla `ordenes_trabajo_pagos`
   - Sistema de archivos: tabla `ordenes_trabajo_archivos`
   - Storage buckets configurados: `ordenes-archivos`

3. **Notificaciones WhatsApp**:
   - Sistema de notificaciones implementado en `supabase/functions/notify-orden-finalizada`
   - Edge function `enviar-notificacion-orden` configurada
   - Tabla `whatsapp_notificaciones` para registro

### ❌ Lo que falta implementar:
1. Campo `requiere_factura` NO existe en la tabla `ordenes_trabajo`
2. Campo `subtotal_iva` NO existe en la tabla `ordenes_trabajo`
3. NO se persiste el valor del switch al crear/editar órdenes
4. NO existe módulo de Facturas en Finanzas
5. NO existe tabla para gestionar facturas
6. NO existe notificación automática al cargar factura

---

## 🎯 Objetivos del Sistema

1. **Registrar** si una orden requiere facturación
2. **Persistir** el monto de IVA calculado
3. **Visualizar** órdenes pendientes de facturación
4. **Cargar** archivo de factura en storage
5. **Notificar** al cliente vía WhatsApp con link de descarga
6. **Rastrear** estado de facturación de cada orden

---

## 📋 Plan de Implementación en Fases

---

### **FASE 1: Actualizar Esquema de Base de Datos**

#### 1.1. Agregar campos a `ordenes_trabajo`

**Archivo**: Nueva migración `add_facturacion_to_ordenes_trabajo.sql`

```sql
/*
  # Agregar Sistema de Facturación a Órdenes de Trabajo

  1. Nuevos Campos
    - `requiere_factura` (boolean): Indica si el cliente solicitó factura
    - `subtotal_iva` (numeric): Monto del IVA calculado (21%)
    - `facturada` (boolean): Indica si ya se cargó la factura
    - `fecha_facturacion` (timestamptz): Cuándo se cargó la factura
    - `numero_factura` (text): Número de factura asignado
    - `factura_storage_path` (text): Ruta del archivo en storage

  2. Índices
    - Índice para consultar órdenes pendientes de facturación
    - Índice para consultar órdenes facturadas

  3. Notas
    - Los campos son compatibles con órdenes existentes (nullable o con defaults)
    - El IVA se calcula en frontend pero se persiste en BD
*/

-- Agregar campos de facturación
ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS requiere_factura boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS subtotal_iva numeric DEFAULT 0 NOT NULL CHECK (subtotal_iva >= 0),
  ADD COLUMN IF NOT EXISTS facturada boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fecha_facturacion timestamptz,
  ADD COLUMN IF NOT EXISTS numero_factura text,
  ADD COLUMN IF NOT EXISTS factura_storage_path text;

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_ordenes_requiere_factura
  ON ordenes_trabajo(company_id, requiere_factura)
  WHERE requiere_factura = true;

CREATE INDEX IF NOT EXISTS idx_ordenes_pendientes_facturacion
  ON ordenes_trabajo(company_id, requiere_factura, facturada)
  WHERE requiere_factura = true AND facturada = false;

CREATE INDEX IF NOT EXISTS idx_ordenes_facturadas
  ON ordenes_trabajo(company_id, facturada, fecha_facturacion DESC)
  WHERE facturada = true;

-- Comentarios descriptivos
COMMENT ON COLUMN ordenes_trabajo.requiere_factura IS 'Indica si el cliente solicitó factura para esta orden';
COMMENT ON COLUMN ordenes_trabajo.subtotal_iva IS 'Monto del IVA calculado (21% del subtotal con descuento)';
COMMENT ON COLUMN ordenes_trabajo.facturada IS 'Indica si ya se cargó el archivo de factura';
COMMENT ON COLUMN ordenes_trabajo.fecha_facturacion IS 'Fecha y hora en que se cargó la factura';
COMMENT ON COLUMN ordenes_trabajo.numero_factura IS 'Número de factura fiscal asignado';
COMMENT ON COLUMN ordenes_trabajo.factura_storage_path IS 'Ruta del archivo PDF en Supabase Storage';
```

#### 1.2. Crear tabla de historial de facturas (opcional pero recomendado)

```sql
-- Tabla para auditoría de facturas
CREATE TABLE IF NOT EXISTS facturas_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero_factura text NOT NULL,
  monto_subtotal numeric NOT NULL CHECK (monto_subtotal >= 0),
  monto_iva numeric NOT NULL CHECK (monto_iva >= 0),
  monto_total numeric NOT NULL CHECK (monto_total >= 0),
  factura_storage_path text NOT NULL,
  tipo_operacion text NOT NULL CHECK (tipo_operacion IN ('creacion', 'reemplazo', 'anulacion')),
  observaciones text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_facturas_historial_orden ON facturas_historial(orden_id);
CREATE INDEX idx_facturas_historial_company ON facturas_historial(company_id, created_at DESC);
CREATE INDEX idx_facturas_historial_numero ON facturas_historial(company_id, numero_factura);

ALTER TABLE facturas_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company facturas historial"
  ON facturas_historial FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own company facturas historial"
  ON facturas_historial FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

COMMENT ON TABLE facturas_historial IS 'Registro de auditoría de todas las operaciones sobre facturas';
```

#### 1.3. Crear bucket de storage para facturas

```sql
-- Crear bucket para facturas (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('facturas', 'facturas', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso al bucket de facturas
CREATE POLICY "Users can view own company facturas"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can upload own company facturas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company facturas"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own company facturas"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'facturas' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM profiles WHERE id = auth.uid()
    )
  );
```

---

### **FASE 2: Funciones de Base de Datos**

#### 2.1. Función para obtener órdenes pendientes de facturación

**Archivo**: Parte de la misma migración o nueva `create_facturas_functions.sql`

```sql
/*
  # Funciones para Sistema de Facturas

  1. fn_ordenes_pendientes_facturacion
     - Obtiene órdenes que requieren factura pero no han sido facturadas
     - Incluye información del cliente y vendedor
     - Filtros por fecha, cliente, estado

  2. fn_registrar_factura
     - Registra que una orden ha sido facturada
     - Actualiza campos correspondientes
     - Crea registro en historial
     - Retorna datos para notificación WhatsApp
*/

-- Función: Obtener órdenes pendientes de facturación
CREATE OR REPLACE FUNCTION fn_ordenes_pendientes_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero_orden text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_email text,
  cliente_whatsapp text,
  vendedor_id uuid,
  vendedor_nombre text,
  estado text,
  fecha_creacion timestamptz,
  fecha_estimada_entrega timestamptz,
  subtotal numeric,
  subtotal_iva numeric,
  total numeric,
  dias_pendiente integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ot.id,
    ot.numero_orden,
    ot.cliente_id,
    c.razon_social as cliente_nombre,
    c.email as cliente_email,
    c.whatsapp as cliente_whatsapp,
    ot.vendedor_id,
    p.full_name as vendedor_nombre,
    ot.estado,
    ot.fecha_creacion,
    ot.fecha_estimada_entrega,
    ot.subtotal,
    ot.subtotal_iva,
    ot.total,
    EXTRACT(DAY FROM (now() - ot.fecha_creacion))::integer as dias_pendiente
  FROM ordenes_trabajo ot
  INNER JOIN clients c ON c.id = ot.cliente_id
  INNER JOIN profiles p ON p.id = ot.vendedor_id
  WHERE ot.company_id = p_company_id
    AND ot.requiere_factura = true
    AND ot.facturada = false
    AND (p_fecha_desde IS NULL OR DATE(ot.fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(ot.fecha_creacion) <= p_fecha_hasta)
    AND (p_cliente_id IS NULL OR ot.cliente_id = p_cliente_id)
    AND (p_estado IS NULL OR ot.estado = p_estado)
  ORDER BY ot.fecha_creacion DESC;
END;
$$;

-- Función: Registrar factura
CREATE OR REPLACE FUNCTION fn_registrar_factura(
  p_orden_id uuid,
  p_numero_factura text,
  p_factura_storage_path text,
  p_observaciones text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orden ordenes_trabajo%ROWTYPE;
  v_cliente clients%ROWTYPE;
  v_company companies%ROWTYPE;
  v_result json;
BEGIN
  -- Obtener datos de la orden
  SELECT * INTO v_orden
  FROM ordenes_trabajo
  WHERE id = p_orden_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF NOT v_orden.requiere_factura THEN
    RAISE EXCEPTION 'Esta orden no requiere factura';
  END IF;

  IF v_orden.facturada THEN
    RAISE EXCEPTION 'Esta orden ya tiene factura registrada';
  END IF;

  -- Obtener datos del cliente
  SELECT * INTO v_cliente
  FROM clients
  WHERE id = v_orden.cliente_id;

  -- Obtener datos de la empresa
  SELECT * INTO v_company
  FROM companies
  WHERE id = v_orden.company_id;

  -- Actualizar orden
  UPDATE ordenes_trabajo
  SET
    facturada = true,
    fecha_facturacion = now(),
    numero_factura = p_numero_factura,
    factura_storage_path = p_factura_storage_path,
    updated_at = now(),
    updated_by = p_user_id
  WHERE id = p_orden_id;

  -- Registrar en historial
  INSERT INTO facturas_historial (
    orden_id,
    company_id,
    numero_factura,
    monto_subtotal,
    monto_iva,
    monto_total,
    factura_storage_path,
    tipo_operacion,
    observaciones,
    created_by
  ) VALUES (
    p_orden_id,
    v_orden.company_id,
    p_numero_factura,
    v_orden.subtotal - v_orden.total_descuentos,
    v_orden.subtotal_iva,
    v_orden.total,
    p_factura_storage_path,
    'creacion',
    p_observaciones,
    p_user_id
  );

  -- Preparar datos para notificación
  v_result := json_build_object(
    'orden_id', p_orden_id,
    'numero_orden', v_orden.numero_orden,
    'numero_factura', p_numero_factura,
    'cliente_nombre', v_cliente.razon_social,
    'cliente_whatsapp', v_cliente.whatsapp,
    'company_id', v_orden.company_id,
    'company_name', v_company.company_name,
    'factura_storage_path', p_factura_storage_path
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fn_ordenes_pendientes_facturacion IS 'Obtiene órdenes que requieren factura pero aún no han sido facturadas';
COMMENT ON FUNCTION fn_registrar_factura IS 'Registra que una orden ha sido facturada y prepara datos para notificación';
```

#### 2.2. Función para estadísticas de facturación

```sql
-- Función: Estadísticas de facturación
CREATE OR REPLACE FUNCTION fn_estadisticas_facturacion(
  p_company_id uuid,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats json;
BEGIN
  SELECT json_build_object(
    'total_ordenes_requieren_factura', COUNT(*),
    'ordenes_pendientes', COUNT(*) FILTER (WHERE facturada = false),
    'ordenes_facturadas', COUNT(*) FILTER (WHERE facturada = true),
    'monto_total_pendiente', COALESCE(SUM(total) FILTER (WHERE facturada = false), 0),
    'monto_total_facturado', COALESCE(SUM(total) FILTER (WHERE facturada = true), 0),
    'monto_iva_pendiente', COALESCE(SUM(subtotal_iva) FILTER (WHERE facturada = false), 0),
    'monto_iva_facturado', COALESCE(SUM(subtotal_iva) FILTER (WHERE facturada = true), 0),
    'promedio_dias_facturacion', COALESCE(
      AVG(EXTRACT(DAY FROM (fecha_facturacion - fecha_creacion)))
      FILTER (WHERE facturada = true AND fecha_facturacion IS NOT NULL),
      0
    )
  ) INTO v_stats
  FROM ordenes_trabajo
  WHERE company_id = p_company_id
    AND requiere_factura = true
    AND (p_fecha_desde IS NULL OR DATE(fecha_creacion) >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR DATE(fecha_creacion) <= p_fecha_hasta);

  RETURN v_stats;
END;
$$;

COMMENT ON FUNCTION fn_estadisticas_facturacion IS 'Obtiene estadísticas del sistema de facturación';
```

---

### **FASE 3: Actualizar Frontend - Persistir Facturación**

#### 3.1. Actualizar tipos TypeScript

**Archivo**: `src/types/database.ts`

```typescript
// Agregar a la interfaz de OrdenTrabajo existente:
export interface OrdenTrabajo {
  // ... campos existentes ...
  requiere_factura: boolean;
  subtotal_iva: number;
  facturada: boolean;
  fecha_facturacion?: string;
  numero_factura?: string;
  factura_storage_path?: string;
}
```

#### 3.2. Actualizar `CreateOrderPage.tsx`

**Cambios necesarios**:
1. Persistir `requiere_factura` y `subtotal_iva` al crear orden
2. Incluir estos campos en el INSERT de la orden

```typescript
// Dentro de handleSubmit, al crear la orden:
const { data: orden, error: ordenError } = await supabase
  .from('ordenes_trabajo')
  .insert({
    // ... campos existentes ...
    requiere_factura: requiereFactura,
    subtotal_iva: totales.iva,
    subtotal: totales.subtotal,
    total_descuentos: totales.descuentoAplicado,
    total: totales.total,
  })
  .select()
  .single();
```

#### 3.3. Actualizar `OrderDetailPage.tsx`

**Cambios necesarios**:
1. Mostrar si la orden requiere factura
2. Mostrar si ya fue facturada (badge visual)
3. Mostrar monto de IVA en los totales

---

### **FASE 4: Crear Módulo de Facturas en Finanzas**

#### 4.1. Crear hook `useFacturas.ts`

**Archivo**: `src/hooks/useFacturas.ts`

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface OrdenPendienteFacturacion {
  id: string;
  numero_orden: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_whatsapp: string;
  vendedor_id: string;
  vendedor_nombre: string;
  estado: string;
  fecha_creacion: string;
  fecha_estimada_entrega: string;
  subtotal: number;
  subtotal_iva: number;
  total: number;
  dias_pendiente: number;
}

interface EstadisticasFacturacion {
  total_ordenes_requieren_factura: number;
  ordenes_pendientes: number;
  ordenes_facturadas: number;
  monto_total_pendiente: number;
  monto_total_facturado: number;
  monto_iva_pendiente: number;
  monto_iva_facturado: number;
  promedio_dias_facturacion: number;
}

export function useFacturas(filtros?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  cliente_id?: string;
  estado?: string;
}) {
  const { profile } = useAuth();
  const [ordenesPendientes, setOrdenesPendientes] = useState<OrdenPendienteFacturacion[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasFacturacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      fetchOrdenesPendientes();
      fetchEstadisticas();
    }
  }, [profile?.company_id, filtros]);

  const fetchOrdenesPendientes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc(
        'fn_ordenes_pendientes_facturacion',
        {
          p_company_id: profile!.company_id,
          p_fecha_desde: filtros?.fecha_desde || null,
          p_fecha_hasta: filtros?.fecha_hasta || null,
          p_cliente_id: filtros?.cliente_id || null,
          p_estado: filtros?.estado || null,
        }
      );

      if (rpcError) throw rpcError;

      setOrdenesPendientes(data || []);
    } catch (err: any) {
      console.error('Error fetching ordenes pendientes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'fn_estadisticas_facturacion',
        {
          p_company_id: profile!.company_id,
          p_fecha_desde: filtros?.fecha_desde || null,
          p_fecha_hasta: filtros?.fecha_hasta || null,
        }
      );

      if (rpcError) throw rpcError;

      setEstadisticas(data);
    } catch (err: any) {
      console.error('Error fetching estadisticas:', err);
    }
  };

  const registrarFactura = async (
    ordenId: string,
    numeroFactura: string,
    archivoFactura: File,
    observaciones?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      // 1. Subir archivo a storage
      const fileName = `${profile!.company_id}/${ordenId}/${Date.now()}_${archivoFactura.name}`;
      const { error: uploadError } = await supabase.storage
        .from('facturas')
        .upload(fileName, archivoFactura);

      if (uploadError) throw uploadError;

      // 2. Registrar factura en BD
      const { data, error: rpcError } = await supabase.rpc(
        'fn_registrar_factura',
        {
          p_orden_id: ordenId,
          p_numero_factura: numeroFactura,
          p_factura_storage_path: fileName,
          p_observaciones: observaciones || null,
          p_user_id: profile!.id,
        }
      );

      if (rpcError) throw rpcError;

      // 3. Enviar notificación WhatsApp
      await enviarNotificacionFactura(data);

      // 4. Refrescar datos
      await fetchOrdenesPendientes();
      await fetchEstadisticas();

      return true;
    } catch (err: any) {
      console.error('Error registrando factura:', err);
      setError(err.message);
      return false;
    }
  };

  const enviarNotificacionFactura = async (datosFactura: any) => {
    try {
      const { error: functionError } = await supabase.functions.invoke(
        'notify-factura-disponible',
        {
          body: {
            orden_id: datosFactura.orden_id,
            numero_orden: datosFactura.numero_orden,
            numero_factura: datosFactura.numero_factura,
            cliente_nombre: datosFactura.cliente_nombre,
            cliente_whatsapp: datosFactura.cliente_whatsapp,
            company_id: datosFactura.company_id,
            company_name: datosFactura.company_name,
            factura_storage_path: datosFactura.factura_storage_path,
            frontend_origin: window.location.origin,
          },
        }
      );

      if (functionError) {
        console.error('Error enviando notificación WhatsApp:', functionError);
      }
    } catch (err) {
      console.error('Error en notificación:', err);
    }
  };

  const descargarFactura = async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('facturas')
        .createSignedUrl(storagePath, 3600); // 1 hora de validez

      if (error) throw error;

      return data.signedUrl;
    } catch (err: any) {
      console.error('Error descargando factura:', err);
      setError(err.message);
      return null;
    }
  };

  return {
    ordenesPendientes,
    estadisticas,
    loading,
    error,
    refetch: fetchOrdenesPendientes,
    registrarFactura,
    descargarFactura,
  };
}
```

#### 4.2. Crear componente `FacturasView.tsx`

**Archivo**: `src/pages/app/finanzas/FacturasView.tsx`

Componente principal que:
- Lista órdenes pendientes de facturación
- Muestra estadísticas (KPIs)
- Permite filtrar por fecha, cliente, estado
- Botón "Cargar Factura" por cada orden
- Modal para cargar archivo y número de factura
- Visualización de órdenes ya facturadas

#### 4.3. Crear componente `CargarFacturaModal.tsx`

**Archivo**: `src/components/facturas/CargarFacturaModal.tsx`

Modal que incluye:
- Campo: Número de factura (text input)
- Campo: Archivo PDF (file upload)
- Campo: Observaciones (textarea opcional)
- Preview del archivo seleccionado
- Botón: Guardar y Notificar

#### 4.4. Crear componente `FacturasKPICards.tsx`

**Archivo**: `src/components/facturas/FacturasKPICards.tsx`

Tarjetas de métricas:
- Total órdenes requieren factura
- Pendientes de facturación
- Facturadas
- Monto IVA pendiente
- Monto IVA facturado
- Promedio días hasta facturación

---

### **FASE 5: Edge Function para Notificación WhatsApp**

#### 5.1. Crear función `notify-factura-disponible`

**Archivo**: `supabase/functions/notify-factura-disponible/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      orden_id,
      numero_orden,
      numero_factura,
      cliente_nombre,
      cliente_whatsapp,
      company_id,
      company_name,
      factura_storage_path,
      frontend_origin,
    } = await req.json();

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generar URL pública de descarga (signed URL con 30 días de validez)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('facturas')
      .createSignedUrl(factura_storage_path, 2592000); // 30 días

    if (urlError) throw urlError;

    const facturaUrl = urlData.signedUrl;

    // Construir mensaje WhatsApp
    const mensaje = `
*${company_name}* - Factura Disponible 📄

Hola ${cliente_nombre},

Tu factura *${numero_factura}* para la orden *${numero_orden}* ya está disponible.

📥 *Descargar factura:*
${facturaUrl}

Este link es válido por 30 días.

Si tienes alguna consulta, no dudes en contactarnos.

¡Gracias por tu confianza!
`.trim();

    // Obtener configuración de WhatsApp de la empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('whatsapp_instance_url, whatsapp_api_key')
      .eq('id', company_id)
      .single();

    if (companyError) throw companyError;

    if (!company.whatsapp_instance_url || !company.whatsapp_api_key) {
      throw new Error('WhatsApp no configurado para esta empresa');
    }

    // Enviar mensaje vía Evolution API
    const whatsappResponse = await fetch(
      `${company.whatsapp_instance_url}/message/sendText/global`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': company.whatsapp_api_key,
        },
        body: JSON.stringify({
          number: cliente_whatsapp,
          text: mensaje,
        }),
      }
    );

    if (!whatsappResponse.ok) {
      throw new Error(`Error en Evolution API: ${whatsappResponse.statusText}`);
    }

    // Registrar notificación
    await supabase.from('whatsapp_notificaciones').insert({
      company_id,
      destinatario: cliente_whatsapp,
      mensaje,
      tipo: 'factura_disponible',
      metadata: {
        orden_id,
        numero_orden,
        numero_factura,
        factura_url: facturaUrl,
      },
    });

    return new Response(
      JSON.stringify({ success: true, mensaje: 'Notificación enviada' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

### **FASE 6: Actualizar Rutas y Navegación**

#### 6.1. Agregar ruta en `App.tsx`

```typescript
// Dentro de las rutas de Finanzas:
<Route
  path="finanzas/facturas"
  element={
    <ProtectedModuleRoute moduleId="finanzas-facturas">
      <FacturasView />
    </ProtectedModuleRoute>
  }
/>
```

#### 6.2. Agregar ítem en menú de Finanzas

**Archivo**: `src/layouts/MainLayout.tsx` o donde se defina el menú

Agregar opción "Facturas" en el submódulo de Finanzas.

---

### **FASE 7: Testing y Validación**

#### 7.1. Tests de Base de Datos
1. Crear orden con `requiere_factura = true`
2. Verificar que se calcula y persiste `subtotal_iva`
3. Consultar órdenes pendientes con `fn_ordenes_pendientes_facturacion`
4. Registrar factura con `fn_registrar_factura`
5. Verificar actualización de campos
6. Verificar registro en `facturas_historial`

#### 7.2. Tests de Frontend
1. Crear orden marcando switch "Requiere factura"
2. Verificar que se muestra el IVA en totales
3. Ver orden en módulo Facturas (pendiente)
4. Cargar factura con número y PDF
5. Verificar que desaparece de pendientes

#### 7.3. Tests de Notificaciones
1. Registrar factura
2. Verificar envío de WhatsApp
3. Verificar link de descarga funciona
4. Verificar registro en `whatsapp_notificaciones`

---

## 📊 Resumen de Componentes Nuevos

### Base de Datos:
- ✅ 6 campos nuevos en `ordenes_trabajo`
- ✅ 1 tabla nueva: `facturas_historial`
- ✅ 3 funciones: `fn_ordenes_pendientes_facturacion`, `fn_registrar_factura`, `fn_estadisticas_facturacion`
- ✅ 1 bucket storage: `facturas`
- ✅ Políticas RLS para storage

### Frontend:
- ✅ 1 hook: `useFacturas.ts`
- ✅ 1 página: `FacturasView.tsx`
- ✅ 2 componentes: `CargarFacturaModal.tsx`, `FacturasKPICards.tsx`
- ✅ Actualización en `CreateOrderPage.tsx` para persistir facturación
- ✅ Actualización en `OrderDetailPage.tsx` para mostrar estado

### Backend:
- ✅ 1 Edge Function: `notify-factura-disponible`
- ✅ Integración con Evolution API para WhatsApp

### Navegación:
- ✅ Nueva ruta: `/app/finanzas/facturas`
- ✅ Ítem de menú en Finanzas

---

## 🔐 Seguridad y Permisos

### Roles que pueden:
- **Ver facturas pendientes**: Administración, Contador, Finanzas
- **Cargar facturas**: Administración, Contador
- **Ver historial**: Administración, Contador, Finanzas
- **Descargar facturas**: Administración, Contador, Finanzas, Vendedor (solo sus órdenes)

### Validaciones:
- Solo órdenes con `requiere_factura = true` aparecen
- Solo órdenes NO facturadas aparecen como pendientes
- Archivo debe ser PDF (validación frontend y backend)
- Número de factura es obligatorio
- Storage path valida company_id

---

## 📅 Estimación de Tiempos

- **Fase 1**: 2 horas (migraciones BD)
- **Fase 2**: 3 horas (funciones BD)
- **Fase 3**: 2 horas (actualizar frontend órdenes)
- **Fase 4**: 6 horas (módulo facturas completo)
- **Fase 5**: 2 horas (edge function WhatsApp)
- **Fase 6**: 1 hora (rutas y navegación)
- **Fase 7**: 3 horas (testing completo)

**Total estimado**: 19 horas

---

## 🚀 Orden de Implementación Recomendado

1. **FASE 1** → Actualizar esquema (base sólida)
2. **FASE 2** → Crear funciones BD (lógica de negocio)
3. **FASE 3** → Persistir en órdenes (validar flujo básico)
4. **FASE 5** → Edge function (preparar notificaciones)
5. **FASE 4** → Módulo frontend (UI completa)
6. **FASE 6** → Navegación (integración)
7. **FASE 7** → Testing (validación end-to-end)

---

## 📝 Notas Importantes

1. **Backward Compatibility**: Órdenes existentes tendrán `requiere_factura = false` por defecto
2. **IVA Argentina**: Se usa 21% hardcodeado, considerar hacerlo configurable por empresa
3. **Signed URLs**: Expiran en 30 días, considerar regeneración automática
4. **WhatsApp**: Requiere Evolution API configurada previamente
5. **Permisos**: Agregar módulo `finanzas-facturas` a sistema de permisos
6. **Auditoría**: Tabla `facturas_historial` permite rastrear cambios
7. **Storage**: Estructura `{company_id}/{orden_id}/{timestamp}_{filename}.pdf`

---

**FIN DEL PLAN** ✅
