import { CheckCircle, Package, PartyPopper, Clock, MapPin } from 'lucide-react';
import type { TrackingEstadoOrden, CompanyBusinessHours } from '../../types/tracking';
import { formatBusinessHoursForDisplay } from '../../utils/timeUtils';

interface TrackingStatusMessageProps {
  estado: TrackingEstadoOrden;
  numeroOrden: string;
  companyAddress: string | null;
  companyBusinessHours: CompanyBusinessHours[];
}

export function TrackingStatusMessage({ estado, numeroOrden, companyAddress, companyBusinessHours }: TrackingStatusMessageProps) {
  if (estado === 'finalizada') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/20 via-[#1A1F3A] to-green-500/10 border border-green-500/30 shadow-2xl">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/20 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10 p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-green-500/30 blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-full shadow-lg">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center space-x-2">
            <PartyPopper className="w-8 h-8 text-yellow-400" />
            <span>¡Tu orden está lista!</span>
            <PartyPopper className="w-8 h-8 text-yellow-400" />
          </h2>

          <p className="text-xl text-green-200 mb-6">
            Tu pedido ha sido completado y está listo para retirar
          </p>

          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-left max-w-md mx-auto">
            <h3 className="font-semibold text-green-300 mb-4">Información de retiro:</h3>
            <div className="space-y-3 text-gray-300">
              <p className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-white">Dirección:</span>{' '}
                  {companyAddress || 'Consultar al momento del retiro'}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-white">Horarios:</span>{' '}
                  {formatBusinessHoursForDisplay(companyBusinessHours)}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Package className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-white">Número de orden:</span> {numeroOrden}
                </span>
              </p>
              <p className="text-sm text-green-200 mt-4 bg-green-500/10 p-3 rounded-lg">
                Por favor, trae tu número de orden al retirar
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (estado === 'entregada') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/20 via-[#1A1F3A] to-purple-500/10 border border-purple-500/30 shadow-2xl">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10 p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-full shadow-lg">
                <Package className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4">
            ✨ ¡Gracias por tu confianza! ✨
          </h2>

          <p className="text-xl text-purple-200 mb-4">
            Tu orden fue entregada exitosamente
          </p>

          <p className="text-gray-300 mb-6">
            Esperamos que estés satisfecho con nuestro trabajo.
            <br />
            ¡Te esperamos en tu próximo pedido!
          </p>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6 max-w-md mx-auto">
            <p className="text-sm text-purple-200">
              ¿Tienes algún comentario o sugerencia? Nos encantaría escucharte para seguir mejorando nuestro servicio.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (estado === 'en_proceso') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-[#1A1F3A] to-blue-500/10 border border-cyan-500/30 shadow-2xl">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10 p-6 md:p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-2xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-full shadow-lg animate-pulse">
                <Package className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Tu orden está en producción
          </h2>

          <p className="text-cyan-200 mb-4">
            Estamos trabajando en tu pedido. Puedes ver el progreso detallado abajo.
          </p>

          <p className="text-sm text-gray-400">
            Esta página se actualiza automáticamente cada 30 segundos
          </p>
        </div>
      </div>
    );
  }

  if (estado === 'pendiente') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-500/20 via-[#1A1F3A] to-gray-500/10 border border-gray-500/30 shadow-2xl">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative z-10 p-6 md:p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-3 rounded-full shadow-lg">
              <Clock className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Tu orden está en cola
          </h2>

          <p className="text-gray-300">
            Pronto comenzaremos a trabajar en tu pedido
          </p>
        </div>
      </div>
    );
  }

  return null;
}
