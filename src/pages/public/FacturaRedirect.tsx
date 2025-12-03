import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, AlertCircle, Loader2, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

interface FacturaResponse {
  success: boolean;
  downloadUrl?: string;
  numero_factura?: string;
  orden_numero?: string;
  error?: string;
  expires_at?: string;
}

type RedirectStatus = 'loading' | 'success' | 'error' | 'expired' | 'not-found';

export function FacturaRedirect() {
  const { companyId, token } = useParams<{ companyId: string; token: string }>();
  const [status, setStatus] = useState<RedirectStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facturaInfo, setFacturaInfo] = useState<{ numero: string; orden: string } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!companyId || !token) {
      setStatus('error');
      setErrorMessage('URL inválida. Faltan parámetros requeridos.');
      return;
    }

    fetchFactura();
  }, [companyId, token]);

  useEffect(() => {
    if (status === 'loading') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      setProgress(100);
    }
  }, [status]);

  const fetchFactura = async () => {
    try {
      console.log('[FacturaRedirect] Obteniendo factura...', { companyId, token });

      // Construir URL con parámetros
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/redirect-factura?companyId=${companyId}&token=${token}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al obtener la factura');
      }

      const result: FacturaResponse = await response.json();

      console.log('[FacturaRedirect] Respuesta:', result);

      if (!result.success) {
        if (response.status === 410) {
          setStatus('expired');
        } else if (response.status === 404) {
          setStatus('not-found');
        } else {
          setStatus('error');
        }
        setErrorMessage(result.error || 'Error al obtener la factura');
        return;
      }

      if (result.downloadUrl) {
        setStatus('success');
        if (result.numero_factura && result.orden_numero) {
          setFacturaInfo({
            numero: result.numero_factura,
            orden: result.orden_numero,
          });
        }

        // Esperar un momento para mostrar el éxito antes de redirigir
        setTimeout(() => {
          window.location.href = result.downloadUrl!;
        }, 1500);
      } else {
        throw new Error('No se recibió URL de descarga');
      }
    } catch (err: any) {
      console.error('[FacturaRedirect] Error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Error al procesar la solicitud');
    }
  };

  const handleRetry = () => {
    setStatus('loading');
    setErrorMessage('');
    setProgress(0);
    fetchFactura();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#1A1F3A] to-[#0A0E27] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Card principal */}
          <div className="bg-[#1A1F3A] border border-gray-700/50 rounded-2xl shadow-2xl p-8">
            {/* Loading State */}
            {status === 'loading' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-cyan-500/30">
                      <FileText className="w-10 h-10 text-cyan-400" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Preparando tu factura
                </h2>
                <p className="text-gray-400 mb-6">
                  Por favor espera un momento...
                </p>

                {/* Progress bar */}
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="text-sm text-gray-500 mt-4">
                  Se abrirá automáticamente en unos segundos
                </p>
              </div>
            )}

            {/* Success State */}
            {status === 'success' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center border border-green-500/30 animate-pulse">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Factura encontrada
                </h2>

                {facturaInfo && (
                  <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                    <div className="text-sm text-gray-400 mb-1">Factura</div>
                    <div className="text-lg font-semibold text-white">{facturaInfo.numero}</div>
                    <div className="text-sm text-gray-400 mt-2">Orden</div>
                    <div className="text-white">{facturaInfo.orden}</div>
                  </div>
                )}

                <p className="text-gray-400">
                  Abriendo el documento...
                </p>

                <div className="mt-4">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
                </div>
              </div>
            )}

            {/* Not Found State */}
            {status === 'not-found' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-2xl flex items-center justify-center border border-orange-500/30">
                    <AlertCircle className="w-10 h-10 text-orange-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Factura no encontrada
                </h2>
                <p className="text-gray-400 mb-6">
                  El link que has usado no existe o es inválido. Por favor verifica que hayas copiado la URL completa.
                </p>

                <Button
                  onClick={handleRetry}
                  variant="primary"
                  className="w-full"
                >
                  Intentar nuevamente
                </Button>
              </div>
            )}

            {/* Expired State */}
            {status === 'expired' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                    <Clock className="w-10 h-10 text-red-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Link expirado
                </h2>
                <p className="text-gray-400 mb-6">
                  Este link ha expirado. Los links de facturas son válidos por 30 días. Por favor contacta con la empresa para obtener un nuevo link.
                </p>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    Si necesitas acceder a esta factura, solicita un nuevo enlace al vendedor.
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-red-500/30">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Error al cargar la factura
                </h2>
                <p className="text-gray-400 mb-6">
                  {errorMessage || 'Ocurrió un error al procesar tu solicitud. Por favor intenta nuevamente.'}
                </p>

                <Button
                  onClick={handleRetry}
                  variant="primary"
                  className="w-full"
                >
                  Intentar nuevamente
                </Button>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              Enlace seguro de descarga de factura
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
