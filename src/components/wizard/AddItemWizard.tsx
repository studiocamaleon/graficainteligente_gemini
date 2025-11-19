import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { StepIndicator } from './StepIndicator';
import { WizardNavigation } from './WizardNavigation';
import { PriceSummaryPanel } from './PriceSummaryPanel';
import { ProductSearchStep } from './steps/ProductSearchStep';
import { QuantityStep } from './steps/QuantityStep';
import { SizeStep } from './steps/SizeStep';
import { PrintConfigStep } from './steps/PrintConfigStep';
import { ServicesStep } from './steps/ServicesStep';
import { FinishingsStep } from './steps/FinishingsStep';
import { SummaryStep } from './steps/SummaryStep';
import { useWizardState } from '../../hooks/wizard/useWizardState';
import { useWizardValidation } from '../../hooks/wizard/useWizardValidation';
import { useImpresionLaserPricing } from '../../hooks/wizard/useImpresionLaserPricing';
import { buildOrdenItemFromWizard } from '../../utils/wizard/buildOrdenItem';
import { validateItemConfiguration } from '../../utils/wizard/validateItemConfiguration';
import type { ProductSearchResult, MedidaDisponible, TintaDisponible } from '../../types/wizard';

interface AddItemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAgregar: (itemData: any) => Promise<void>;
}

