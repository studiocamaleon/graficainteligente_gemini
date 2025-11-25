import { useParams } from 'react-router-dom';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import { TrackingLoader } from '../../components/tracking/TrackingLoader';
import { TrackingError } from '../../components/tracking/TrackingError';
import { TrackingHeader } from '../../components/tracking/TrackingHeader';
import { TrackingStatusMessage } from '../../components/tracking/TrackingStatusMessage';
import { TrackingItemCard } from '../../components/tracking/TrackingItemCard';
import { TrackingFooter } from '../../components/tracking/TrackingFooter';
import { RefreshCw, Radio } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export function OrderTracking() {
  const { token } = useParams<{ token: string }>();

  const { data, loading, error, refetch, isUpdating, lastUpdate } = useOrderTracking(token || '', {
    autoRefresh: true,
    refreshInterval: 30000,
  });

  if (loading) {
    return <TrackingLoader />;
  }

  if (error || !data) {
    return (
      <TrackingError
        message={error || 'No se pudo cargar la información de la orden'}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#1A1F3A] to-[#0A0E27] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

      <div className="absolute top-1/4 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 md:py-12">
        <TrackingHeader
          numeroOrden={data.numero_orden}
          estado={data.estado}
          fechaCreacion={data.fecha_creacion}
          fechaEstimadaEntrega={data.fecha_estimada_entrega}
          clienteNombre={data.cliente_nombre}
        />

        <div className="mt-8">
          <TrackingStatusMessage
            estado={data.estado}
            numeroOrden={data.numero_orden}
            companyAddress={data.company_address}
            companyBusinessHours={data.company_business_hours}
          />
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full mr-3" />
                Items de la Orden
              </h2>
              {isUpdating && (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/30 animate-pulse">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Sincronizando...</span>
                </div>
              )}
            </div>

            <Button
              onClick={refetch}
              variant="outline"
              className="flex items-center space-x-2 border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 transition-all duration-300"
              disabled={isUpdating}
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>

          {data.items.length === 0 ? (
            <div className="bg-[#1A1F3A] border border-gray-700 rounded-xl p-8 text-center">
              <p className="text-gray-400">No hay items en esta orden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.items.map((item, index) => (
                <TrackingItemCard key={item.id} item={item} index={index} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-xs">
            <p className="text-gray-500 bg-[#1A1F3A] inline-block px-4 py-2 rounded-full border border-gray-700">
              🔴 Actualizaciones en tiempo real
            </p>
            {lastUpdate && (
              <p className="text-gray-400 bg-[#1A1F3A] inline-block px-4 py-2 rounded-full border border-gray-700">
                Última actualización: {dayjs(lastUpdate).format('HH:mm:ss')}
              </p>
            )}
          </div>
        </div>

        <TrackingFooter />
      </div>
    </div>
  );
}
