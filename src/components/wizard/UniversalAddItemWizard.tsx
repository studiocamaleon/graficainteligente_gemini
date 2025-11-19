import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { UniversalProductSearchStep } from './steps/UniversalProductSearchStep';
import { ConfigurationStep, type SelectedConfiguration } from './steps/ConfigurationStep';
import { ServicesAndFinishingsStep, type SelectedService, type SelectedFinishing } from './steps/ServicesAndFinishingsStep';
import { UniversalSummaryStep } from './steps/UniversalSummaryStep';
import { useProductConfiguration } from '../../hooks/wizard/useProductConfiguration';
import { useUniversalPricing } from '../../hooks/wizard/useUniversalPricing';
import type { UniversalProductSearchResult } from '../../hooks/wizard/useUniversalProductSearch';

interface UniversalAddItemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAgregar: (itemData: any) => Promise<void>;
}

type WizardStep = 'search' | 'configuration' | 'services' | 'summary';

const stepTitles: Record<WizardStep, string> = {
  search: 'Buscar Producto',
  configuration: 'Configuración',
  services: 'Servicios y Acabados',
  summary: 'Resumen'
};

export function UniversalAddItemWizard({ isOpen, onClose, onAgregar }: UniversalAddItemWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<UniversalProductSearchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Configuración del producto
  const [selectedConfig, setSelectedConfig] = useState<SelectedConfiguration>({
    cantidad: 1,
    medida_ancho: null,
    medida_alto: null,
    material_id: null,
    material_nombre: null,
    variante_id: null,
    variante_nombre: null,
    espesor: null,
    tecnologia_id: null,
    tecnologia_nombre: null,
    tinta: null,
    tinta_nombre: null,
    cara_impresa: null,
    color: null,
    marca: null
  });

  const [selectedServicios, setSelectedServicios] = useState<SelectedService[]>([]);
  const [selectedAcabados, setSelectedAcabados] = useState<SelectedFinishing[]>([]);

  // Precio
  const [precioBase, setPrecioBase] = useState<number | null>(null);
  const [precioServicios, setPrecioServicios] = useState(0);
  const [precioAcabados, setPrecioAcabados] = useState(0);
  const [precioTotal, setPrecioTotal] = useState<number | null>(null);

  // Cargar configuración del producto
  const { config, isLoading: loadingConfig } = useProductConfiguration(
    selectedProduct?.id || null,
    selectedProduct?.categoria || null
  );

  // Hook de pricing
  const { calculatePrice, isCalculating } = useUniversalPricing();

  // Efecto para calcular precio cuando cambia la configuración
  useEffect(() => {
    if (!selectedProduct || !config) return;

    const shouldCalculate = isConfigurationComplete();

    if (shouldCalculate) {
      recalculatePrice();
    }
  }, [selectedProduct, config, selectedConfig, selectedServicios, selectedAcabados]);

  // Inicializar configuración cuando se carga el config
  useEffect(() => {
    if (!config) return;

    const newConfig: Partial<SelectedConfiguration> = {};

    // Cantidad mínima
    if (config.cantidad_minima) {
      newConfig.cantidad = config.cantidad_minima;
    }

    // Medida única
    if (config.medidas && config.medidas.length === 1) {
      newConfig.medida_ancho = config.medidas[0].ancho;
      newConfig.medida_alto = config.medidas[0].alto;
    }

    // Material único
    if (config.materiales && config.materiales.length === 1) {
      const mat = config.materiales[0];
      newConfig.material_id = mat.material_id;
      newConfig.material_nombre = mat.material_nombre;
      newConfig.variante_id = mat.variante_id;
      newConfig.variante_nombre = mat.variante_nombre;
      newConfig.espesor = mat.espesor || null;
    }

    // Tecnología única
    if (config.tecnologias && config.tecnologias.length === 1) {
      const tec = config.tecnologias[0];
      newConfig.tecnologia_id = tec.tecnologia_id;
      newConfig.tecnologia_nombre = tec.tecnologia_nombre;
    }

    // Color y marca
    if (config.color) newConfig.color = config.color;
    if (config.marca) newConfig.marca = config.marca;

    setSelectedConfig(prev => ({ ...prev, ...newConfig }));
  }, [config]);

  const isConfigurationComplete = (): boolean => {
    if (!config) return false;

    // Validar cantidad
    if (selectedConfig.cantidad < 1) return false;
    if (config.cantidad_minima && selectedConfig.cantidad < config.cantidad_minima) return false;

    // Validar medidas si es necesario
    if (config.medidas && config.medidas.length > 1) {
      if (!selectedConfig.medida_ancho || !selectedConfig.medida_alto) return false;
    }

    // Validar anchos disponibles (gran formato / plotter)
    if (config.anchos_disponibles && config.anchos_disponibles.length > 0) {
      if (!selectedConfig.medida_ancho) return false;
      if (config.tipo_medida === 'ancho_maximo' && !selectedConfig.medida_alto) return false;
    }

    // Validar material si es necesario
    if (config.materiales && config.materiales.length > 0) {
      if (!selectedConfig.material_id) return false;
    }

    // Validar tecnología si es necesario
    if (config.tecnologias && config.tecnologias.length > 0) {
      if (!selectedConfig.tecnologia_id) return false;

      // Validar tinta si la tecnología tiene tintas
      const tec = config.tecnologias.find(t => t.tecnologia_id === selectedConfig.tecnologia_id);
      if (tec && tec.tintas.length > 0 && !selectedConfig.tinta) return false;
    }

    // Validar caras si es necesario
    if (config.caras_impresas && config.caras_impresas.length > 0) {
      if (!selectedConfig.cara_impresa) return false;
    }

    return true;
  };

  const recalculatePrice = async () => {
    if (!selectedProduct || !config) return;

    const result = await calculatePrice(
      selectedProduct.id,
      selectedProduct.categoria,
      selectedConfig,
      selectedServicios,
      selectedAcabados
    );

    setPrecioBase(result.precio_base);
    setPrecioServicios(result.precio_servicios);
    setPrecioAcabados(result.precio_acabados);
    setPrecioTotal(result.precio_total);
  };

  const handleClose = () => {
    setCurrentStep('search');
    setSearchTerm('');
    setSelectedProduct(null);
    setSelectedConfig({
      cantidad: 1,
      medida_ancho: null,
      medida_alto: null,
      material_id: null,
      material_nombre: null,
      variante_id: null,
      variante_nombre: null,
      espesor: null,
      tecnologia_id: null,
      tecnologia_nombre: null,
      tinta: null,
      tinta_nombre: null,
      cara_impresa: null,
      color: null,
      marca: null
    });
    setSelectedServicios([]);
    setSelectedAcabados([]);
    setPrecioBase(null);
    setPrecioServicios(0);
    setPrecioAcabados(0);
    setPrecioTotal(null);
    onClose();
  };

  const handleSelectProduct = (product: UniversalProductSearchResult) => {
    setSelectedProduct(product);
    setCurrentStep('configuration');
  };

  const handleConfigChange = (changes: Partial<SelectedConfiguration>) => {
    setSelectedConfig(prev => ({ ...prev, ...changes }));
  };

  const canProceedToNext = (): boolean => {
    switch (currentStep) {
      case 'search':
        return selectedProduct !== null;
      case 'configuration':
        return isConfigurationComplete();
      case 'services':
        return true; // Los servicios son opcionales
      case 'summary':
        return precioTotal !== null;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceedToNext()) return;

    const steps: WizardStep[] = ['search', 'configuration', 'services', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const steps: WizardStep[] = ['search', 'configuration', 'services', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleAgregar = async () => {
    if (!selectedProduct || !config || precioTotal === null) return;

    setIsSubmitting(true);
    try {
      const itemData = {
        producto_id: selectedProduct.id,
        producto_nombre: selectedProduct.nombre,
        categoria: selectedProduct.categoria,
        categoria_id: selectedProduct.categoria_id,
        cantidad: selectedConfig.cantidad,
        configuracion: {
          categoria: selectedProduct.categoria,
          medida_ancho: selectedConfig.medida_ancho,
          medida_alto: selectedConfig.medida_alto,
          material_id: selectedConfig.material_id,
          material_nombre: selectedConfig.material_nombre,
          variante_id: selectedConfig.variante_id,
          variante_nombre: selectedConfig.variante_nombre,
          espesor: selectedConfig.espesor,
          tecnologia_id: selectedConfig.tecnologia_id,
          tecnologia_nombre: selectedConfig.tecnologia_nombre,
          tinta: selectedConfig.tinta,
          tinta_nombre: selectedConfig.tinta_nombre,
          cara_impresa: selectedConfig.cara_impresa,
          color: selectedConfig.color,
          marca: selectedConfig.marca,
          servicios: selectedServicios,
          acabados: selectedAcabados
        },
        precio_base: precioBase || 0,
        precio_servicios: precioServicios,
        precio_acabados: precioAcabados,
        precio_unitario_final: precioTotal,
        precio_total: precioTotal * selectedConfig.cantidad,
        impuesto_iva: config.impuesto_iva
      };

      await onAgregar(itemData);
      handleClose();
    } catch (error) {
      console.error('Error agregando item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderStepIndicator = () => {
    const steps: WizardStep[] = ['search', 'configuration', 'services', 'summary'];
    const currentIndex = steps.indexOf(currentStep);

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                index === currentIndex
                  ? 'bg-blue-600 text-white'
                  : index < currentIndex
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-1 ${
                  index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={stepTitles[currentStep]}
      size="xl"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {stepTitles[currentStep]}
              </h2>
              {selectedProduct && currentStep !== 'search' && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedProduct.nombre} - {selectedProduct.categoria}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {currentStep === 'search' && (
            <UniversalProductSearchStep
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSelectProduct={handleSelectProduct}
            />
          )}

          {currentStep === 'configuration' && config && (
            loadingConfig ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Cargando configuración...</span>
              </div>
            ) : (
              <ConfigurationStep
                config={config}
                selectedConfig={selectedConfig}
                onConfigChange={handleConfigChange}
              />
            )
          )}

          {currentStep === 'services' && config && (
            <ServicesAndFinishingsStep
              config={config}
              selectedServicios={selectedServicios}
              selectedAcabados={selectedAcabados}
              onServiciosChange={setSelectedServicios}
              onAcabadosChange={setSelectedAcabados}
            />
          )}

          {currentStep === 'summary' && config && (
            <UniversalSummaryStep
              config={config}
              selectedConfig={selectedConfig}
              selectedServicios={selectedServicios}
              selectedAcabados={selectedAcabados}
              precioBase={precioBase}
              precioServicios={precioServicios}
              precioAcabados={precioAcabados}
              precioTotal={precioTotal}
              isCalculatingPrice={isCalculating}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            {currentStep !== 'search' && (
              <Button
                variant="secondary"
                onClick={handlePrevious}
                disabled={isSubmitting}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>

            {currentStep !== 'summary' ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedToNext() || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Siguiente
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleAgregar}
                disabled={!canProceedToNext() || isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Agregando...' : 'Agregar a la Orden'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
