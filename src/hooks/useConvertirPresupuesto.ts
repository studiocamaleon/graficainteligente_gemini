import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface RutaStep {
  etapa: string;
  paso_id: string;
  paso_nombre: string;
  orden: number;
}

interface ConvertirPresupuestoParams {
  presupuesto_id: string;
  fecha_entrega_estimada?: string;
  notas_adicionales?: string;
  copiar_archivos?: boolean;
  monto_pago?: number;
  medio_cobro_id?: string;
  referencia_pago?: string;
  rutas_personalizadas?: Record<string, RutaStep[]>;
}

interface ConvertirPresupuestoResult {
  success: boolean;
  orden_trabajo_id?: string;
  error?: string;
}

export function useConvertirPresupuesto() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertirPresupuesto = async (
    params: ConvertirPresupuestoParams
  ): Promise<ConvertirPresupuestoResult> => {
    try {
      setLoading(true);
      setError(null);

      // Validar parámetros de pago si se proporcionan
      if (params.monto_pago && params.monto_pago > 0) {
        if (!params.medio_cobro_id) {
          throw new Error('Debe especificar un medio de cobro al registrar un pago');
        }
      }

      // Llamar a la función de base de datos
      const { data, error: rpcError } = await supabase.rpc(
        'fn_convertir_presupuesto_a_orden',
        {
          p_presupuesto_id: params.presupuesto_id,
          p_fecha_entrega_estimada: params.fecha_entrega_estimada || null,
          p_notas_adicionales: params.notas_adicionales || null,
          p_copiar_archivos: params.copiar_archivos !== false,
          p_monto_pago: params.monto_pago || null,
          p_medio_cobro_id: params.medio_cobro_id || null,
          p_referencia_pago: params.referencia_pago || null,
          p_rutas_personalizadas: params.rutas_personalizadas || null,
        }
      );

      if (rpcError) {
        console.error('Error convirtiendo presupuesto:', rpcError);
        throw rpcError;
      }

      return {
        success: true,
        orden_trabajo_id: data,
      };
    } catch (err: any) {
      console.error('Error convirtiendo presupuesto:', err);
      const errorMessage = err.message || 'Error desconocido al convertir presupuesto';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  const validarConversion = async (
    presupuestoId: string
  ): Promise<{
    puede_convertir: boolean;
    motivo?: string;
    warnings: string[];
  }> => {
    try {
      const { data: presupuesto, error: presupuestoError } = await supabase
        .from('presupuestos')
        .select('*, items:presupuestos_items(*)')
        .eq('id', presupuestoId)
        .single();

      if (presupuestoError) throw presupuestoError;

      const warnings: string[] = [];

      // Validar estado
      if (presupuesto.estado !== 'aprobado') {
        return {
          puede_convertir: false,
          motivo: 'El presupuesto debe estar aprobado para convertirse',
          warnings,
        };
      }

      // Validar si ya fue convertido
      if (presupuesto.orden_trabajo_id) {
        return {
          puede_convertir: false,
          motivo: 'Este presupuesto ya fue convertido a orden de trabajo',
          warnings,
        };
      }

      // Validar items
      if (!presupuesto.items || presupuesto.items.length === 0) {
        return {
          puede_convertir: false,
          motivo: 'El presupuesto no tiene items',
          warnings,
        };
      }

      // Advertir sobre items personalizados
      const itemsPersonalizados = presupuesto.items.filter(
        (item: any) => item.tipo_item === 'item_personalizado'
      );

      if (itemsPersonalizados.length > 0) {
        warnings.push(
          `Hay ${itemsPersonalizados.length} items personalizados que no se copiarán automáticamente`
        );
      }

      return {
        puede_convertir: true,
        warnings,
      };
    } catch (err: any) {
      return {
        puede_convertir: false,
        motivo: err.message,
        warnings: [],
      };
    }
  };

  return {
    loading,
    error,
    convertirPresupuesto,
    validarConversion,
  };
}
