import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { X, ChevronRight, ChevronLeft, Loader } from 'lucide-react';
import { UniversalProductSearchStep } from './steps/UniversalProductSearchStep';
import { ConfigurationStep, type SelectedConfiguration } from './steps/ConfigurationStep';
import { ServicesAndFinishingsStep, type SelectedService, type SelectedFinishing } from './steps/ServicesAndFinishingsStep';
import { UniversalSummaryStep } from './steps/UniversalSummaryStep';
import { useProductConfiguration } from '../../hooks/wizard/useProductConfiguration';
import { useUniversalPricing } from '../../hooks/wizard/useUniversalPricing';
import type { UniversalProductSearchResult } from '../../hooks/wizard/useUniversalProductSearch';
import { generateProductionRoutes } from '../../utils/generateProductionRoutes';

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
    lineas_medidas: [],
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
    tipo_copia: null,
    color: null,
    marca: null,
    usa_material_catalogo: false
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
    console.log('[UniversalWizard] === Validando configuración completa ===');
    console.log('[UniversalWizard] selectedConfig:', selectedConfig);
    console.log('[UniversalWizard] config:', config);

    if (!config) {
      console.log('[UniversalWizard] ❌ No hay config');
      return false;
    }

    // Si permite m\u00faltiples l\u00edneas, validar l\u00edneas
    if (config.permite_multiples_lineas) {
      // Debe haber al menos una l\u00ednea
      if (!selectedConfig.lineas_medidas || selectedConfig.lineas_medidas.length === 0) {
        return false;
      }

      // Validar cada l\u00ednea
      for (const linea of selectedConfig.lineas_medidas) {
        // Validar medidas seg\u00fan tipo
        if (config.tipo_venta_real === 'mt2') {
          if (!linea.ancho || linea.ancho <= 0 || !linea.alto || linea.alto <= 0) {
            return false;
          }

          // NOTA: NO validamos cantidad_minima aquí
          // La cantidad mínima se aplica al TOTAL ACUMULADO en el pricing, no a cada línea
          // Esto permite ingresar líneas con medidas reales menores al mínimo
        } else if (config.tipo_venta_real === 'mt_lineal') {
          if (!linea.ancho_seleccionado || !linea.metros_lineales || linea.metros_lineales <= 0) {
            return false;
          }
          // NOTA: NO validamos cantidad_minima aquí
          // La cantidad mínima se aplica al TOTAL ACUMULADO en el pricing, no a cada línea
          // Esto permite ingresar líneas con medidas reales menores al mínimo
        }

        // Validar cantidad de unidades
        if (!linea.cantidad || linea.cantidad <= 0) {
          return false;
        }
      }

      // Validar material si es necesario y no se auto-selecciona
      const shouldValidateMaterial = config.materiales && config.materiales.length > 1;
      if (shouldValidateMaterial && !selectedConfig.material_id) {
        return false;
      }

      // Validar tecnolog\u00eda si es necesario
      if (config.tecnologias && config.tecnologias.length > 0) {
        if (!selectedConfig.tecnologia_id) return false;

        // Validar tinta si la tecnolog\u00eda tiene tintas
        const tec = config.tecnologias.find(t => t.tecnologia_id === selectedConfig.tecnologia_id);
        if (tec && tec.tintas.length > 0 && !selectedConfig.tinta) return false;
      }

      return true;
    }

    // L\u00f3gica tradicional para productos sin m\u00faltiples l\u00edneas
    // Validar cantidad
    if (selectedConfig.cantidad < 1) {
      console.log('[UniversalWizard] ❌ Cantidad menor a 1:', selectedConfig.cantidad);
      return false;
    }
    if (config.cantidad_minima && selectedConfig.cantidad < config.cantidad_minima) {
      console.log('[UniversalWizard] ❌ Cantidad menor al mínimo:', selectedConfig.cantidad, '<', config.cantidad_minima);
      return false;
    }

    // Validar medidas si es necesario
    if (config.medidas && config.medidas.length > 1) {
      if (!selectedConfig.medida_ancho || !selectedConfig.medida_alto) {
        console.log('[UniversalWizard] ❌ Falta medida (múltiples opciones):', { ancho: selectedConfig.medida_ancho, alto: selectedConfig.medida_alto });
        return false;
      }
    }

    // Validar anchos disponibles (gran formato / plotter)
    if (config.anchos_disponibles && config.anchos_disponibles.length > 0) {
      if (!selectedConfig.medida_ancho) return false;
      if (config.tipo_medida === 'ancho_maximo' && !selectedConfig.medida_alto) return false;
    }

    // Validar material si es necesario
    if (config.materiales && config.materiales.length > 0) {
      // Para UV, validar según el tipo de material elegido
      if (config.categoria === 'Impresión UV sobre Rígidos') {
        // Si permite material del cliente, debe haber elegido una opción
        if (config.permite_material_cliente && selectedConfig.usa_material_catalogo === undefined) {
          console.log('[UniversalWizard] ❌ UV: No ha elegido tipo de material');
          return false;
        }
        // Si eligió material de catálogo, debe seleccionar uno
        if (selectedConfig.usa_material_catalogo === true && !selectedConfig.material_id) {
          console.log('[UniversalWizard] ❌ UV: Eligió catálogo pero no hay material_id');
          return false;
        }
        // Si eligió material del cliente, no necesita seleccionar material_id
      } else {
        // Para otros productos, validar material normalmente
        if (!selectedConfig.material_id) {
          console.log('[UniversalWizard] ❌ Falta material_id. Materiales disponibles:', config.materiales.length);
          return false;
        }
      }
    }

    // Validar tecnología si es necesario
    if (config.tecnologias && config.tecnologias.length > 0) {
      if (!selectedConfig.tecnologia_id) {
        console.log('[UniversalWizard] ❌ Falta tecnologia_id. Tecnologías disponibles:', config.tecnologias.length);
        return false;
      }

      // Validar tinta si la tecnología tiene tintas
      const tec = config.tecnologias.find(t => t.tecnologia_id === selectedConfig.tecnologia_id);
      if (tec && tec.tintas.length > 0 && !selectedConfig.tinta) {
        console.log('[UniversalWizard] ❌ Falta tinta. Tintas disponibles para tecnología:', tec.tintas);
        console.log('[UniversalWizard] ❌ selectedConfig.tinta actual:', selectedConfig.tinta);
        return false;
      }
      console.log('[UniversalWizard] ✅ Tecnología y tinta OK:', { tecnologia_id: selectedConfig.tecnologia_id, tinta: selectedConfig.tinta });
    }

    // Validar caras si es necesario
    if (config.caras_impresas && config.caras_impresas.length > 0) {
      if (!selectedConfig.cara_impresa) {
        console.log('[UniversalWizard] ❌ Falta cara_impresa. Opciones disponibles:', config.caras_impresas);
        return false;
      }
      console.log('[UniversalWizard] ✅ Cara impresa OK:', selectedConfig.cara_impresa);
    }

    // Validar tipo_copia si es necesario (para talonarios)
    if (config.tipo_copia && config.tipo_copia.length > 0) {
      if (!selectedConfig.tipo_copia) {
        console.log('[UniversalWizard] ❌ Falta tipo_copia. Opciones disponibles:', config.tipo_copia);
        return false;
      }
    }

    console.log('[UniversalWizard] ✅ ¡Todas las validaciones pasaron!');
    return true;
  };

  const recalculatePrice = async () => {
    if (!selectedProduct || !config) return;

    const result = await calculatePrice(
      selectedProduct.id,
      selectedProduct.categoria,
      selectedConfig,
      selectedServicios,
      selectedAcabados,
      config.cantidades_fijas
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
      lineas_medidas: [],
      cantidad: 1,
      medida_ancho: null,
      medida_alto: null,
      material_id: null,
      material_nombre: null,
      variante_id: null,
      variante_nombre: null,
      espesor: null,
      unidad_espesor: null,
      gramaje: null,
      tecnologia_id: null,
      tecnologia_nombre: null,
      tinta: null,
      tinta_nombre: null,
      cara_impresa: null,
      tipo_copia: null,
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
    console.log('[UniversalWizard] handleConfigChange recibido:', changes);
    setSelectedConfig(prev => {
      const newConfig = { ...prev, ...changes };
      console.log('[UniversalWizard] selectedConfig actualizado:', newConfig);
      return newConfig;
    });
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
        // Para productos con múltiples líneas, verificar que todas tengan precio
        if (config?.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0) {
          return selectedConfig.lineas_medidas.every(line =>
            line.precio_total_linea !== undefined && line.precio_total_linea !== null
          );
        }
        // Para productos sin múltiples líneas, verificar precioTotal
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
      let nextStep = steps[currentIndex + 1];

      // Si el siguiente paso es 'services' y el producto permite múltiples líneas, saltarlo
      if (nextStep === 'services' && config?.permite_multiples_lineas) {
        nextStep = 'summary';
      }

      setCurrentStep(nextStep);
    }
  };

  const handlePrevious = () => {
    const steps: WizardStep[] = ['search', 'configuration', 'services', 'summary'];
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex > 0) {
      let prevStep = steps[currentIndex - 1];

      // Si el paso anterior es 'services' y el producto permite múltiples líneas, saltarlo
      if (prevStep === 'services' && config?.permite_multiples_lineas) {
        prevStep = 'configuration';
      }

      setCurrentStep(prevStep);
    }
  };

  const handleAgregar = async () => {
    if (!selectedProduct || !config) return;

    setIsSubmitting(true);
    try {
      // Si el producto permite m\u00faltiples l\u00edneas, crear un item por cada l\u00ednea
      if (config.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0) {
        for (const linea of selectedConfig.lineas_medidas) {
          // Usar servicios directamente de la línea
          const serviciosLinea = (linea.servicios || []).map(s => ({
            servicio_id: s.servicio_id,
            nombre: s.servicio_nombre,
            nivel: s.nivel_nombre,
          }));

          // Usar acabados directamente de la línea
          const acabadosLinea = (linea.acabados || []).map(a => ({
            acabado_id: a.acabado_id,
            nombre: a.acabado_nombre,
            nivel: a.nivel_nombre,
          }));

          // Construir configuraci\u00f3n JSONB para esta l\u00ednea
          const configuracionLinea = {
            categoria: selectedProduct.categoria,
            medida_ancho: linea.ancho || linea.ancho_seleccionado || null,
            medida_alto: linea.alto || null,
            mt2_total: linea.mt2_calculado,
            mt_lineal_total: linea.metros_lineales,
            material_id: selectedConfig.material_id,
            material_nombre: selectedConfig.material_nombre,
            variante_id: selectedConfig.variante_id,
            variante_nombre: selectedConfig.variante_nombre,
            espesor: selectedConfig.espesor,
            unidad_espesor: selectedConfig.unidad_espesor,
            gramaje: selectedConfig.gramaje,
            tecnologia_id: selectedConfig.tecnologia_id,
            tecnologia_nombre: selectedConfig.tecnologia_nombre,
            tinta: selectedConfig.tinta,
            tinta_nombre: selectedConfig.tinta_nombre,
            cara_impresa: selectedConfig.cara_impresa,
            color: selectedConfig.color,
            marca: selectedConfig.marca,
            servicios_seleccionados: serviciosLinea,
            acabados_seleccionados: acabadosLinea
          };

          // Generar rutas de producci\u00f3n para esta l\u00ednea
          const rutasGeneradas = await generateProductionRoutes({
            productoId: selectedProduct.id,
            categoria: selectedProduct.categoria,
            configuracion: configuracionLinea,
          });

          const itemData = {
            producto_id: selectedProduct.id,
            producto_nombre: selectedProduct.nombre,
            categoria: selectedProduct.categoria,
            categoria_id: selectedProduct.categoria_id,
            cantidad: linea.cantidad,
            configuracion: configuracionLinea,
            precio_base: linea.precio_base_unitario || 0,
            precio_servicios: linea.precio_servicios_unitario || 0,
            precio_acabados: linea.precio_acabados_unitario || 0,
            precio_unitario_final: linea.precio_unitario_final || 0,
            precio_total: linea.precio_total_linea || 0,
            impuesto_iva: config.impuesto_iva,
            rutas_generadas: rutasGeneradas
          };

          await onAgregar(itemData);
        }
      } else {
        // L\u00f3gica tradicional para productos sin m\u00faltiples l\u00edneas
        if (precioTotal === null) return;

        const configuracionItem = {
          categoria: selectedProduct.categoria,
          medida_ancho: selectedConfig.medida_ancho,
          medida_alto: selectedConfig.medida_alto,
          material_id: selectedConfig.material_id,
          material_nombre: selectedConfig.material_nombre,
          variante_id: selectedConfig.variante_id,
          variante_nombre: selectedConfig.variante_nombre,
          espesor: selectedConfig.espesor,
          unidad_espesor: selectedConfig.unidad_espesor,
          gramaje: selectedConfig.gramaje,
          tecnologia_id: selectedConfig.tecnologia_id,
          tecnologia_nombre: selectedConfig.tecnologia_nombre,
          tinta: selectedConfig.tinta,
          tinta_nombre: selectedConfig.tinta_nombre,
          cara_impresa: selectedConfig.cara_impresa,
          color: selectedConfig.color,
          marca: selectedConfig.marca,
          usa_material_catalogo: selectedConfig.usa_material_catalogo,
          servicios_seleccionados: selectedServicios.map(s => ({
            servicio_id: s.servicio_id,
            nombre: s.servicio_nombre,
            nivel: s.nivel_nombre,
          })),
          acabados_seleccionados: selectedAcabados.map(a => ({
            acabado_id: a.acabado_id,
            nombre: a.acabado_nombre,
            nivel: a.nivel_nombre,
          }))
        };

        // Generar rutas de producci\u00f3n para este item
        const rutasGeneradas = await generateProductionRoutes({
          productoId: selectedProduct.id,
          categoria: selectedProduct.categoria,
          configuracion: configuracionItem,
        });

        const itemData = {
          producto_id: selectedProduct.id,
          producto_nombre: selectedProduct.nombre,
          categoria: selectedProduct.categoria,
          categoria_id: selectedProduct.categoria_id,
          cantidad: selectedConfig.cantidad,
          configuracion: configuracionItem,
          precio_base: precioBase || 0,
          precio_servicios: precioServicios,
          precio_acabados: precioAcabados,
          precio_unitario_final: precioTotal,
          precio_total: precioTotal * selectedConfig.cantidad,
          impuesto_iva: config.impuesto_iva,
          rutas_generadas: rutasGeneradas
        };

        await onAgregar(itemData);
      }

      handleClose();
    } catch (error) {
      console.error('Error agregando item(s):', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getActiveSteps = (): WizardStep[] => {
    // Para productos con múltiples líneas, omitir el paso de servicios
    if (config?.permite_multiples_lineas) {
      return ['search', 'configuration', 'summary'];
    }
    return ['search', 'configuration', 'services', 'summary'];
  };

  const renderStepIndicator = () => {
    const steps = getActiveSteps();
    const currentIndex = steps.indexOf(currentStep);

    return (
      <div className="mb-6">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-3">
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
        {/* Step title */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {stepTitles[currentStep]}
          </h3>
          {selectedProduct && currentStep !== 'search' && (
            <p className="text-sm text-gray-600 mt-1">
              {selectedProduct.nombre} · {selectedProduct.categoria}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Agregar Producto"
      size="xl"
    >
      <div className="flex flex-col h-full">
        {/* Step Indicator */}
        <div className="mb-6">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 'search' && (
            <UniversalProductSearchStep
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSelectProduct={handleSelectProduct}
            />
          )}

          {currentStep === 'configuration' && (
            loadingConfig ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader className="w-12 h-12 animate-spin text-blue-600" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Cargando configuración del producto</p>
                  <p className="text-sm text-gray-500 mt-1">Preparando opciones disponibles...</p>
                </div>
              </div>
            ) : config ? (
              <ConfigurationStep
                config={config}
                selectedConfig={selectedConfig}
                selectedServicios={selectedServicios}
                selectedAcabados={selectedAcabados}
                onConfigChange={handleConfigChange}
              />
            ) : null
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
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between mt-6">
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
