import { Check } from 'lucide-react';
import type { WizardStep } from '../../types/wizard';

interface StepIndicatorProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = step.isCompleted;
          const isClickable = index < currentStep || isCompleted;

          return (
            <div key={step.name} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all
                    ${isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : isCompleted
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-500'
                    }
                    ${isClickable && !isActive ? 'cursor-pointer' : ''}
                    ${!isClickable ? 'cursor-not-allowed' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>
                <span
                  className={`
                    mt-2 text-xs font-medium text-center
                    ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}
                  `}
                >
                  {step.title}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 -mt-7">
                  <div
                    className={`
                      h-full transition-all
                      ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}
                    `}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
