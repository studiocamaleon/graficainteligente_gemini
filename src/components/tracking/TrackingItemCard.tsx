import { useState } from 'react';
import { ChevronDown, ChevronUp, Package2, TrendingUp } from 'lucide-react';
import type { TrackingItem } from '../../types/tracking';
import { TrackingStepProgress } from './TrackingStepProgress';
import { calculateItemProgress } from '../../types/tracking';

interface TrackingItemCardProps {
  item: TrackingItem;
  index: number;
}

export function TrackingItemCard({ item, index }: TrackingItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  const { completados, total, porcentaje } = calculateItemProgress(item.pasos);

  const getEstadoColor = () => {
    if (item.estado === 'finalizado') return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (item.estado === 'en_proceso') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
  };

  return (
    <div className="group">
      <div
        className="bg-gradient-to-br from-[#1A1F3A] to-[#252B4A] border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-500/40 transition-all duration-300 shadow-lg hover:shadow-cyan-500/10"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-5 md:p-6 text-left focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded-xl transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 p-2 rounded-lg">
                  <Package2 className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {item.producto_nombre}
                  </h3>
                  {item.producto_categoria && (
                    <p className="text-sm text-gray-400">{item.producto_categoria}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-300">
                  <span className="font-medium">Cantidad:</span> {item.cantidad} unidades
                </span>

                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getEstadoColor()}`}>
                  {item.estado === 'finalizado'
                    ? 'Finalizado'
                    : item.estado === 'en_proceso'
                    ? 'En Proceso'
                    : 'Pendiente'}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1 text-cyan-400" />
                    Progreso
                  </span>
                  <span className="text-cyan-400 font-semibold">
                    {completados}/{total} pasos ({porcentaje}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 shadow-lg shadow-cyan-500/50"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="ml-4 flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-6 h-6 text-cyan-400 transition-transform duration-300" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-400 transition-transform duration-300 group-hover:text-cyan-400" />
              )}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-5 md:px-6 pb-6 animate-in slide-in-from-top duration-300">
            <div className="border-t border-cyan-500/20 pt-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center">
                <div className="w-1 h-4 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full mr-2" />
                Pasos de Producción
              </h4>
              <TrackingStepProgress pasos={item.pasos} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
