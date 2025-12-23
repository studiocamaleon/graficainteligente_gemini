import { useState, useEffect, type ReactNode } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { UniversalProductSearchStep } from './steps/UniversalProductSearchStep';
import { ConfigurationStep, type SelectedConfiguration } from './steps/ConfigurationStep';
import { CentroCopiadoStep } from './steps/CentroCopiadoStep';
import { ItemCopiadoConfig } from '../centro-copiado/CentroCopiadoItemForm';
import { ServicesAndFinishingsStep, type SelectedService, type SelectedFinishing } from './steps/ServicesAndFinishingsStep';
import { UniversalSummaryStep } from './steps/UniversalSummaryStep';
import { SummaryPricingSidebar } from './steps/SummaryPricingSidebar';
import { useProductConfiguration } from '../../hooks/wizard/useProductConfiguration';
import { useUniversalPricing, calcularImpacto } from '../../hooks/wizard/useUniversalPricing';
import type { UniversalProductSearchResult, ProductCategory } from '../../hooks/wizard/useUniversalProductSearch';
import { generateProductionRoutes } from '../../utils/generateProductionRoutes';

interface UniversalAddItemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAgregar: (itemData: any) => Promise<void>;
  initialData?: any;
  isEditing?: boolean;
  parentQuantity?: number;
}

type WizardStep = 'search' | 'configuration' | 'services' | 'summary';

const stepTitles: Record<WizardStep, string> = {
  search: 'Buscar Producto',
  configuration: 'Configuración',
  services: 'Acabados',
  summary: 'Resumen'
};

