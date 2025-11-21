interface JobProgressBarProps {
  totalPasos: number;
  pasosCompletados: number;
  pasosEnProceso: number;
  pasosPendientes: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md';
}

export function JobProgressBar({
  totalPasos,
  pasosCompletados,
  pasosEnProceso,
  pasosPendientes,
  showPercentage = true,
  size = 'md',
}: JobProgressBarProps) {
  const porcentaje = totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;

  const porcentajeCompletado = totalPasos > 0 ? (pasosCompletados / totalPasos) * 100 : 0;
  const porcentajeEnProceso = totalPasos > 0 ? (pasosEnProceso / totalPasos) * 100 : 0;

  const heightClass = size === 'sm' ? 'h-2' : 'h-3';
  const textSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-1">
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClass}`}>
        <div className="h-full flex">
          {pasosCompletados > 0 && (
            <div
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${porcentajeCompletado}%` }}
            />
          )}
          {pasosEnProceso > 0 && (
            <div
              className="bg-blue-500 transition-all duration-300"
              style={{ width: `${porcentajeEnProceso}%` }}
            />
          )}
        </div>
      </div>

      <div className={`flex items-center justify-between ${textSizeClass} text-gray-600`}>
        <span className="font-medium">
          {pasosCompletados}/{totalPasos} pasos
        </span>
        {showPercentage && (
          <span className="font-semibold text-gray-700">
            {porcentaje}%
          </span>
        )}
      </div>
    </div>
  );
}
