import { Boxes } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';

interface StationCardProps {
  estacion_id: string;
  estacion_nombre: string;
  estacion_descripcion: string | null;
  pasos_en_proceso: number;
  pasos_pendientes: number;
  pasos_pausados: number;
  total_activos: number;
  onClick: () => void;
}

export function StationCard({
  estacion_nombre,
  estacion_descripcion,
  pasos_en_proceso,
  pasos_pendientes,
  pasos_pausados,
  total_activos,
  onClick,
}: StationCardProps) {
  const getBorderColor = () => {
    if (total_activos === 0) return 'border-gray-200';
    if (total_activos <= 5) return 'border-green-300';
    if (total_activos <= 15) return 'border-yellow-300';
    return 'border-orange-400';
  };

  const getIntensityClass = () => {
    if (total_activos === 0) return '';
    if (total_activos <= 5) return 'bg-green-50';
    if (total_activos <= 15) return 'bg-yellow-50';
    return 'bg-orange-50';
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg border-l-4 ${getBorderColor()} ${getIntensityClass()}`}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${total_activos > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Boxes className={`w-6 h-6 ${total_activos > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{estacion_nombre}</h3>
              {estacion_descripcion && (
                <p className="text-sm text-gray-500 line-clamp-1">{estacion_descripcion}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-gray-900">{total_activos}</span>
            <span className="text-sm text-gray-500">
              {total_activos === 1 ? 'paso activo' : 'pasos activos'}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {pasos_pausados > 0 && (
              <Badge variant="error" className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                {pasos_pausados} {pasos_pausados === 1 ? 'pausado' : 'pausados'}
              </Badge>
            )}
            {pasos_en_proceso > 0 && (
              <Badge variant="warning" className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                {pasos_en_proceso} en proceso
              </Badge>
            )}
            {pasos_pendientes > 0 && (
              <Badge variant="info">
                {pasos_pendientes} {pasos_pendientes === 1 ? 'pendiente' : 'pendientes'}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ver detalles →
          </span>
        </div>
      </div>
    </Card>
  );
}
