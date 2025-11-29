import { Play, PlayCircle, CheckCircle, Pause, SkipForward, History } from 'lucide-react';
import { IconActionButton } from './IconActionButton';
import type { EstadoPaso } from '../../types/database';

interface StepActionsBarProps {
  estadoPaso: EstadoPaso;
  canStart: boolean;
  onStart: () => void;
  onComplete: () => void;
  onPause: () => void;
  onSkip: () => void;
  onViewHistory: () => void;
  onResume?: () => void;
  loading?: boolean;
  cantidadPausas?: number;
  loadingAction?: 'start' | 'complete' | 'pause' | 'skip' | 'resume' | null;
}

export function StepActionsBar({
  estadoPaso,
  canStart,
  onStart,
  onComplete,
  onPause,
  onSkip,
  onViewHistory,
  onResume,
  loading = false,
  cantidadPausas = 0,
  loadingAction = null,
}: StepActionsBarProps) {
  // No mostrar nada si el paso está completado u omitido
  if (estadoPaso === 'completado' || estadoPaso === 'omitido') {
    return null;
  }

  return (
    <div
      className="
        flex items-start gap-4
        px-4 py-3
        bg-gradient-to-br from-gray-50/80 to-gray-100/50
        rounded-xl
        border border-gray-200/60
        shadow-sm
        overflow-x-auto
        scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100
      "
    >
      {/* Estado: PAUSADO */}
      {estadoPaso === 'pausado' && (
        <>
          <IconActionButton
            icon={<PlayCircle className="w-6 h-6" />}
            label="Reanudar"
            variant="primary"
            tooltip="Reanudar la ejecución de este paso"
            onClick={onResume || onStart}
            loading={loadingAction === 'resume'}
            disabled={loading && loadingAction !== 'resume'}
          />

          {cantidadPausas > 0 && (
            <IconActionButton
              icon={<History className="w-6 h-6" />}
              label="Historial"
              variant="secondary"
              tooltip={`Ver historial completo de ${cantidadPausas} pausa${cantidadPausas !== 1 ? 's' : ''}`}
              onClick={onViewHistory}
              badge={cantidadPausas}
              disabled={loading}
            />
          )}
        </>
      )}

      {/* Estado: PENDIENTE */}
      {estadoPaso === 'pendiente' && (
        <>
          <IconActionButton
            icon={<Play className="w-6 h-6" />}
            label="Iniciar"
            variant="primary"
            tooltip={canStart ? 'Comenzar la ejecución de este paso' : 'Completa el paso anterior primero'}
            onClick={onStart}
            loading={loadingAction === 'start'}
            disabled={!canStart || (loading && loadingAction !== 'start')}
          />

          <IconActionButton
            icon={<SkipForward className="w-6 h-6" />}
            label="Omitir"
            variant="outline"
            tooltip={canStart ? 'Saltar este paso (requiere justificación)' : 'Completa el paso anterior primero'}
            onClick={onSkip}
            loading={loadingAction === 'skip'}
            disabled={!canStart || (loading && loadingAction !== 'skip')}
          />
        </>
      )}

      {/* Estado: EN PROCESO */}
      {estadoPaso === 'en_proceso' && (
        <>
          <IconActionButton
            icon={<CheckCircle className="w-6 h-6" />}
            label="Completar"
            variant="success"
            tooltip="Marcar este paso como completado"
            onClick={onComplete}
            loading={loadingAction === 'complete'}
            disabled={loading && loadingAction !== 'complete'}
          />

          <IconActionButton
            icon={<Pause className="w-6 h-6" />}
            label="Pausar"
            variant="warning"
            tooltip="Pausar temporalmente este paso"
            onClick={onPause}
            loading={loadingAction === 'pause'}
            disabled={loading && loadingAction !== 'pause'}
          />

          {cantidadPausas > 0 && (
            <IconActionButton
              icon={<History className="w-6 h-6" />}
              label="Historial"
              variant="secondary"
              tooltip={`Ver historial de ${cantidadPausas} pausa${cantidadPausas !== 1 ? 's' : ''}`}
              onClick={onViewHistory}
              badge={cantidadPausas}
              disabled={loading}
            />
          )}

          <IconActionButton
            icon={<SkipForward className="w-6 h-6" />}
            label="Omitir"
            variant="outline"
            tooltip="Saltar este paso (requiere justificación)"
            onClick={onSkip}
            loading={loadingAction === 'skip'}
            disabled={loading && loadingAction !== 'skip'}
          />
        </>
      )}
    </div>
  );
}
