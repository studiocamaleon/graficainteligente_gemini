import { useState, useCallback } from 'react';
import type { WizardState, WizardStep, ImpresionLaserConfig } from '../../types/wizard';

const initialConfig: ImpresionLaserConfig = {
  producto_id: null,
  producto_laser_id: null,
  producto_nombre: null,
  categoria_nombre: null,
  cantidad: null,
  tipo_venta: null,
  cantidades_fijas: [],
  cantidad_minima: null,
  medida_ancho: null,
  medida_alto: null,
  medida_display: null,
  tinta: null,
  tinta_nombre: null,
  cara_impresa: null,
  caras_disponibles: [],
  servicios_seleccionados: [],
  acabados_seleccionados: [],
  material_id: null,
  material_nombre: null,
  variante_id: null,
  variante_nombre: null,
  precio_base: null,
  precio_servicios: 0,
  precio_acabados: 0,
  precio_total: null,
  tiene_precio_configurado: false,
};

const initialSteps: WizardStep[] = [
  { name: 'product_search', title: 'Buscar Producto', isValid: false, isCompleted: false },
  { name: 'quantity', title: 'Cantidad', isValid: false, isCompleted: false },
  { name: 'size', title: 'Medida', isValid: false, isCompleted: false },
  { name: 'print_config', title: 'Configuración', isValid: false, isCompleted: false },
  { name: 'services', title: 'Extras', isValid: true, isCompleted: false },
  { name: 'finishings', title: 'Acabados', isValid: true, isCompleted: false },
  { name: 'summary', title: 'Resumen', isValid: false, isCompleted: false },
];

export function useWizardState() {
  const [state, setState] = useState<WizardState>({
    currentStep: 0,
    steps: initialSteps,
    config: initialConfig,
    isCalculatingPrice: false,
    hasChanges: false,
  });

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep >= prev.steps.length - 1) return prev;

      const newSteps = [...prev.steps];
      newSteps[prev.currentStep].isCompleted = true;

      return {
        ...prev,
        currentStep: prev.currentStep + 1,
        steps: newSteps,
      };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep <= 0) return prev;
      return {
        ...prev,
        currentStep: prev.currentStep - 1,
      };
    });
  }, []);

  const goToStep = useCallback((stepIndex: number) => {
    setState(prev => {
      if (stepIndex < 0 || stepIndex >= prev.steps.length) return prev;
      if (stepIndex > prev.currentStep && !prev.steps[prev.currentStep].isValid) return prev;

      return {
        ...prev,
        currentStep: stepIndex,
      };
    });
  }, []);

  const updateStepData = useCallback((data: Partial<ImpresionLaserConfig>) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        ...data,
      },
      hasChanges: true,
    }));
  }, []);

  const updateStepValidity = useCallback((stepIndex: number, isValid: boolean) => {
    setState(prev => {
      const newSteps = [...prev.steps];
      if (newSteps[stepIndex]) {
        newSteps[stepIndex].isValid = isValid;
      }
      return {
        ...prev,
        steps: newSteps,
      };
    });
  }, []);

  const setCalculatingPrice = useCallback((isCalculating: boolean) => {
    setState(prev => ({
      ...prev,
      isCalculatingPrice: isCalculating,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      currentStep: 0,
      steps: initialSteps.map(s => ({ ...s, isValid: s.name === 'services' || s.name === 'finishings', isCompleted: false })),
      config: { ...initialConfig },
      isCalculatingPrice: false,
      hasChanges: false,
    });
  }, []);

  return {
    state,
    nextStep,
    prevStep,
    goToStep,
    updateStepData,
    updateStepValidity,
    setCalculatingPrice,
    reset,
  };
}
