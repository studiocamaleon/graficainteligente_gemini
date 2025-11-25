import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface TrackingErrorProps {
  message: string;
  onRetry?: () => void;
}

export function TrackingError({ message, onRetry }: TrackingErrorProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#1A1F3A] to-[#0A0E27] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-[#1A1F3A] border border-red-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />

          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
                <div className="relative bg-red-500/10 p-4 rounded-full">
                  <AlertCircle className="w-12 h-12 text-red-400" />
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white text-center mb-3">
              No pudimos cargar tu orden
            </h2>

            <p className="text-gray-300 text-center mb-6">
              {message}
            </p>

            {onRetry && (
              <Button
                onClick={onRetry}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/20"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Intentar nuevamente
              </Button>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Si el problema persiste, contacta con nosotros
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
