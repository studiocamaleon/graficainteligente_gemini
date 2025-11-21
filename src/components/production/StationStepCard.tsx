import { Clock, Package, User, FileText } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { calcularTiempoTranscurrido, formatearFechaOrden } from '../../utils/timeUtils';
import type { EstadoPaso } from '../../types/database';

interface StationStepCardProps {
  ruta_id: string;
  paso_nombre: string;
  estado_paso: EstadoPaso;
  numero_orden: string;
  cliente_nombre: string;
  producto_nombre: string;
  cantidad: number;
  fecha_inicio: string | null;
  fecha_creacion_orden: string;
  orden_item_id: string;
  onViewDetails: () => void;
}

export function StationStepCard({
  paso_nombre,
  estado_paso,
  numero_orden,
  cliente_nombre,
  producto_nombre,
  cantidad,
  fecha_inicio,
  fecha_creacion_orden,
  onViewDetails,
}: StationStepCardProps) {
  const isEnProceso = estado_paso === 'en_proceso';

  const getBorderColor = () => {
    return isEnProceso ? 'border-orange-400' : 'border-blue-400';
  };

  const getBgColor = () => {
    return isEnProceso ? 'bg-orange-50' : 'bg-white';
  };

  return (
    <Card className={`border-l-4 ${getBorderColor()} ${getBgColor()} hover:shadow-md transition-shadow`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={onViewDetails}
                className="text-lg font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {numero_orden}
              </button>
              {isEnProceso ? (
                <Badge variant="warning" className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  EN PROCESO
                </Badge>
              ) : (
                <Badge variant="info">PENDIENTE</Badge>
              )}
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span>{cliente_nombre}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span>
                  {producto_nombre} - {cantidad} {cantidad === 1 ? 'unidad' : 'unidades'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-700">{paso_nombre}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {isEnProceso && fecha_inicio ? (
              <div className="flex items-center gap-1 text-orange-600 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{calcularTiempoTranscurrido(fecha_inicio)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatearFechaOrden(fecha_creacion_orden)}</span>
              </div>
            )}
          </div>

          <Button size="sm" onClick={onViewDetails}>
            Ver Detalles
          </Button>
        </div>
      </div>
    </Card>
  );
}