export function AddItemWizard({ isOpen, onClose, onAgregar }: AddItemWizardProps) {
  const {
    state,
    nextStep,
    prevStep,
    goToStep,
    updateStepData,
    updateStepValidity,
    setCalculatingPrice,
    reset,
  } = useWizardState();

  const { calculatePrice } = useImpresionLaserPricing();
  const [medidasDisponibles, setMedidasDisponibles] = useState<MedidaDisponible[]>([]);
  const [tintasDisponibles, setTintasDisponibles] = useState<TintaDisponible[]>([]);

  const currentStepName = state.steps[state.currentStep]?.name;
  const validation = useWizardValidation(state.config, currentStepName);

  useEffect(() => {
    updateStepValidity(state.currentStep, validation.isValid);
  }, [validation.isValid, state.currentStep]);

  useEffect(() => {
    if (
      state.config.producto_laser_id &&
      state.config.medida_ancho &&
      state.config.medida_alto &&
      state.config.tinta_id &&
      state.config.cantidad &&
      state.config.cara_impresa
    ) {
      recalcularPrecio();
    }
  }, [
    state.config.producto_laser_id,
    state.config.medida_ancho,
    state.config.medida_alto,
    state.config.tinta_id,
    state.config.cantidad,
    state.config.cara_impresa,
    state.config.servicios_seleccionados,
    state.config.acabados_seleccionados,
  ]);

  const recalcularPrecio = async () => {
    if (
      !state.config.producto_laser_id ||
      !state.config.medida_ancho ||
      !state.config.medida_alto ||
      !state.config.tinta_id ||
      !state.config.cantidad ||
      !state.config.cara_impresa
    ) {
      return;
    }

    setCalculatingPrice(true);

    try {
      const result = await calculatePrice(
        {
          producto_laser_id: state.config.producto_laser_id,
          medida_ancho: state.config.medida_ancho,
          medida_alto: state.config.medida_alto,
          tinta_id: state.config.tinta_id,
          cantidad: state.config.cantidad,
          cara_impresa: state.config.cara_impresa,
        },
        state.config.servicios_seleccionados,
        state.config.acabados_seleccionados
      );

      updateStepData({
        precio_base: result.precio_base,
        precio_servicios: result.desglose.servicios,
        precio_acabados: result.desglose.acabados,
        precio_total: result.desglose.total,
        tiene_precio_configurado: result.tiene_configuracion,
      });
    } catch (error) {
      console.error('Error calculating price:', error);
    } finally {
      setCalculatingPrice(false);
    }
  };

  const handleProductSelect = (product: ProductSearchResult) => {
    setMedidasDisponibles(product.medidas_disponibles);
    setTintasDisponibles(product.tintas_disponibles);

    updateStepData({
      producto_id: product.producto_id,
      producto_laser_id: product.producto_laser_id,
      producto_nombre: product.nombre,
      categoria_nombre: product.categoria_nombre,
      tipo_venta: product.tipo_venta,
      cantidades_fijas: product.cantidades_fijas,
      cantidad_minima: product.cantidad_minima,
      material_nombre: product.material_nombre,
      variante_nombre: product.variante_nombre,
      caras_disponibles: product.caras_disponibles,
    });
  };

  const handleQuantitySelect = (cantidad: number) => {
    updateStepData({ cantidad });
  };

  const handleSizeSelect = (medida: any) => {
    updateStepData({
      medida_ancho: medida.ancho,
      medida_alto: medida.alto,
      medida_display: medida.display,
    });
  };

  const handleTintaSelect = (tintaId: string, tipo: 'CMYK' | 'K') => {
    updateStepData({
      tinta_id: tintaId,
      tipo_tinta: tipo,
      tinta_nombre: tipo === 'CMYK' ? 'Color' : 'Blanco y Negro',
    });
  };

  const handleCaraSelect = (cara: 'solo_frente' | 'frente_dorso') => {
    updateStepData({ cara_impresa: cara });
  };

  const handleToggleServicio = (servicioId: string) => {
    const isSelected = state.config.servicios_seleccionados.some(s => s.servicio_id === servicioId);

    if (isSelected) {
      const newServicios = state.config.servicios_seleccionados.filter(s => s.servicio_id !== servicioId);
      updateStepData({ servicios_seleccionados: newServicios });
    } else {
      const newServicios = [...state.config.servicios_seleccionados, {
        servicio_id: servicioId,
        servicio_nombre: '',
        nivel_id: null,
        nivel_nombre: null,
        tipo_impacto: 'porcentaje' as const,
        valor_porcentaje: null,
        valor_monto: null,
        impacto_calculado: 0,
      }];
      updateStepData({ servicios_seleccionados: newServicios });
    }
  };

  const handleSelectServicioNivel = async (servicioId: string, nivelId: string) => {
    const { data } = await supabase
      .from('servicios_niveles')
      .select('nombre, tipo_impacto, valor_porcentaje, valor_monto')
      .eq('id', nivelId)
      .maybeSingle();

    const { data: servicioData } = await supabase
      .from('servicios')
      .select('nombre')
      .eq('id', servicioId)
      .maybeSingle();

    if (data && servicioData) {
      let impacto = 0;
      if (state.config.precio_base) {
        if (data.tipo_impacto === 'porcentaje' && data.valor_porcentaje !== null) {
          impacto = state.config.precio_base * (data.valor_porcentaje / 100);
        } else if (data.tipo_impacto === 'monto_fijo' && data.valor_monto !== null) {
          impacto = data.valor_monto;
        } else if (data.tipo_impacto === 'ambos') {
          const impactoPorcentaje = data.valor_porcentaje !== null
            ? state.config.precio_base * (data.valor_porcentaje / 100)
            : 0;
          const impactoMonto = data.valor_monto || 0;
          impacto = impactoPorcentaje + impactoMonto;
        }
      }

      const newServicios = state.config.servicios_seleccionados.map(s =>
        s.servicio_id === servicioId
          ? {
              ...s,
              servicio_nombre: servicioData.nombre,
              nivel_id: nivelId,
              nivel_nombre: data.nombre,
              tipo_impacto: data.tipo_impacto,
              valor_porcentaje: data.valor_porcentaje,
              valor_monto: data.valor_monto,
              impacto_calculado: impacto,
            }
          : s
      );
      updateStepData({ servicios_seleccionados: newServicios });
    }
  };

  const handleToggleAcabado = (acabadoId: string) => {
    const isSelected = state.config.acabados_seleccionados.some(a => a.acabado_id === acabadoId);

    if (isSelected) {
      const newAcabados = state.config.acabados_seleccionados.filter(a => a.acabado_id !== acabadoId);
      updateStepData({ acabados_seleccionados: newAcabados });
    } else {
      const newAcabados = [...state.config.acabados_seleccionados, {
        acabado_id: acabadoId,
        acabado_nombre: '',
        nivel_id: null,
        nivel_nombre: null,
        tipo_impacto: 'porcentaje' as const,
        valor_porcentaje: null,
        valor_monto: null,
        impacto_calculado: 0,
      }];
      updateStepData({ acabados_seleccionados: newAcabados });
    }
  };

  const handleSelectAcabadoNivel = async (acabadoId: string, nivelId: string) => {
    const { data } = await supabase
      .from('acabados_niveles')
      .select('nombre, tipo_impacto, valor_porcentaje, valor_monto')
      .eq('id', nivelId)
      .maybeSingle();

    const { data: acabadoData } = await supabase
      .from('acabados')
      .select('nombre')
      .eq('id', acabadoId)
      .maybeSingle();

    if (data && acabadoData) {
      let impacto = 0;
      if (state.config.precio_base) {
        if (data.tipo_impacto === 'porcentaje' && data.valor_porcentaje !== null) {
          impacto = state.config.precio_base * (data.valor_porcentaje / 100);
        } else if (data.tipo_impacto === 'monto_fijo' && data.valor_monto !== null) {
          impacto = data.valor_monto;
        } else if (data.tipo_impacto === 'ambos') {
          const impactoPorcentaje = data.valor_porcentaje !== null
            ? state.config.precio_base * (data.valor_porcentaje / 100)
            : 0;
          const impactoMonto = data.valor_monto || 0;
          impacto = impactoPorcentaje + impactoMonto;
        }
      }

      const newAcabados = state.config.acabados_seleccionados.map(a =>
        a.acabado_id === acabadoId
          ? {
              ...a,
              acabado_nombre: acabadoData.nombre,
              nivel_id: nivelId,
              nivel_nombre: data.nombre,
              tipo_impacto: data.tipo_impacto,
              valor_porcentaje: data.valor_porcentaje,
              valor_monto: data.valor_monto,
              impacto_calculado: impacto,
            }
          : a
      );
      updateStepData({ acabados_seleccionados: newAcabados });
    }
  };

  const handleSubmit = async () => {
    const finalValidation = validateItemConfiguration(state.config);

    if (!finalValidation.isValid) {
      alert('La configuración no es válida:\n' + finalValidation.errors.join('\n'));
      return;
    }

    const itemData = buildOrdenItemFromWizard(state.config);

    if (!itemData) {
      alert('Error al construir el item');
      return;
    }

    try {
      await onAgregar(itemData);
      reset();
      onClose();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error al agregar el item');
    }
  };

  const handleClose = () => {
    if (state.hasChanges) {
      if (window.confirm('¿Está seguro que desea cancelar? Se perderán los cambios.')) {
        reset();
        onClose();
      }
    } else {
      reset();
      onClose();
    }
  };

  const renderStep = () => {
    switch (currentStepName) {
      case 'product_search':
        return (
          <ProductSearchStep
            onSelect={handleProductSelect}
            selectedProductId={state.config.producto_id}
          />
        );
      case 'quantity':
        return (
          <QuantityStep
            tipoVenta={state.config.tipo_venta}
            cantidadesFijas={state.config.cantidades_fijas}
            cantidadMinima={state.config.cantidad_minima}
            cantidadSeleccionada={state.config.cantidad}
            onSelect={handleQuantitySelect}
          />
        );
      case 'size':
        return (
          <SizeStep
            medidasDisponibles={medidasDisponibles}
            medidaSeleccionada={
              state.config.medida_ancho && state.config.medida_alto
                ? { ancho: state.config.medida_ancho, alto: state.config.medida_alto }
                : null
            }
            onSelect={handleSizeSelect}
          />
        );
      case 'print_config':
        return (
          <PrintConfigStep
            tintasDisponibles={tintasDisponibles}
            carasDisponibles={state.config.caras_disponibles}
            tintaSeleccionada={state.config.tinta_id}
            caraSeleccionada={state.config.cara_impresa}
            onSelectTinta={handleTintaSelect}
            onSelectCara={handleCaraSelect}
          />
        );
      case 'services':
        return (
          <ServicesStep
            categoriaNombre={state.config.categoria_nombre || 'Impresión Laser'}
            serviciosSeleccionados={state.config.servicios_seleccionados.map(s => ({
              servicio_id: s.servicio_id,
              nivel_id: s.nivel_id,
            }))}
            onToggleServicio={handleToggleServicio}
            onSelectNivel={handleSelectServicioNivel}
            precioBase={state.config.precio_base}
          />
        );
      case 'finishings':
        return (
          <FinishingsStep
            categoriaNombre={state.config.categoria_nombre || 'Impresión Laser'}
            acabadosSeleccionados={state.config.acabados_seleccionados.map(a => ({
              acabado_id: a.acabado_id,
              nivel_id: a.nivel_id,
            }))}
            onToggleAcabado={handleToggleAcabado}
            onSelectNivel={handleSelectAcabadoNivel}
            precioBase={state.config.precio_base}
          />
        );
      case 'summary':
        return <SummaryStep config={state.config} />;
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" title="Agregar Item a la Orden">
      <div className="space-y-6">
        <StepIndicator
          steps={state.steps}
          currentStep={state.currentStep}
          onStepClick={goToStep}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderStep()}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <PriceSummaryPanel
                precioBase={state.config.precio_base}
                precioServicios={state.config.precio_servicios}
                precioAcabados={state.config.precio_acabados}
                precioTotal={state.config.precio_total}
                tienePrecioConfigurado={state.config.tiene_precio_configurado}
                isCalculating={state.isCalculatingPrice}
                cantidad={state.config.cantidad}
              />
            </div>
          </div>
        </div>

        <WizardNavigation
          currentStep={state.currentStep}
          totalSteps={state.steps.length}
          canGoBack={state.currentStep > 0}
          canGoNext={state.steps[state.currentStep]?.isValid || false}
          isLastStep={state.currentStep === state.steps.length - 1}
          isCalculating={state.isCalculatingPrice}
          hasChanges={state.hasChanges}
          onPrev={prevStep}
          onNext={nextStep}
          onCancel={handleClose}
          onSubmit={handleSubmit}
        />
      </div>
    </Modal>
  );
}
