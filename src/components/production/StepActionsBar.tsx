import { CheckCircle } from 'lucide-react';
import { IconActionButton } from './IconActionButton';
import type { EstadoPaso } from '../../types/database';

interface StepActionsBarProps {
  estadoPaso: EstadoPaso;
  canComplete: boolean;
  onComplete: () => void;
  loading?: boolean;
}

export function StepActionsBar({
  estadoPaso,
  canComplete,
  onComplete,
  loading = false,
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
      <IconActionButton
        icon={<CheckCircle className="w-6 h-6" />}
        label="Marcar completado"
        variant="success"
        tooltip={
          canComplete
            ? 'Marca este paso como completado y registra responsable/fecha'
            : 'Completa primero los pasos anteriores'
        }
        onClick={onComplete}
        loading={loading}
        disabled={!canComplete}
      />
    </div>
  );
}
