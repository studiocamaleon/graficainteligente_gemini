import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface OrdenPendienteFacturacion {
  id: string;
  numero_orden: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_email: string | null;
  cliente_whatsapp: string | null;
  vendedor_id: string;
  vendedor_nombre: string;
  estado: string;
  fecha_creacion: string;
  fecha_estimada_entrega: string | null;
  subtotal: number;
  subtotal_iva: number;
  total: number;
  dias_pendiente: number;
  facturada: boolean;
  numero_factura: string | null;
  factura_storage_path: string | null;
}

export interface EstadisticasFacturacion {
  total_ordenes_requieren_factura: number;
  ordenes_pendientes: number;
  ordenes_facturadas: number;
  monto_total_pendiente: number;
  monto_total_facturado: number;
  monto_iva_pendiente: number;
  monto_iva_facturado: number;
  promedio_dias_facturacion: number;
}

interface UseFacturasFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  cliente_id?: string;
  estado?: string;
  estado_facturacion?: string;
}

export function useFacturas(filtros?: UseFacturasFilters) {
  const { profile } = useAuth();
  const [ordenesPendientes, setOrdenesPendientes] = useState<OrdenPendienteFacturacion[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasFacturacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.company_id) {
      fetchData();
    }
  }, [profile?.company_id, filtros?.fecha_desde, filtros?.fecha_hasta, filtros?.cliente_id, filtros?.estado, filtros?.estado_facturacion]);

  const fetchData = async () => {
    await Promise.all([fetchOrdenesPendientes(), fetchEstadisticas()]);
  };

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
          p_estado_facturacion: filtros?.estado_facturacion || null,
        }
      );

      if (rpcError) throw rpcError;

      setOrdenesPendientes(data || []);
    } catch (err: any) {
      console.error('[useFacturas] Error fetching ordenes pendientes:', err);
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
      console.error('[useFacturas] Error fetching estadisticas:', err);
    }
  };

  const registrarFactura = async (
    ordenId: string,
    numeroFactura: string,
    archivoFactura: File,
    observaciones?: string
  ): Promise<{ success: boolean; error?: string }> => {
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

      // 3. Enviar notificación WhatsApp (sin bloquear)
      enviarNotificacionFactura(data).catch(err => {
        console.error('[useFacturas] Error enviando notificación (no bloquea):', err);
      });

      // 4. Refrescar datos
      await fetchData();

      return { success: true };
    } catch (err: any) {
      console.error('[useFacturas] Error registrando factura:', err);
      const errorMessage = err.message || 'Error registrando factura';
      setError(errorMessage);
      return { success: false, error: errorMessage };
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
        console.error('[useFacturas] Error enviando notificación WhatsApp:', functionError);
      }
    } catch (err) {
      console.error('[useFacturas] Error en notificación:', err);
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
      console.error('[useFacturas] Error descargando factura:', err);
      setError(err.message);
      return null;
    }
  };

  return {
    ordenesPendientes,
    estadisticas,
    loading,
    error,
    refetch: fetchData,
    registrarFactura,
    descargarFactura,
  };
}
