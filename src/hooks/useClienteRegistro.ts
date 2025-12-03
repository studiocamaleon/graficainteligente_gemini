import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ClienteRegistroData {
  company_id: string;
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  whatsapp: string;
  email?: string;
  domicilio?: string;
  frontend_origin?: string;
}

interface RegistroResponse {
  success: boolean;
  message?: string;
  cliente_id?: string;
  whatsapp_enviado?: boolean;
  error?: string;
}

export function useClienteRegistro() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrarCliente = async (data: ClienteRegistroData): Promise<RegistroResponse> => {
    setLoading(true);
    setError(null);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-registro-cliente`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          ...data,
          frontend_origin: window.location.origin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Error al registrar');
        return { success: false, error: result.error };
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const validarDocumento = (tipo: string, numero: string): { valido: boolean; error?: string } => {
    const cleaned = numero.replace(/[\s\-]/g, '');

    switch (tipo) {
      case 'DNI':
        if (!/^[0-9]{7,8}$/.test(cleaned)) {
          return { valido: false, error: 'DNI debe tener 7 u 8 dígitos' };
        }
        break;
      case 'CUIT':
      case 'CUIL':
        if (!/^[0-9]{11}$/.test(cleaned)) {
          return { valido: false, error: `${tipo} debe tener 11 dígitos` };
        }
        break;
      default:
        return { valido: false, error: 'Tipo de documento inválido' };
    }

    return { valido: true };
  };

  const validarWhatsApp = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return cleaned.length >= 10 && /^[0-9+]+$/.test(cleaned);
  };

  const validarEmail = (email: string): boolean => {
    if (!email) return true;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  return {
    registrarCliente,
    validarDocumento,
    validarWhatsApp,
    validarEmail,
    loading,
    error,
  };
}
