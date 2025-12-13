import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Ruler, Package, Layers, Palette, FileText, Check, RotateCcw, CheckCircle } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import { MeasurementLinesTable } from './MeasurementLinesTable';
import type { SelectedService, SelectedFinishing } from './ServicesAndFinishingsStep';

interface ConfigurationStepProps {
  config: ProductConfiguration;
  selectedConfig: SelectedConfiguration;
  selectedServicios?: SelectedService[];
  selectedAcabados?: SelectedFinishing[];
  onConfigChange: (config: Partial<SelectedConfiguration>) => void;
  isEditing?: boolean;
}

// Interface para una línea de medida/cantidad individual
export interface MeasurementLine {
  id: string; // UUID temporal para identificar la línea

  // Para MT2 (Gran Formato y Materiales Rígidos)
  ancho?: number;
  alto?: number;
  mt2_calculado?: number;

  // Para Metro Lineal (Gran Formato y Plotter)
  ancho_seleccionado?: number;
  metros_lineales?: number;

  // Cantidad de unidades de esta línea
  cantidad: number;

  // Servicios aplicables a esta línea
  servicios: Array<{
    servicio_id: string;
    servicio_nombre: string;
    nivel_id: string | null;
    nivel_nombre: string | null;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
    cantidad?: number;
  }>;

  // Acabados aplicables a esta línea
  acabados: Array<{
    acabado_id: string;
    acabado_nombre: string;
    nivel_id: string | null;
    nivel_nombre: string | null;
    tipo_impacto: string;
    valor_porcentaje: number | null;
    valor_monto: number | null;
    cantidad?: number;
  }>;

  // Precios calculados para esta línea
  precio_base_unitario?: number;
  precio_servicios_unitario?: number;
  precio_acabados_unitario?: number;
  precio_unitario_final?: number;
  precio_total_linea?: number;
}

export interface SelectedConfiguration {
  // Líneas de medidas (para productos que permiten múltiples líneas)
  lineas_medidas: MeasurementLine[];

  // Cantidad (solo para productos sin múltiples líneas)
  cantidad: number;

  // Medidas (solo para productos sin múltiples líneas)
  medida_ancho: number | null;
  medida_alto: number | null;
  medida_mt2?: number | null;

  // Material
  material_id: string | null;
  material_nombre: string | null;
  variante_id: string | null;
  variante_nombre: string | null;
  espesor: number | null;
  unidad_espesor?: string | null;
  gramaje?: number | null;

  // Tecnología y tintas
  tecnologia_id: string | null;
  tecnologia_nombre: string | null;
  tinta: string | null;
  tinta_nombre: string | null;

  // Caras (para laser)
  cara_impresa: 'solo_frente' | 'frente_y_dorso' | null;

  // Tipo de copia (para talonarios)
  tipo_copia: 'duplicado' | 'triplicado' | 'cuadruplicado' | null;

  // Color y marca
  color: string | null;
  marca: string | null;

  // Para Impresión UV sobre Rígidos
  usa_material_catalogo: boolean;
}

// ===============================================
// FUNCIONES AUXILIARES PARA MATERIALES RÍGIDOS
// ===============================================

/**
 * Extrae una lista única de variantes disponibles para Materiales Rígidos
 */
function getVariantesUnicas(
  materiales: Array<{ variante_nombre: string }>
): string[] {
  const variantes = new Set<string>();
  materiales.forEach(m => variantes.add(m.variante_nombre));
  return Array.from(variantes).sort();
}

/**
 * Extrae los espesores disponibles para una variante específica
 */
function getEspesoresPorVariante(
  materiales: Array<{ variante_nombre: string; espesor: number | null }>,
  varianteNombre: string
): number[] {
  return materiales
    .filter(m => m.variante_nombre === varianteNombre && m.espesor !== null)
    .map(m => m.espesor as number)
    .filter((value, index, self) => self.indexOf(value) === index) // únicos
    .sort((a, b) => a - b);
}

