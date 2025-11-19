import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  isCalculating: boolean;
  hasChanges: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  canGoBack,
  canGoNext,
  isLastStep,
  isCalculating,
  hasChanges,
  onPrev,
  onNext,
  onCancel,
  onSubmit,
}: WizardNavigationProps) {
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('¿Está seguro que desea cancelar? Se perderán los cambios realizados.')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t">
      <Button
        variant="ghost"
        onClick={handleCancel}
        className="gap-2"
      >
        <X className="w-4 h-4" />
        Cancelar
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={!canGoBack}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </Button>

        {!isLastStep ? (
          <Button
            onClick={onNext}
            disabled={!canGoNext || isCalculating}
            className="gap-2"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={!canGoNext || isCalculating}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Agregar a Orden
          </Button>
        )}
      </div>
    </div>
  );
}
