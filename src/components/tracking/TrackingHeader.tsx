import { Package, Calendar } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { TrackingEstadoOrden } from '../../types/tracking';
import { getEstadoLabel } from '../../types/tracking';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface TrackingHeaderProps {
  numeroOrden: string;
  estado: TrackingEstadoOrden;
  fechaCreacion: string;
  fechaEstimadaEntrega: string | null;
  clienteNombre: string;
}

export function TrackingHeader({
  numeroOrden,
  estado,
  fechaCreacion,
  fechaEstimadaEntrega,
  clienteNombre,
}: TrackingHeaderProps) {
  const getEstadoColor = (est: TrackingEstadoOrden) => {
    const colors = {
      pendiente: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      en_proceso: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse',
      finalizada: 'bg-green-500/20 text-green-300 border-green-500/30',
      entregada: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      cancelada: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    return colors[est];
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1F3A] to-[#252B4A] border border-cyan-500/20 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />

      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 md:p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl shadow-lg shadow-cyan-500/30">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Orden de Trabajo</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wide">
                {numeroOrden}
              </h1>
            </div>
          </div>

          <div className={`px-4 py-2 rounded-xl border ${getEstadoColor(estado)} font-semibold`}>
            {getEstadoLabel(estado)}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center text-gray-300">
            <span className="text-sm">Cliente:</span>
            <span className="ml-2 font-medium text-white">{clienteNombre}</span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center text-gray-400">
              <Calendar className="w-4 h-4 mr-2 text-cyan-400" />
              <span>Creada: {dayjs(fechaCreacion).format('DD/MM/YYYY')}</span>
            </div>

            {fechaEstimadaEntrega && (
              <div className="flex items-center text-gray-400">
                <Calendar className="w-4 h-4 mr-2 text-purple-400" />
                <span>Entrega estimada: {dayjs(fechaEstimadaEntrega).format('DD/MM/YYYY')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
