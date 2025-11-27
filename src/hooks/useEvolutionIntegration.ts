import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type {
  EvolutionConfig,
  EvolutionConfigForm,
  EvolutionQRData,
  ConnectionState,
} from '../types/evolution';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useEvolutionIntegration() {
  const [config, setConfig] = useState<EvolutionConfig>({ hasConfig: false });
  const [formData, setFormData] = useState<EvolutionConfigForm>({
    instanceId: '',
    apiKey: '',
    baseUrl: 'https://api.evoapicloud.com',
  });
  const [qrData, setQrData] = useState<EvolutionQRData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const pollingIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Obtener token de sesión
  const getAuthToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  };

  // Hacer request a Edge Function
  const callEdgeFunction = async (
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<any> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('No estás autenticado');
    }

    const url = `${SUPABASE_URL}/functions/v1/evolution${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en la petición');
    }

    return data;
  };

  // Cargar configuración
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await callEdgeFunction('/config', 'GET');
      setConfig(data);

      if (data.hasConfig && data.instanceId) {
        setFormData((prev) => ({
          ...prev,
          instanceId: data.instanceId,
          baseUrl: data.baseUrl || 'https://api.evoapicloud.com',
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar configuración';
      setError(errorMessage);
      console.error('Error fetching config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Guardar configuración
  const saveConfig = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!formData.instanceId.trim()) {
        throw new Error('Instance ID es requerido');
      }

      const body: EvolutionConfigForm = {
        instanceId: formData.instanceId.trim(),
        baseUrl: formData.baseUrl || 'https://api.evoapicloud.com',
      };

      // Solo incluir apiKey si el usuario escribió algo
      if (formData.apiKey && formData.apiKey.trim()) {
        body.apiKey = formData.apiKey.trim();
      }

      const data = await callEdgeFunction('/config', 'POST', body);

      setConfig({
        hasConfig: true,
        ...data,
      });

      // Limpiar el campo de API Key después de guardar
      setFormData((prev) => ({ ...prev, apiKey: '' }));

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar configuración';
      setError(errorMessage);
      console.error('Error saving config:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Generar QR
  const generateQR = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await callEdgeFunction('/connect', 'POST');

      setQrData(data);
      setTimeLeft(120);

      // Iniciar countdown
      startCountdown();

      // Iniciar polling
      startPolling();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al generar QR';
      setError(errorMessage);
      console.error('Error generating QR:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar estado de conexión
  const checkConnectionState = async () => {
    try {
      console.log('[Polling] Checking connection state...');
      const data = await callEdgeFunction('/connection-state', 'GET');
      console.log('[Polling] Response received:', JSON.stringify(data));

      if (data.state === 'open') {
        // Conexión exitosa
        console.log('[Polling] ✅ Connection detected as OPEN! Stopping polling...');
        stopPolling();
        stopCountdown();
        setQrData(null);
        setConfig((prev) => ({
          ...prev,
          connectionState: 'open' as ConnectionState,
          lastConnectedAt: new Date().toISOString(),
        }));
        return 'open';
      }

      console.log('[Polling] Current state:', data.state);
      return data.state;
    } catch (err) {
      console.error('[Polling] ❌ Error checking connection state:', err);
      return 'error';
    }
  };

  // Iniciar polling
  const startPolling = () => {
    console.log('[Polling] 🚀 Starting polling (checking every 3 seconds)...');
    // Limpiar polling anterior si existe
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setPollingAttempts(0);

    pollingIntervalRef.current = window.setInterval(async () => {
      setPollingAttempts(prev => {
        const newAttempts = prev + 1;
        console.log(`[Polling] 🔄 Interval tick #${newAttempts}`);
        return newAttempts;
      });

      const state = await checkConnectionState();

      if (state === 'open' || state === 'error') {
        console.log('[Polling] ⛔ Stopping polling. Final state:', state);
        stopPolling();
      }
    }, 3000); // Cada 3 segundos
  };

  // Detener polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      console.log('[Polling] 🛑 Polling stopped');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Iniciar countdown
  const startCountdown = () => {
    // Limpiar countdown anterior si existe
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          console.log('[Countdown] ⏰ QR expired, resetting state...');
          stopCountdown();
          stopPolling();
          setQrData(null);
          setError('El QR ha expirado. Genera uno nuevo.');

          // Resetear estado en BD
          resetState().catch(err =>
            console.error('[Countdown] ❌ Error resetting state on expiration:', err)
          );

          return 0;
        }
        return prev - 1;
      });
    }, 1000); // Cada 1 segundo
  };

  // Detener countdown
  const stopCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  // Resetear estado a disconnected
  const resetState = async () => {
    try {
      console.log('[ResetState] 🔄 Resetting state to disconnected...');
      const data = await callEdgeFunction('/reset-state', 'POST');
      console.log('[ResetState] ✅ State reset successful:', data);

      // Actualizar config local
      setConfig((prev) => ({
        ...prev,
        connectionState: 'disconnected' as ConnectionState,
      }));

      return true;
    } catch (err) {
      console.error('[ResetState] ❌ Error resetting state:', err);
      return false;
    }
  };

  // Limpiar QR manualmente
  const clearQR = () => {
    stopPolling();
    stopCountdown();
    setQrData(null);
    setTimeLeft(120);
    setError(null);
  };

  // Actualizar form data
  const updateFormData = (field: keyof EvolutionConfigForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Cargar configuración al montar
  useEffect(() => {
    fetchConfig();
  }, []);

  // Verificar y corregir estado "connecting" huérfano
  useEffect(() => {
    const verifyStaleConnecting = async () => {
      if (config.connectionState === 'connecting' && !qrData) {
        console.log('[Init] ⚠️ Detected stale "connecting" state without active QR');
        console.log('[Init] 🔍 Verifying actual connection state...');

        const state = await checkConnectionState();

        if (state !== 'open') {
          console.log('[Init] 🔄 State is not "open", resetting to disconnected...');
          await resetState();
        }
      }
    };

    if (config.hasConfig && config.connectionState === 'connecting' && !qrData) {
      verifyStaleConnecting();
    }
  }, [config.hasConfig, config.connectionState]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopPolling();
      stopCountdown();
    };
  }, []);

  return {
    config,
    formData,
    qrData,
    isLoading,
    isSaving,
    error,
    timeLeft,
    pollingAttempts,
    fetchConfig,
    saveConfig,
    generateQR,
    clearQR,
    updateFormData,
    setError,
    checkConnectionState,
    resetState,
  };
}
