import { Play, CheckCircle, SkipForward } from 'lucide-react';
import { Button } from '../ui/Button';
import type { EstadoPaso } from '../../types/database';

interface StepActionButtonsProps {
  estadoPaso: EstadoPaso;
  canStart: boolean;
  onStart: () => void;
  onComplete: () => void;
  onSkip: () => void;
  loading?: boolean;
}

export function StepActionButtons({
  estadoPaso,
  canStart,
  onStart,
  onComplete,
  onSkip,
  loading = false,
}: StepActionButtonsProps) {
  if (estadoPaso === 'completado' || estadoPaso === 'omitido') {
    return null;
  }

  if (estadoPaso === 'pendiente') {
    return (
      <div className="flex gap-2">
        <Button
          onClick={onStart}
          disabled={!canStart || loading}
          variant="primary"
          size="sm"
          className="flex-1"
        >
          <Play className="w-4 h-4 mr-1" />
          Iniciar Paso
        </Button>
        <Button
          onClick={onSkip}
          disabled={!canStart || loading}
          variant="outline"
          size="sm"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (estadoPaso === 'en_proceso') {
    return (
      <div className="flex gap-2">
        <Button
          onClick={onComplete}
          disabled={loading}
          variant="primary"
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Completar Paso
        </Button>
        <Button
          onClick={onSkip}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return null;
}
