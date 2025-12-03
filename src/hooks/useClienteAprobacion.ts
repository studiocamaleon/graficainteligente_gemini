import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface AprobarClienteParams {
  clienteId: string;
  enviarNotificacion?: boolean;
}

interface RechazarClienteParams {
  clienteId: string;
  motivo?: string;
  enviarNotificacion?: boolean;
}

interface AprobacionResponse {
  success: boolean;
  message?: string;
  error?: string;
  whatsapp_enviado?: boolean;
}

export function useClienteAprobacion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aprobarCliente = async ({
    clienteId,
    enviarNotificacion = true,
  }: AprobarClienteParams): Promise<AprobacionResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          status_aprobacion: 'approved',
          is_active: true,
        })
        .eq('id', clienteId);

      if (updateError) {
        throw updateError;
      }

      let whatsappEnviado = false;

      if (enviarNotificacion) {
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-cliente-aprobado`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              cliente_id: clienteId,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            whatsappEnviado = result.whatsapp_enviado || false;
          }
        } catch (notifError) {
          console.error('Error enviando notificación:', notifError);
        }
      }

      return {
        success: true,
        message: 'Cliente aprobado exitosamente',
        whatsapp_enviado: whatsappEnviado,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al aprobar cliente';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  const rechazarCliente = async ({
    clienteId,
    motivo,
    enviarNotificacion = true,
  }: RechazarClienteParams): Promise<AprobacionResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          status_aprobacion: 'rejected',
          is_active: false,
        })
        .eq('id', clienteId);

      if (updateError) {
        throw updateError;
      }

      let whatsappEnviado = false;

      if (enviarNotificacion) {
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-cliente-rechazado`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              cliente_id: clienteId,
              motivo: motivo || undefined,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            whatsappEnviado = result.whatsapp_enviado || false;
          }
        } catch (notifError) {
          console.error('Error enviando notificación:', notifError);
        }
      }

      return {
        success: true,
        message: 'Cliente rechazado',
        whatsapp_enviado: whatsappEnviado,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al rechazar cliente';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  const reactivarCliente = async (clienteId: string): Promise<AprobacionResponse> => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          status_aprobacion: 'approved',
          is_active: true,
        })
        .eq('id', clienteId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: 'Cliente reactivado exitosamente',
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al reactivar cliente';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    aprobarCliente,
    rechazarCliente,
    reactivarCliente,
    loading,
    error,
  };
}
