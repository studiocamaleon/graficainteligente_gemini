import { Boxes } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';

interface StationCardProps {
  estacion_id: string;
  estacion_nombre: string;
  estacion_descripcion: string | null;
  pasos_mesa_trabajo: number;
  pasos_pendientes: number;
  total_activos: number;
  onClick: () => void;
}

export function StationCard({
  estacion_nombre,
  estacion_descripcion,
  pasos_mesa_trabajo,
  pasos_pendientes,
  total_activos,
  onClick,
}: StationCardProps) {
  const getStatusTone = () => {
    if (total_activos === 0) return 'border-slate-200 bg-white';
    if (total_activos <= 5) return 'border-emerald-200 bg-emerald-50/40';
    if (total_activos <= 15) return 'border-amber-200 bg-amber-50/40';
    return 'border-rose-200 bg-rose-50/40';
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border ${getStatusTone()}`}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${total_activos > 0 ? 'bg-slate-900' : 'bg-slate-200'}`}>
              <Boxes className={`w-5 h-5 ${total_activos > 0 ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{estacion_nombre}</h3>
              {estacion_descripcion && (
                <p className="text-sm text-slate-500 line-clamp-1">{estacion_descripcion}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold text-slate-900">{total_activos}</span>
            <span className="text-sm text-slate-500">
              {total_activos === 1 ? 'paso activo' : 'pasos activos'}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {pasos_mesa_trabajo > 0 && (
              <Badge variant="warning" className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                {pasos_mesa_trabajo} en mesa
              </Badge>
            )}
            {pasos_pendientes > 0 && (
              <Badge variant="info">
                {pasos_pendientes} {pasos_pendientes === 1 ? 'pendiente' : 'pendientes'}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <span className="text-sm text-slate-700 hover:text-slate-950 font-medium">
            Ver detalles →
          </span>
        </div>
      </div>
    </Card>
  );
}