export function ConfigurationStep({
  config,
  selectedConfig,
  selectedServicios = [],
  selectedAcabados = [],
  onConfigChange,
  isEditing = false
}: ConfigurationStepProps) {
  const [localConfig, setLocalConfig] = useState(selectedConfig);

  // Estado específico para Materiales Rígidos (selección progresiva)
  const [variantesDisponibles, setVariantesDisponibles] = useState<string[]>([]);
  const [espesoresDisponibles, setEspesoresDisponibles] = useState<number[]>([]);

  // Función helper para nombres de tintas (movida aquí para usar en useEffect)
  const getNombreTinta = (tinta: string): string => {
    const nombresMap: Record<string, string> = {
      'K': 'Negro',
      'CMYK': 'Color (CMYK)',
      'CMYK+W': 'Color + Blanco',
      'CMYK+V': 'Color + Barniz',
      'CMYK+W+V': 'Color + Blanco + Barniz'
    };
    return nombresMap[tinta] || tinta;
  };

  // Sincronizar localConfig cuando selectedConfig cambia desde el padre
  useEffect(() => {
    console.log('[ConfigurationStep] Sincronizando selectedConfig desde padre:', selectedConfig);
    setLocalConfig(selectedConfig);
  }, [selectedConfig]);

  // Auto-seleccionar opciones únicas al cargar
  useEffect(() => {
    // If we are editing, DO NOT auto-select defaults as it might overwrite hydrated data with stale localConfig
    if (isEditing) return;

    const autoSelections: Partial<SelectedConfiguration> = {};

    // Auto-seleccionar medida única
    if (config.medidas && config.medidas.length === 1) {
      autoSelections.medida_ancho = config.medidas[0].ancho;
      autoSelections.medida_alto = config.medidas[0].alto;
    }

    // Auto-seleccionar material único (para cualquier categoría con 1 solo material)
    if (config.materiales && config.materiales.length === 1 && config.categoria !== 'Materiales Rigidos') {
      const material = config.materiales[0];
      autoSelections.material_id = material.material_id;
      autoSelections.material_nombre = material.material_nombre;
      autoSelections.variante_id = material.variante_id;
      autoSelections.variante_nombre = material.variante_nombre;
      autoSelections.espesor = material.espesor || null;
      autoSelections.unidad_espesor = material.unidad_espesor || null;
      autoSelections.gramaje = material.gramaje || null;
    }

    // Auto-seleccionar tecnología única (solo para Impresión Láser que siempre es laser)
    if (config.categoria === 'Impresion Laser' && config.tecnologias && config.tecnologias.length === 1) {
      const tecnologia = config.tecnologias[0];
      autoSelections.tecnologia_id = tecnologia.tecnologia_id;
      autoSelections.tecnologia_nombre = tecnologia.tecnologia_nombre;

      console.log('[ConfigurationStep] Auto-seleccionando tecnología para Impresion Laser:', tecnologia.tecnologia_nombre);

      // Auto-seleccionar tinta única si solo hay una opción
      if (tecnologia.tintas && tecnologia.tintas.length === 1) {
        const tintaUnica = tecnologia.tintas[0];
        autoSelections.tinta = tintaUnica;
        autoSelections.tinta_nombre = getNombreTinta(tintaUnica);
        console.log('[ConfigurationStep] Auto-seleccionando tinta única:', autoSelections.tinta_nombre);
      } else {
        console.log('[ConfigurationStep] Tintas disponibles:', tecnologia.tintas?.length || 0);
      }
    }

    // Auto-seleccionar tecnología única para UV (siempre es una sola)
    if (config.categoria === 'Impresión UV sobre Rígidos' && config.tecnologias && config.tecnologias.length === 1) {
      const tecnologia = config.tecnologias[0];
      autoSelections.tecnologia_id = tecnologia.tecnologia_id;
      autoSelections.tecnologia_nombre = tecnologia.tecnologia_nombre;
    }

    if (Object.keys(autoSelections).length > 0) {
      console.log('[ConfigurationStep] Aplicando auto-selecciones:', autoSelections);
      handleChange(autoSelections);
    }
  }, [config]);

  // Efecto para inicializar variantes disponibles en Materiales Rígidos
  useEffect(() => {
    if (config.categoria === 'Materiales Rigidos' && config.materiales && config.materiales.length > 0) {
      const variantes = getVariantesUnicas(config.materiales);
      setVariantesDisponibles(variantes);

      // Si ya hay una variante seleccionada (edición o vuelta atrás), calcular espesores
      if (localConfig.variante_nombre) {
        const espesores = getEspesoresPorVariante(config.materiales, localConfig.variante_nombre);
        setEspesoresDisponibles(espesores);
      }
    }
  }, [config, localConfig.variante_nombre]);

  // Efecto para calcular espesores cuando cambia la variante seleccionada
  useEffect(() => {
    if (config.categoria === 'Materiales Rigidos' && localConfig.variante_nombre && config.materiales) {
      const espesores = getEspesoresPorVariante(config.materiales, localConfig.variante_nombre);
      setEspesoresDisponibles(espesores);
    }
  }, [localConfig.variante_nombre, config]);

  const handleChange = (changes: Partial<SelectedConfiguration>) => {
    const newConfig = { ...localConfig, ...changes };
    console.log('[ConfigurationStep] handleChange - changes:', changes);
    console.log('[ConfigurationStep] handleChange - newConfig completo:', newConfig);
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  // Handlers específicos para Materiales Rígidos
  const handleVarianteSelection = (varianteNombre: string) => {
    // Resetear espesor cuando cambia la variante
    handleChange({
      variante_nombre: varianteNombre,
      espesor: null,
      material_id: null,
      material_nombre: null,
      variante_id: null,
      unidad_espesor: null
    });
  };

  const handleEspesorSelection = (espesor: number) => {
    // Buscar el registro completo en config.materiales
    const materialCompleto = config.materiales?.find(m =>
      m.variante_nombre === localConfig.variante_nombre &&
      m.espesor === espesor
    );

    if (materialCompleto) {
      handleChange({
        material_id: materialCompleto.material_id,
        material_nombre: materialCompleto.material_nombre,
        variante_id: materialCompleto.material_id, // Usar material_id como variante_id
        variante_nombre: materialCompleto.variante_nombre,
        espesor: materialCompleto.espesor,
        unidad_espesor: materialCompleto.unidad_espesor
      });
    }
  };

  const handleResetSeleccionMR = () => {
    setEspesoresDisponibles([]);
    handleChange({
      material_id: null,
      material_nombre: null,
      variante_id: null,
      variante_nombre: null,
      espesor: null,
      unidad_espesor: null
    });
  };

  const isImpresionLaser = config.categoria === 'Impresion Laser';
  const isImpresionUV = config.categoria === 'Impresión UV sobre Rígidos';

  return (
    <div className="space-y-6">
      {/* Cantidad - Solo para productos sin múltiples líneas */}
      {!config.permite_multiples_lineas && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Cantidad</h3>
          </div>

          {config.tipo_venta === 'cantidades_fijas' && config.cantidades_fijas && config.cantidades_fijas.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona la cantidad
              </label>
              <div className="grid grid-cols-4 gap-3">
                {config.cantidades_fijas.map((cant) => (
                  <Button
                    key={cant}
                    variant={localConfig.cantidad === cant ? 'primary' : 'secondary'}
                    onClick={() => handleChange({ cantidad: cant })}
                    className="w-full"
                  >
                    {cant}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad {config.cantidad_minima && `(mínimo: ${config.cantidad_minima})`}
              </label>
              <Input
                type="number"
                min={config.cantidad_minima || 1}
                value={localConfig.cantidad}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) {
                    handleChange({ cantidad: value });
                  }
                }}
                placeholder="Ingresa la cantidad"
              />
            </div>
          )}
        </Card>
      )}

      {/* Medidas - Cards en lugar de Select */}
      {config.medidas && config.medidas.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Medidas</h3>
          </div>

          {config.medidas.length === 1 ? (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                Medida: <span className="font-semibold">{config.medidas[0].ancho} x {config.medidas[0].alto} cm</span>
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona la medida
              </label>
              <div className="grid grid-cols-3 gap-3">
                {config.medidas.map((medida) => {
                  const isSelected = localConfig.medida_ancho === medida.ancho && localConfig.medida_alto === medida.alto;
                  return (
                    <Card
                      key={`${medida.ancho}x${medida.alto}`}
                      className={`p-4 cursor-pointer transition-all ${isSelected
                        ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                        : 'hover:border-blue-300 hover:shadow-md'
                        }`}
                      onClick={() => handleChange({ medida_ancho: medida.ancho, medida_alto: medida.alto })}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">{medida.ancho} x {medida.alto}</div>
                          <div className="text-sm text-gray-500">centímetros</div>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Selector de tipo de material UV - Solo para Impresión UV sobre Rígidos */}
      {isImpresionUV && config.permite_material_cliente && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Origen del Material</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              ¿De dónde proviene el material a imprimir?
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.usa_material_catalogo === true
                  ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                  : 'hover:border-blue-300 hover:shadow-md'
                  }`}
                onClick={() => handleChange({
                  usa_material_catalogo: true,
                  material_id: null,
                  material_nombre: null
                })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Material del Catálogo</h4>
                    <p className="text-sm text-gray-600 mt-1">Elegir material de nuestro catálogo</p>
                  </div>
                  {localConfig.usa_material_catalogo === true && (
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                  )}
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.usa_material_catalogo === false
                  ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                  : 'hover:border-blue-300 hover:shadow-md'
                  }`}
                onClick={() => handleChange({
                  usa_material_catalogo: false,
                  material_id: null,
                  material_nombre: null
                })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Material del Cliente</h4>
                    <p className="text-sm text-gray-600 mt-1">Cliente provee el material</p>
                  </div>
                  {localConfig.usa_material_catalogo === false && (
                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                  )}
                </div>
              </Card>
            </div>

            {localConfig.usa_material_catalogo === false && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  El cliente proporcionará el material. Solo se cobrará la impresión UV.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Anchos disponibles (Gran Formato / Plotter) - Solo para productos sin múltiples líneas */}
      {!config.permite_multiples_lineas && config.anchos_disponibles && config.anchos_disponibles.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Ancho del Material</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona el ancho
            </label>
            <div className="grid grid-cols-4 gap-3">
              {config.anchos_disponibles.map((ancho) => (
                <Button
                  key={ancho}
                  variant={localConfig.medida_ancho === ancho ? 'primary' : 'secondary'}
                  onClick={() => handleChange({ medida_ancho: ancho })}
                  className="w-full"
                >
                  {ancho} cm
                </Button>
              ))}
            </div>
          </div>

          {config.tipo_medida === 'ancho_maximo' && localConfig.medida_ancho && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alto (metros lineales)
              </label>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={localConfig.medida_alto || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    handleChange({ medida_alto: value });
                  }
                }}
                placeholder="Ingresa el alto en metros"
              />
            </div>
          )}
        </Card>
      )}

      {/* Material - Selector Progresivo para Materiales Rígidos */}
      {config.categoria === 'Materiales Rigidos' && config.materiales && config.materiales.length > 0 && (
        <>
          {/* PASO 1: Seleccionar Variante */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Variante de {config.materiales[0]?.material_nombre || 'Material'}
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona la variante
              </label>
              <div className="grid grid-cols-2 gap-3">
                {variantesDisponibles.map((variante) => {
                  const isSelected = localConfig.variante_nombre === variante;
                  return (
                    <Card
                      key={variante}
                      className={`p-4 cursor-pointer transition-all ${isSelected
                        ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                        : 'hover:border-blue-300 hover:shadow-md'
                        }`}
                      onClick={() => handleVarianteSelection(variante)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-gray-900">{variante}</div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* PASO 2: Seleccionar Espesor (solo si hay variante seleccionada) */}
          {localConfig.variante_nombre && espesoresDisponibles.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Ruler className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Espesor</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Selecciona el espesor para {localConfig.variante_nombre}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {espesoresDisponibles.map((espesor) => {
                    const isSelected = localConfig.espesor === espesor;
                    const unidad = config.materiales[0]?.unidad_espesor || 'mm';

                    return (
                      <Card
                        key={espesor}
                        className={`p-4 cursor-pointer transition-all ${isSelected
                          ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                          : 'hover:border-blue-300 hover:shadow-md'
                          }`}
                        onClick={() => handleEspesorSelection(espesor)}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className="text-2xl font-bold text-gray-900">{espesor}</div>
                          <div className="text-sm text-gray-500">{unidad}</div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-blue-600 mt-2" />
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Botón para cambiar de variante */}
                {localConfig.variante_nombre && (
                  <Button
                    variant="outline"
                    onClick={handleResetSeleccionMR}
                    className="mt-4 w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Cambiar variante
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Indicador de selección completa */}
          {localConfig.variante_nombre && localConfig.espesor && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-semibold text-green-900">Selección completa</div>
                  <div className="text-sm text-green-700">
                    {config.materiales[0]?.material_nombre} {localConfig.variante_nombre} - {localConfig.espesor}{config.materiales[0]?.unidad_espesor}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Material UV - Solo si se eligió usar material de catálogo */}
      {isImpresionUV && localConfig.usa_material_catalogo === true && config.materiales && config.materiales.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Material UV</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona el material del catálogo
            </label>
            <div className="grid grid-cols-2 gap-3">
              {config.materiales.map((material) => {
                const isSelected = localConfig.material_id === material.material_id;
                return (
                  <Card
                    key={material.id}
                    className={`p-4 cursor-pointer transition-all ${isSelected
                      ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                      : 'hover:border-blue-300 hover:shadow-md'
                      }`}
                    onClick={() => {
                      handleChange({
                        material_id: material.material_id,
                        material_nombre: material.material_nombre,
                        variante_id: material.variante_id,
                        variante_nombre: material.variante_nombre,
                        espesor: material.espesor || null,
                        unidad_espesor: material.unidad_espesor || null
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{material.material_nombre}</div>
                        {material.variante_nombre && (
                          <div className="text-sm text-gray-600">{material.variante_nombre}</div>
                        )}
                        {material.espesor && (
                          <div className="text-sm text-gray-500">
                            {material.espesor} {material.unidad_espesor}
                          </div>
                        )}
                        {material.precio_por_m2 && (
                          <div className="text-sm font-medium text-blue-600 mt-1">
                            ${material.precio_por_m2}/m²
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Material - Selector tradicional para otras categorías */}
      {config.categoria !== 'Materiales Rigidos' && !isImpresionLaser && !isImpresionUV && config.materiales && config.materiales.length > 1 && !config.permite_multiples_lineas && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Material</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona el material
            </label>
            <div className="grid grid-cols-2 gap-3">
              {config.materiales.map((material) => {
                const isSelected = localConfig.material_id === material.material_id;
                return (
                  <Card
                    key={material.id}
                    className={`p-4 cursor-pointer transition-all ${isSelected
                      ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                      : 'hover:border-blue-300 hover:shadow-md'
                      }`}
                    onClick={() => {
                      handleChange({
                        material_id: material.material_id,
                        material_nombre: material.material_nombre,
                        variante_id: material.variante_id,
                        variante_nombre: material.variante_nombre,
                        espesor: material.espesor || null,
                        unidad_espesor: material.unidad_espesor || null,
                        gramaje: material.gramaje || null
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{material.material_nombre}</div>
                        <div className="text-sm text-gray-600">{material.variante_nombre}</div>
                        {material.espesor && (
                          <div className="text-sm text-gray-500">{material.espesor} {material.unidad_espesor}</div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Tecnología y Tintas - Mostrar siempre que haya tecnologías. Controles internos gestionan qué mostrar */}
      {config.tecnologias && config.tecnologias.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isImpresionLaser ? 'Tipo de Impresión' : isImpresionUV ? 'Tipo de Tinta UV' : 'Tecnología e Impresión'}
            </h3>
          </div>

          <div className="space-y-4">
            {/* Solo mostrar selector de tecnología si NO es Impresión Láser ni UV */}
            {!isImpresionLaser && !isImpresionUV && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tecnología
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {config.tecnologias.map((tec) => {
                    const isSelected = localConfig.tecnologia_id === tec.tecnologia_id;
                    return (
                      <Card
                        key={tec.tecnologia_id}
                        className={`p-4 cursor-pointer transition-all ${isSelected
                          ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                          : 'hover:border-blue-300 hover:shadow-md'
                          }`}
                        onClick={() => {
                          handleChange({
                            tecnologia_id: tec.tecnologia_id,
                            tecnologia_nombre: tec.tecnologia_nombre,
                            tinta: null,
                            tinta_nombre: null
                          });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-gray-900">{tec.tecnologia_nombre}</div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selector de tintas - Cards */}
            {(localConfig.tecnologia_id || isImpresionUV) && (() => {
              console.log('[ConfigurationStep] Evaluando selector de tintas - localConfig.tecnologia_id:', localConfig.tecnologia_id, 'isImpresionUV:', isImpresionUV);

              // Para UV, usar la primera tecnología (solo hay una)
              const tecnologia = isImpresionUV && config.tecnologias && config.tecnologias.length > 0
                ? config.tecnologias[0]
                : config.tecnologias?.find(t => t.tecnologia_id === localConfig.tecnologia_id);

              console.log('[ConfigurationStep] Tecnología encontrada:', tecnologia?.tecnologia_nombre);
              console.log('[ConfigurationStep] Tintas disponibles:', tecnologia?.tintas);
              console.log('[ConfigurationStep] Tinta seleccionada:', localConfig.tinta);

              return tecnologia && tecnologia.tintas && tecnologia.tintas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Tipo de tinta
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {tecnologia.tintas.map((tinta) => {
                      const isSelected = localConfig.tinta === tinta;
                      const nombreTinta = getNombreTinta(tinta);

                      return (
                        <Card
                          key={tinta}
                          className={`p-4 cursor-pointer transition-all ${isSelected
                            ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                            : 'hover:border-blue-300 hover:shadow-md'
                            }`}
                          onClick={() => {
                            handleChange({
                              tinta: tinta,
                              tinta_nombre: nombreTinta
                            });
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900">{nombreTinta}</div>
                              <div className="text-xs text-gray-500 mt-1">{tinta}</div>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Material auto-seleccionado (solo info) - Para productos con múltiples líneas y 1 solo material */}
      {config.permite_multiples_lineas &&
        localConfig.material_nombre &&
        config.materiales &&
        config.materiales.length === 1 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Material</h3>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{localConfig.material_nombre}</span>
                {localConfig.variante_nombre && ` - ${localConfig.variante_nombre}`}
                {localConfig.espesor && localConfig.unidad_espesor && (
                  <span className="text-gray-600 ml-2">
                    ({localConfig.espesor}{localConfig.unidad_espesor})
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Material asignado a este producto
              </p>
            </div>
          </Card>
        )}

      {/* M\u00faltiples l\u00edneas de medidas (para Gran Formato, Materiales R\u00edgidos y Plotter) */}
      {config.permite_multiples_lineas && (
        <MeasurementLinesTable
          config={config}
          lines={localConfig.lineas_medidas}
          selectedServicios={selectedServicios}
          selectedAcabados={selectedAcabados}
          baseConfig={{
            cantidad: localConfig.cantidad,
            medida_ancho: localConfig.medida_ancho,
            medida_alto: localConfig.medida_alto,
            medida_mt2: localConfig.medida_mt2,
            material_id: localConfig.material_id,
            material_nombre: localConfig.material_nombre,
            variante_id: localConfig.variante_id,
            variante_nombre: localConfig.variante_nombre,
            espesor: localConfig.espesor,
            unidad_espesor: localConfig.unidad_espesor,
            gramaje: localConfig.gramaje,
            tecnologia_id: localConfig.tecnologia_id,
            tecnologia_nombre: localConfig.tecnologia_nombre,
            tinta: localConfig.tinta,
            tinta_nombre: localConfig.tinta_nombre,
            cara_impresa: localConfig.cara_impresa,
            color: localConfig.color,
            marca: localConfig.marca
          }}
          onChange={(lines) => handleChange({ lineas_medidas: lines })}
        />
      )}

      {/* Caras de impresión (solo para laser) */}
      {config.caras_impresas && config.caras_impresas.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Caras de Impresión</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {config.caras_impresas.includes('solo_frente') && (
              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.cara_impresa === 'solo_frente'
                  ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                  : 'hover:border-blue-300 hover:shadow-md'
                  }`}
                onClick={() => handleChange({ cara_impresa: 'solo_frente' })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Solo Frente</h4>
                    <p className="text-sm text-gray-600 mt-1">Una cara</p>
                  </div>
                  {localConfig.cara_impresa === 'solo_frente' && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </Card>
            )}

            {config.caras_impresas.includes('frente_y_dorso') && (
              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.cara_impresa === 'frente_y_dorso'
                  ? 'ring-2 ring-blue-600 bg-blue-50 border-blue-600'
                  : 'hover:border-blue-300 hover:shadow-md'
                  }`}
                onClick={() => handleChange({ cara_impresa: 'frente_y_dorso' })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Frente y Dorso</h4>
                    <p className="text-sm text-gray-600 mt-1">Ambas caras</p>
                  </div>
                  {localConfig.cara_impresa === 'frente_y_dorso' && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </Card>
            )}
          </div>
        </Card>
      )}

      {/* Tipo de copia (solo para talonarios) */}
      {config.tipo_copia && config.tipo_copia.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Tipo de Copia</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {config.tipo_copia.includes('duplicado') && (
              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.tipo_copia === 'duplicado'
                  ? 'border-2 border-blue-600 bg-blue-50'
                  : 'border border-gray-200 hover:border-blue-300'
                  }`}
                onClick={() => handleChange({ tipo_copia: 'duplicado' })}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">Duplicado</div>
                  <div className="text-sm text-gray-600">2 copias</div>
                  {localConfig.tipo_copia === 'duplicado' && (
                    <Check className="w-5 h-5 text-blue-600 mx-auto mt-2" />
                  )}
                </div>
              </Card>
            )}

            {config.tipo_copia.includes('triplicado') && (
              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.tipo_copia === 'triplicado'
                  ? 'border-2 border-blue-600 bg-blue-50'
                  : 'border border-gray-200 hover:border-blue-300'
                  }`}
                onClick={() => handleChange({ tipo_copia: 'triplicado' })}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">Triplicado</div>
                  <div className="text-sm text-gray-600">3 copias</div>
                  {localConfig.tipo_copia === 'triplicado' && (
                    <Check className="w-5 h-5 text-blue-600 mx-auto mt-2" />
                  )}
                </div>
              </Card>
            )}

            {config.tipo_copia.includes('cuadruplicado') && (
              <Card
                className={`p-4 cursor-pointer transition-all ${localConfig.tipo_copia === 'cuadruplicado'
                  ? 'border-2 border-blue-600 bg-blue-50'
                  : 'border border-gray-200 hover:border-blue-300'
                  }`}
                onClick={() => handleChange({ tipo_copia: 'cuadruplicado' })}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">Cuadruplicado</div>
                  <div className="text-sm text-gray-600">4 copias</div>
                  {localConfig.tipo_copia === 'cuadruplicado' && (
                    <Check className="w-5 h-5 text-blue-600 mx-auto mt-2" />
                  )}
                </div>
              </Card>
            )}
          </div>
        </Card>
      )}

      {/* Color (para plotter) */}
      {config.color && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Color</h3>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700">
              Color: <span className="font-semibold">{config.color}</span>
            </p>
          </div>
        </Card>
      )}

      {/* Marca */}
      {config.marca && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Marca</h3>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700">
              Marca: <span className="font-semibold">{config.marca}</span>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
