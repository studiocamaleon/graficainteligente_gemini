import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, AlertCircle, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ReciboResponse {
  success: boolean;
  downloadUrl?: string;
  numero_recibo?: number;
  orden_numero?: string | null;
  monto?: number;
  fecha_pago?: string;
  error?: string;
}

type RedirectStatus = 'loading' | 'success' | 'error' | 'not-found' | 'not-ready';

export function ReciboRedirect() {
  const { companyId, token } = useParams<{ companyId: string; token: string }>();
  const [status, setStatus] = useState<RedirectStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [reciboInfo, setReciboInfo] = useState<{ numero: string; orden?: string; monto?: string } | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!companyId || !token) {
      setStatus('error');
      setErrorMessage('URL inválida. Faltan parámetros requeridos.');
      return;
    }

    fetchRecibo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, token]);

  useEffect(() => {
    if (status === 'loading') {
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + 10));
      }, 100);
      return () => clearInterval(interval);
    }
    setProgress(100);
  }, [status]);

  const fetchRecibo = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/redirect-recibo?companyId=${companyId}&token=${token}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error || 'Error al obtener el recibo';

        if (response.status === 404) {
          setStatus('not-found');
        } else if (response.status === 409) {
          setStatus('not-ready');
        } else {
          setStatus('error');
        }
        setErrorMessage(msg);
        return;
      }

      const result: ReciboResponse = await response.json();

      if (!result.success) {
        setStatus('error');
        setErrorMessage(result.error || 'Error al obtener el recibo');
        return;
      }

      if (result.downloadUrl) {
        setStatus('success');
        const nro = result.numero_recibo ? String(result.numero_recibo).padStart(6, '0') : '-';
        const monto =
          typeof result.monto === 'number'
            ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(result.monto)
            : undefined;
        setReciboInfo({
          numero: nro,
          orden: result.orden_numero || undefined,
          monto,
        });

        setTimeout(() => {
          window.location.href = result.downloadUrl!;
        }, 1500);
      } else {
        throw new Error('No se recibió URL de descarga');
      }
    } catch (err: any) {
      console.error('[ReciboRedirect] Error:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Error al procesar la solicitud');
    }
  };

  const handleRetry = () => {
    setStatus('loading');
    setErrorMessage('');
    setProgress(0);
    fetchRecibo();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#1A1F3A] to-[#0A0E27] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                {status === 'loading' && <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />}
                {status === 'success' && <CheckCircle className="w-8 h-8 text-green-400" />}
                {status === 'not-ready' && <Clock className="w-8 h-8 text-yellow-400" />}
                {(status === 'error' || status === 'not-found') && <AlertCircle className="w-8 h-8 text-red-400" />}
              </div>

              <h1 className="text-2xl font-bold text-white mb-2">
                {status === 'loading' && 'Preparando tu recibo'}
                {status === 'success' && 'Recibo listo'}
                {status === 'not-ready' && 'Recibo en proceso'}
                {status === 'not-found' && 'Recibo no encontrado'}
                {status === 'error' && 'Error'}
              </h1>

              {reciboInfo && status === 'success' && (
                <div className="text-white/80 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Recibo {reciboInfo.numero}</span>
                  </div>
                  {reciboInfo.orden && <div className="mt-1">Orden: {reciboInfo.orden}</div>}
                  {reciboInfo.monto && <div className="mt-1">Monto: {reciboInfo.monto}</div>}
                </div>
              )}

              {status === 'loading' && (
                <div className="mt-4">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-sm mt-2">Redirigiendo a la descarga...</p>
                </div>
              )}
            </div>

            {(status === 'error' || status === 'not-found' || status === 'not-ready') && (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-white/80 text-sm">{errorMessage}</p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleRetry} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
                    Reintentar
                  </Button>
                </div>

                {status === 'not-ready' && (
                  <p className="text-white/60 text-xs text-center">
                    Si acabás de registrar el pago, el PDF puede tardar unos segundos en generarse.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

