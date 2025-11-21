import { CheckCircle2, Circle, Clock } from 'lucide-react';
import type { OrdenItemRuta } from '../../types/database';

interface StepProgressIndicatorProps {
  rutas: OrdenItemRuta[];
  currentStepId?: string;
}

export function StepProgressIndicator({ rutas, currentStepId }: StepProgressIndicatorProps) {
  const totalPasos = rutas.length;
  const pasosCompletados = rutas.filter((r) => r.estado_paso === 'completado').length;
  const pasosOmitidos = rutas.filter((r) => r.estado_paso === 'omitido').length;
  const pasosEnProceso = rutas.filter((r) => r.estado_paso === 'en_proceso').length;
  const porcentaje = totalPasos > 0 ? Math.round(((pasosCompletados + pasosOmitidos) / totalPasos) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">Progreso de Producción</span>
        <span className="font-bold text-blue-600">{porcentaje}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span>{pasosCompletados} completados</span>
          </div>
          {pasosEnProceso > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>{pasosEnProceso} en proceso</span>
            </div>
          )}
          {pasosOmitidos > 0 && (
            <div className="flex items-center gap-1">
              <Circle className="w-3.5 h-3.5 text-orange-600" />
              <span>{pasosOmitidos} omitidos</span>
            </div>
          )}
        </div>
        <span className="font-medium">
          {pasosCompletados + pasosOmitidos}/{totalPasos} pasos
        </span>
      </div>
    </div>
  );
}