export function UniversalAddItemWizard({
  isOpen,
  onClose,
  onAgregar,
  initialData,
  isEditing = false,
  parentQuantity = 1
}: UniversalAddItemWizardProps) {
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

  // [NEW] Centro de Copiado State
  const [centroCopiadoConfig, setCentroCopiadoConfig] = useState<Partial<ItemCopiadoConfig>>({
    cantidad_copias: 1,
    cantidad_hojas: 1,
    tipo_tinta: 'CMYK',
    cara_impresa: 'frente'
  });
  const [centroCopiadoPrice, setCentroCopiadoPrice] = useState<number>(0);

  // Precio

  // Precio
  const [precioBase, setPrecioBase] = useState<number | null>(null);
  const [precioServicios, setPrecioServicios] = useState(0);
  const [precioAcabados, setPrecioAcabados] = useState(0);
  const [precioTotal, setPrecioTotal] = useState<number | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('search');
      setSearchTerm('');
      setSelectedProduct(null);
      setIsSubmitting(false);

      // Reset standard config
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
      setSelectedServicios([]);
      setSelectedAcabados([]);

      // Reset Copy Center config
      setCentroCopiadoConfig({
        cantidad_copias: 1,
        cantidad_hojas: 1,
        tipo_tinta: 'CMYK',
        cara_impresa: 'frente'
      });
      setCentroCopiadoPrice(0);

      // Reset side panel
      closeSidePanel();
    }
  }, [isOpen]);

  /* Removed Debug State */

  // Cargar configuración del producto
  console.log('[UniversalWizard Debug] Calling useProductConfiguration with:', {
    id: selectedProduct?.id || null,
    cat: selectedProduct?.categoria || null
  });
  const { config, isLoading: loadingConfig } = useProductConfiguration(
    selectedProduct?.id || null,
    selectedProduct?.categoria || null,
    selectedProduct?.es_compuesto || false
  );

  // Hook de pricing
  const { calculatePrice, isCalculating } = useUniversalPricing();

  // Efecto para calcular precio cuando cambia la configuración
  // Efecto para calcular precio cuando cambia la configuración
  // [FIX] Usar dependencias específicas para evitar bucles infinitos cuando se actualizan precios en lineas_medidas
  const pricingDependencies = JSON.stringify({
    productId: selectedProduct?.id,
    configParams: {
      cantidad: selectedConfig.cantidad,
      ancho: selectedConfig.medida_ancho,
      alto: selectedConfig.medida_alto,
      material: selectedConfig.material_id,
      espesor: selectedConfig.espesor,
      tecnologia: selectedConfig.tecnologia_id,
      tinta: selectedConfig.tinta,
      cara: selectedConfig.cara_impresa,
      copia: selectedConfig.tipo_copia,
      variante: selectedConfig.variante_id,
      componentes: selectedConfig.componentes?.map(c => ({ id: c.referencia_id, qty: c.cantidad, config: c.config })),
      // Para líneas, solo nos importa cantidades y medidas, NO precios ni resultados calculados
      lineas: selectedConfig.lineas_medidas?.map(l => ({
        id: l.id,
        cantidad: l.cantidad,
        ancho: l.ancho,
        alto: l.alto,
        ml: l.metros_lineales,
        mt2: l.mt2_calculado,
        // Importante: No incluir precios aquí
      }))
    },
    servicios: selectedServicios.map(s => ({ id: s.servicio_id, qty: s.cantidad })),
    acabados: selectedAcabados.map(a => ({ id: a.acabado_id, qty: a.cantidad, nivel: a.nivel_id }))
  });

  useEffect(() => {
    if (!selectedProduct || !config) return;

    const shouldCalculate = isConfigurationComplete();

    if (shouldCalculate) {
      recalculatePrice();
    }
  }, [pricingDependencies, config]); // Usar la string de dependencias en lugar del objeto completo

  // Inicializar configuración cuando se carga el config
  useEffect(() => {
    if (!config || isEditing) return;

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

    // Productos compuestos
    if (config.es_compuesto) {
      console.log('[UniversalWizard] Initializing composite data:', config.componentes?.length);
      newConfig.es_compuesto = true;
      newConfig.componentes = config.componentes;
      newConfig.ruta_produccion_id = config.ruta_produccion_id;
    }

    setSelectedConfig(prev => {
      const next = { ...prev, ...newConfig };
      console.log('[UniversalWizard] New selectedConfig:', next);
      return next;
    });
  }, [config]);

  // Hydrate from initialData for Editing
  useEffect(() => {
    console.log('[UniversalWizard] Checking hydration. isOpen:', isOpen, 'isEditing:', isEditing, 'initialData:', !!initialData);

    if (isOpen && initialData) {
      console.log('[UniversalWizard] Hydrating START. Product ID:', initialData.producto_id);

      // Force step to configuration when editing
      if (isEditing) {
        setCurrentStep('configuration');
      }

      // Check for Copy Center via categoria_id OR tipo_item
      const isCopyCenter = initialData.categoria_id === 'centro_copiado' || initialData.tipo_item === 'centro_copiado';

      const product = {
        id: initialData.producto_id || (isCopyCenter ? 'centro_copiado_module' : null),
        nombre: initialData.producto_nombre,
        categoria: initialData.categoria || initialData.producto_categoria,
        categoria_id: initialData.categoria_id || (isCopyCenter ? 'centro_copiado' : null),
        es_compuesto: !!(initialData.configuracion?.es_compuesto),
        ruta_produccion_id: initialData.configuracion?.ruta_produccion_id || null
      } as unknown as UniversalProductSearchResult;
      console.log('[UniversalWizard] Setting selectedProduct:', product);
      setSelectedProduct(product);
    }
  }, [initialData, isOpen, isEditing]); // Removed selectedProduct from dependency to avoid loop, logic handles it

  // Apply initialData configuration once config is loaded
  useEffect(() => {
    if (initialData && config && isOpen) {
      console.log('[UniversalWizard] Applying initial config vs loaded config');
      const savedConfig = initialData.configuracion;
      console.log('[UniversalWizard] Saved Config Keys:', Object.keys(savedConfig));

      // Map saved config back to SelectedConfiguration state
      const restoredConfig: SelectedConfiguration = {
        lineas_medidas: savedConfig.lineas_medidas || [],
        cantidad: initialData.cantidad || 1,
        medida_ancho: savedConfig.medida_ancho || savedConfig.ancho || null,
        medida_alto: savedConfig.medida_alto || savedConfig.alto || null,
        medida_mt2: savedConfig.medida_mt2 || null,
        material_id: savedConfig.material_id || null,
        material_nombre: savedConfig.material_nombre || null,
        variante_id: savedConfig.variante_id || null,
        variante_nombre: savedConfig.variante_nombre || null,
        espesor: savedConfig.espesor || null,
        unidad_espesor: savedConfig.unidad_espesor || null,
        gramaje: savedConfig.gramaje || null,
        tecnologia_id: savedConfig.tecnologia_id || null,
        tecnologia_nombre: savedConfig.tecnologia_nombre || null,
        tinta: savedConfig.tinta || null,
        tinta_nombre: savedConfig.tinta_nombre || null,
        cara_impresa: savedConfig.cara_impresa || null,
        tipo_copia: savedConfig.tipo_copia || null,
        color: savedConfig.color || null,
        marca: savedConfig.marca || null,
        usa_material_catalogo: savedConfig.usa_material_catalogo ?? false,
        es_compuesto: !!savedConfig.es_compuesto,
        componentes: (savedConfig.componentes || []).map((c: any) => ({
          ...c,
          configuracion: c.configuracion || c.config // Normalización crítica aquí
        })),
        ruta_produccion_id: savedConfig.ruta_produccion_id || null
      };

      console.log('[UniversalWizard] Restored base config (Partial):', restoredConfig);

      // DIAGNOSTICS
      if (config.categoria === 'Centro de Copiado') {
        console.log('[UniversalWizard] Hydrating Centro Copiado Config');
        // Restore Centro Copiado specific state
        setCentroCopiadoConfig(savedConfig as unknown as ItemCopiadoConfig);
        // Ensure price is restored if available (though component might recalculate it)
        if (initialData.precio_total) {
          setCentroCopiadoPrice(initialData.precio_total);
        }
      } else {
        // Standard Hydration Logic
        if (config.tecnologias) {
          const foundTec = config.tecnologias.find(t => t.tecnologia_id === restoredConfig.tecnologia_id);
          console.log('[UniversalWizard] Technologies available:', config.tecnologias);
          console.log('[UniversalWizard] Resotred Tec ID:', restoredConfig.tecnologia_id);
          console.log('[UniversalWizard] Found in config?', !!foundTec);
        }
      }
      if (restoredConfig.tecnologia_id && config.tecnologias && !config.tecnologias.some(t => t.tecnologia_id === restoredConfig.tecnologia_id)) {
        console.warn('[UniversalWizard] WARNING: Restored tecnologia_id not found in current config options!');
        // Maybe it's because the ID in config.tecnologias is 'id' or 'tecnologia_id'?
        // Interface says: { id: string, tecnologia_id: string, ... }
        // savedConfig.tecnologia_id should match t.tecnologia_id.
      }

      // Handle Services and Finishings for lines
      const itemServicios = savedConfig.servicios_seleccionados ? savedConfig.servicios_seleccionados.map((s: any) => ({
        servicio_id: s.servicio_id,
        servicio_nombre: s.nombre || s.servicio_nombre,
        nivel_id: s.nivel_id || null,
        nivel_nombre: s.nivel || s.nivel_nombre,
        tipo_impacto: 'precio_fijo', // Safe default
        valor_porcentaje: 0,
        valor_monto: 0,
        cantidad: s.cantidad || 1
      })) : [];

      const itemAcabados = savedConfig.acabados_seleccionados ? savedConfig.acabados_seleccionados.map((a: any) => ({
        acabado_id: a.acabado_id,
        acabado_nombre: a.nombre || a.acabado_nombre,
        nivel_id: a.nivel_id || null,
        nivel_nombre: a.nivel || a.nivel_nombre,
        tipo_impacto: 'precio_fijo',
        valor_porcentaje: 0,
        valor_monto: 0,
        cantidad: a.cantidad || 1
      })) : [];

      // Special handling for Multi-line products that were saved as single items
      if (config.permite_multiples_lineas) {
        console.log('[UniversalWizard] Product allows multi-lines. Checking lineas_medidas...');
        if (!restoredConfig.lineas_medidas || restoredConfig.lineas_medidas.length === 0) {
          console.log('[UniversalWizard] No lines found (probably single item edit). constructing line from config.');
          // Construct a line from the top-level dimenions
          if (restoredConfig.medida_ancho) {
            restoredConfig.lineas_medidas = [{
              id: `line - ${Date.now()} `,
              ancho: restoredConfig.medida_ancho,
              alto: restoredConfig.medida_alto || 0,
              ancho_seleccionado: restoredConfig.medida_ancho,
              metros_lineales: restoredConfig.medida_alto || undefined, // For PL/GF
              mt2_calculado: restoredConfig.medida_mt2 || savedConfig.mt2_total || 0,
              cantidad: initialData.cantidad || 1,

              // IMPORTANT: Map finishings to the line so the table can show/edit them
              acabados: itemAcabados,

              // Pricing (optional for hydration but good for table)
              precio_unitario_final: initialData.precio_unitario_final,
              precio_total_linea: initialData.precio_total,
            }];
          }
        }
      }

      /* Removed debug storage */

      setSelectedConfig(prev => {
        const next = { ...prev, ...restoredConfig };
        console.log('[UniversalWizard] Setting final selectedConfig:', next);
        return next;
      });

      // Restore global Services/Finishings state (for the Services Step)
      // Note: For multi-line, services are usually per-line, but we also track them globally for the wizard state?
      // The wizard seems to store them in 'selectedServicios' state separately.
      if (itemServicios.length > 0) setSelectedServicios(itemServicios);
      if (itemAcabados.length > 0) setSelectedAcabados(itemAcabados);
    }
  }, [config, initialData, isOpen]);

  // Estado para el panel lateral integrado (AddLineForm)
  const [sidePanelContent, setSidePanelContent] = useState<ReactNode>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  const openSidePanel = (content: ReactNode) => {
    setSidePanelContent(content);
    setIsSidePanelOpen(true);
  };

  const closeSidePanel = () => {
    setIsSidePanelOpen(false);
    setTimeout(() => setSidePanelContent(null), 300); // Dar tiempo a la animación
  };

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
      if (config.categoria === 'Impresión UV sobre Rígidos' as ProductCategory) {
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
      { ...selectedConfig, tipo_venta_real: config.tipo_venta_real },
      selectedServicios,
      selectedAcabados,
      config.cantidades_fijas,
      selectedProduct.es_compuesto,
      parentQuantity
    );

    setPrecioBase(result.precio_base);
    setPrecioServicios(result.precio_servicios);
    setPrecioAcabados(result.precio_acabados);
    setPrecioTotal(result.precio_total);

    // Si es un producto compuesto, actualizar los componentes con sus precios calculados
    if (result.componentes_actualizados) {
      console.log('[UniversalWizard] Updating components with calculated prices:', result.componentes_actualizados.length);

      // [FIX] Evitar bucle infinito: Primero comparamos si realmente cambiaron los precios
      const currentJson = JSON.stringify(selectedConfig.componentes || []);
      const nextJson = JSON.stringify(result.componentes_actualizados);

      if (currentJson !== nextJson) {
        setSelectedConfig(prev => ({
          ...prev,
          componentes: result.componentes_actualizados
        }));
      }
    }

    // [NEW] Si es un producto multi-línea, actualizar las líneas con sus precios calculados (incluyendo distribución de acabados globales)
    if (result.lineas_actualizadas) {
      const currentLinesJson = JSON.stringify(selectedConfig.lineas_medidas || []);
      const nextLinesJson = JSON.stringify(result.lineas_actualizadas);

      if (currentLinesJson !== nextLinesJson) {
        console.log('[UniversalWizard] Updating lines with calculated prices (distribution):', result.lineas_actualizadas.length);
        setSelectedConfig(prev => ({
          ...prev,
          lineas_medidas: result.lineas_actualizadas as any
        }));
      }
    }
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
      marca: null,
      usa_material_catalogo: false
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
        if (selectedProduct?.categoria_id === 'centro_copiado') {
          // Validar configuración mínima de copiado
          return !!(
            centroCopiadoConfig.cantidad_copias! > 0 &&
            centroCopiadoPrice > 0
          );
        }
        return isConfigurationComplete();
      case 'services':
        return true; // Los servicios son opcionales
      case 'summary':
        // [NEW] Validar precio copiado
        if (selectedProduct?.categoria_id === 'centro_copiado') {
          return centroCopiadoPrice > 0;
        }

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

    const steps = getActiveSteps();
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex < steps.length - 1) {
      let nextStep = steps[currentIndex + 1];

      // Si es compuesto, saltar de configuration directamente a summary
      if (currentStep === 'configuration' && selectedProduct?.es_compuesto) {
        nextStep = 'summary';
      }

      setCurrentStep(nextStep);
      closeSidePanel();
    }
  };

  const handlePrevious = () => {
    const steps = getActiveSteps();
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex > 0) {
      let prevStep = steps[currentIndex - 1];

      // Si es compuesto, volver de summary directamente a configuration
      if (currentStep === 'summary' && selectedProduct?.es_compuesto) {
        prevStep = 'configuration';
      }

      setCurrentStep(prevStep);
      closeSidePanel();
    }
  };

  const handleAgregar = async () => {
    if (!selectedProduct || !config) return;

    setIsSubmitting(true);
    try {
      // 1. Identificar servicios globales (tipo_impacto = 'precio_fijo') que requieren ID de tarea compartido
      const globalTaskMap = new Map<string, string>();
      for (const s of selectedServicios) {
        if (s.tipo_impacto === 'precio_fijo') {
          globalTaskMap.set(s.servicio_id, self.crypto.randomUUID());
        }
      }

      // Si el producto permite m\u00faltiples l\u00edneas, crear un item por cada l\u00ednea
      if (config.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0) {
        for (const linea of selectedConfig.lineas_medidas) {
          // Construir configuración JSONB para esta línea
          const configuracionLinea = {
            categoria: selectedProduct.categoria,
            categoria_id: selectedProduct.categoria_id,
            unidad_medida: selectedProduct.unidad_medida || null,
            medida_ancho: linea.ancho || linea.ancho_seleccionado || null,
            medida_alto: linea.alto || (linea.metros_lineales ? Math.round(linea.metros_lineales * 100) : null),
            es_metro_lineal: !!linea.metros_lineales,
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
            servicios_seleccionados: (selectedServicios || []).map(s => ({
              servicio_id: s.servicio_id,
              nombre: s.servicio_nombre,
              nivel: s.nivel_nombre,
              global_task_id: globalTaskMap.get(s.servicio_id) || null
            })),
            acabados_seleccionados: [
              ...(linea.acabados || []).map(a => ({
                acabado_id: a.acabado_id,
                nombre: a.acabado_nombre,
                nivel: a.nivel_nombre,
              })),
              ...(selectedAcabados || []).map(a => ({
                acabado_id: a.acabado_id,
                nombre: a.acabado_nombre,
                nivel: a.nivel_nombre,
              }))
            ]
          };

          // Generar rutas de producci\u00f3n para esta l\u00ednea
          const rutasGeneradas = await generateProductionRoutes({
            productoId: selectedProduct.id,
            categoria: selectedProduct.categoria,
            configuracion: configuracionLinea,
          });

          // Inyectar global_task_id si corresponde
          const rutasProcesadas = rutasGeneradas.map(r => {
            // Si el paso proviene de un servicio que marcamos como global
            if (r.source_service_id && globalTaskMap.has(r.source_service_id)) {
              return { ...r, global_task_id: globalTaskMap.get(r.source_service_id) };
            }
            return r;
          });

          const itemData = {
            producto_id: selectedProduct.id,
            producto_nombre: selectedProduct.nombre,
            producto_categoria: selectedProduct.categoria,
            categoria: selectedProduct.categoria,
            categoria_id: selectedProduct.categoria_id,
            tipo_item: selectedProduct.categoria_id === 'centro_copiado' ? 'centro_copiado' : 'catalogo',
            cantidad: linea.cantidad,
            configuracion: configuracionLinea,
            precio_base: linea.precio_base_unitario || 0,
            precio_servicios: linea.precio_servicios_unitario || 0,
            precio_acabados: linea.precio_acabados_unitario || 0,
            precio_unitario_final: linea.precio_unitario_final || 0,
            precio_total: linea.precio_total_linea || 0,
            impuesto_iva: config.impuesto_iva,
            rutas_generadas: rutasProcesadas
          };

          await onAgregar(itemData);
        }
      } else if (selectedProduct.categoria_id === 'centro_copiado') {
        const finalConfig = centroCopiadoConfig as ItemCopiadoConfig;

        // Calcular precio unitario (por juego de copias)
        const quantity = finalConfig.cantidad_copias;
        const unitPrice = quantity > 0 ? centroCopiadoPrice / quantity : 0;

        // Calcular impacto de servicios extra
        let precioServiciosExtra = 0;
        const serviciosItem = selectedServicios.map(s => {
          const impacto = calcularImpacto(
            s.tipo_impacto,
            s.valor_monto,
            s.valor_porcentaje,
            centroCopiadoPrice, // Precio Base Total
            0, // mt2 (n/a para copiado simple)
            0, // ml
            quantity,
            s.cantidad || 1
          );
          precioServiciosExtra += impacto;

          return {
            servicio_id: s.servicio_id,
            nombre: s.servicio_nombre,
            nivel: s.nivel_nombre,
            precio_unitario: quantity > 0 ? impacto / quantity : 0,
            cantidad: s.cantidad || 1,
            subtotal: impacto
          };
        });

        // Calcular impacto de acabados extra
        let precioAcabadosExtra = 0;
        const acabadosItem = selectedAcabados.map(a => {
          const impacto = calcularImpacto(
            a.tipo_impacto,
            a.valor_monto,
            a.valor_porcentaje,
            centroCopiadoPrice,
            0,
            0,
            quantity,
            a.cantidad || 1
          );
          precioAcabadosExtra += impacto;

          return {
            acabado_id: a.acabado_id,
            nombre: a.acabado_nombre,
            nivel: a.nivel_nombre,
            precio_unitario: quantity > 0 ? impacto / quantity : 0,
            cantidad: a.cantidad || 1,
            subtotal: impacto
          };
        });

        const precioTotalFinal = centroCopiadoPrice + precioServiciosExtra + precioAcabadosExtra;

        // Generar ruta de producción
        const configuracionRuta = {
          ...finalConfig,
          servicios_seleccionados: serviciosItem.map(s => ({
            servicio_id: s.servicio_id,
            nombre: s.nombre,
            global_task_id: globalTaskMap.get(s.servicio_id) || null
          })),
          acabados_seleccionados: acabadosItem.map(a => ({
            acabado_id: a.acabado_id,
            nombre: a.nombre
          }))
        };

        const rutasGeneradas = await generateProductionRoutes({
          productoId: selectedProduct.id,
          categoria: 'centro_copiado',
          configuracion: configuracionRuta
        });

        const itemData = {
          producto_id: selectedProduct.id === 'centro_copiado_module' ? null : selectedProduct.id,
          producto_nombre: selectedProduct.nombre,
          producto_categoria: 'Centro de Copiado',
          categoria: 'Centro de Copiado',
          categoria_id: 'centro_copiado',
          cantidad: quantity,
          configuracion: {
            ...finalConfig,
            es_compuesto: selectedConfig.es_compuesto,
            componentes: selectedConfig.componentes,
            servicios_seleccionados: serviciosItem,
            acabados_seleccionados: acabadosItem
          },
          precio_base: unitPrice,
          precio_servicios: quantity > 0 ? precioServiciosExtra / quantity : 0,
          precio_acabados: quantity > 0 ? precioAcabadosExtra / quantity : 0,
          precio_unitario_final: quantity > 0 ? precioTotalFinal / quantity : 0,
          precio_total: precioTotalFinal,
          impuesto_iva: config.impuesto_iva,
          tipo_item: 'centro_copiado',
          rutas_generadas: rutasGeneradas,
          servicios: serviciosItem,
          acabados: acabadosItem
        };

        await onAgregar(itemData);


      } else {
        // L\u00f3gica tradicional para productos sin m\u00faltiples l\u00edneas
        if (precioTotal === null) return;

        const configuracionItem = {
          categoria: selectedProduct.categoria,
          categoria_id: selectedProduct.categoria_id,
          unidad_medida: selectedProduct.unidad_medida || null,
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
          es_metro_lineal: selectedConfig.es_metro_lineal,
          servicios_seleccionados: selectedServicios.map(s => ({
            servicio_id: s.servicio_id,
            nombre: s.servicio_nombre,
            nivel: s.nivel_nombre,
            global_task_id: globalTaskMap.get(s.servicio_id) || null,
          })),
          acabados_seleccionados: selectedAcabados.map(a => ({
            acabado_id: a.acabado_id,
            nombre: a.acabado_nombre,
            nivel: a.nivel_nombre,
          })),
          es_compuesto: selectedConfig.es_compuesto,
          componentes: selectedConfig.componentes,
          ruta_produccion_id: selectedConfig.ruta_produccion_id
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
          producto_categoria: selectedProduct.categoria,
          categoria: selectedProduct.categoria,
          categoria_id: selectedProduct.categoria_id,
          tipo_item: selectedProduct.categoria_id === 'centro_copiado' ? 'centro_copiado' : 'catalogo',
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
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${index === currentIndex
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
                  className={`w-12 h-0.5 mx-1 ${index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 'search':
        return (
          <UniversalProductSearchStep
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelectProduct={handleSelectProduct}
          />
        );
      case 'configuration':
        if (loadingConfig) {
          return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">Cargando configuración del producto</p>
                <p className="text-sm text-gray-500 mt-1">Preparando opciones disponibles...</p>
              </div>
            </div>
          );
        }
        if (config) {
          if (selectedProduct?.categoria_id === 'centro_copiado') {
            return (
              <CentroCopiadoStep
                config={centroCopiadoConfig}
                onChange={(u) => setCentroCopiadoConfig((prev: Partial<ItemCopiadoConfig>) => ({ ...prev, ...u }))}
                onPriceChange={setCentroCopiadoPrice}
              />
            );
          }
          return (
            <ConfigurationStep
              config={config}
              selectedConfig={selectedConfig}
              selectedAcabados={selectedAcabados}
              onConfigChange={handleConfigChange}
              isEditing={isEditing}
              onOpenSidePanel={openSidePanel}
              onEditSidePanel={openSidePanel} // Assuming edit also uses openSidePanel
              onCloseSidePanel={closeSidePanel}
            />
          );
        }
        return null;
      case 'services':
        return config && (
          <ServicesAndFinishingsStep
            config={config}
            selectedAcabados={selectedAcabados}
            onAcabadosChange={setSelectedAcabados}
            selectedServicios={selectedServicios}
            onServiciosChange={setSelectedServicios}
            hideServices={selectedProduct?.categoria_id === 'centro_copiado'}
          />
        );
      case 'summary':
        return config && (
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
            centroCopiadoConfig={centroCopiadoConfig}
            centroCopiadoPrice={centroCopiadoPrice}
          />
        );
      default:
        return null;
    }
  };

  const renderFooter = () => (
    <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between mt-6">
      <div>
        {currentStep !== 'search' && (
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={handleClose}
          disabled={isSubmitting}
          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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
            {isSubmitting ? (isEditing ? 'Guardando...' : 'Agregando...') : (isEditing ? 'Guardar Cambios' : 'Agregar a la Orden')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderMainContent = () => {
    return (
      <div className="flex flex-col h-full relative pt-6">
        {/* Close Button Inside */}
        <button
          onClick={handleClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100 z-50"
          title="Cerrar"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Step Indicator */}
        <div className="mb-6">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {renderStepContent()}
        </div>

        {/* Footer */}
        {renderFooter()}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={(currentStep === 'summary' && !isEditing) ? '' : (isEditing ? 'Editar Item' : stepTitles[currentStep])}
      showHeader={false}
      sidePanel={currentStep === 'summary' && config ? (
        <SummaryPricingSidebar
          config={config}
          selectedConfig={selectedConfig}
          precioBase={precioBase}
          precioServicios={precioServicios}
          precioAcabados={precioAcabados}
          precioTotal={precioTotal}
          isCalculatingPrice={isCalculating}
          centroCopiadoConfig={centroCopiadoConfig}
          centroCopiadoPrice={centroCopiadoPrice}
        />
      ) : sidePanelContent}
      isSidePanelOpen={currentStep === 'summary' || isSidePanelOpen}
      size="xl"
    >
      {renderMainContent()}
    </Modal>
  );
}

