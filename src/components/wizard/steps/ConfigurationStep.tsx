import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { Ruler, Package, Layers, Palette, FileText } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';

interface ConfigurationStepProps {
  config: ProductConfiguration;
  selectedConfig: SelectedConfiguration;
  onConfigChange: (config: Partial<SelectedConfiguration>) => void;
}

export interface SelectedConfiguration {
  // Cantidad
  cantidad: number;

  // Medidas
  medida_ancho: number | null;
  medida_alto: number | null;
  medida_mt2?: number | null;

  // Material
  material_id: string | null;
  material_nombre: string | null;
  variante_id: string | null;
  variante_nombre: string | null;
  espesor: number | null;

  // Tecnología y tintas
  tecnologia_id: string | null;
  tecnologia_nombre: string | null;
  tinta: string | null;
  tinta_nombre: string | null;

  // Caras (para laser)
  cara_impresa: 'solo_frente' | 'frente_y_dorso' | null;

  // Color y marca
  color: string | null;
  marca: string | null;
}

export function ConfigurationStep({ config, selectedConfig, onConfigChange }: ConfigurationStepProps) {
  const [localConfig, setLocalConfig] = useState(selectedConfig);

  // Auto-seleccionar opciones únicas al cargar
  useEffect(() => {
    const autoSelections: Partial<SelectedConfiguration> = {};

    // Auto-seleccionar medida única
    if (config.medidas && config.medidas.length === 1) {
      autoSelections.medida_ancho = config.medidas[0].ancho;
      autoSelections.medida_alto = config.medidas[0].alto;
    }

    // Auto-seleccionar material único (solo para Impresión Láser que siempre tiene 1)
    if (config.categoria === 'Impresion Laser' && config.materiales && config.materiales.length === 1) {
      const material = config.materiales[0];
      autoSelections.material_id = material.material_id;
      autoSelections.material_nombre = material.material_nombre;
      autoSelections.variante_id = material.variante_id;
      autoSelections.variante_nombre = material.variante_nombre;
      autoSelections.espesor = material.espesor || null;
    }

    // Auto-seleccionar tecnología única (solo para Impresión Láser que siempre es laser)
    if (config.categoria === 'Impresion Laser' && config.tecnologias && config.tecnologias.length === 1) {
      const tecnologia = config.tecnologias[0];
      autoSelections.tecnologia_id = tecnologia.tecnologia_id;
      autoSelections.tecnologia_nombre = tecnologia.tecnologia_nombre;
    }

    if (Object.keys(autoSelections).length > 0) {
      handleChange(autoSelections);
    }
  }, [config]);

  const handleChange = (changes: Partial<SelectedConfiguration>) => {
    const newConfig = { ...localConfig, ...changes };
    setLocalConfig(newConfig);
    onConfigChange(changes);
  };

  const isImpresionLaser = config.categoria === 'Impresion Laser';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuración del Producto</h2>
        <p className="text-gray-600">
          Completa los detalles del producto que deseas agregar
        </p>
      </div>

      {/* Cantidad */}
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

      {/* Medidas */}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona la medida
              </label>
              <Select
                value={localConfig.medida_ancho && localConfig.medida_alto ? `${localConfig.medida_ancho}x${localConfig.medida_alto}` : ''}
                onChange={(e) => {
                  const value = e.target?.value;
                  if (value) {
                    const [ancho, alto] = value.split('x').map(Number);
                    handleChange({ medida_ancho: ancho, medida_alto: alto });
                  }
                }}
              >
                <option value="">Selecciona una medida</option>
                {config.medidas.map((medida) => (
                  <option key={`${medida.ancho}x${medida.alto}`} value={`${medida.ancho}x${medida.alto}`}>
                    {medida.ancho} x {medida.alto} cm
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Card>
      )}

      {/* Anchos disponibles (Gran Formato / Plotter) */}
      {config.anchos_disponibles && config.anchos_disponibles.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Ancho del Material</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecciona el ancho
            </label>
            <Select
              value={localConfig.medida_ancho?.toString() || ''}
              onChange={(e) => {
                const value = e.target?.value;
                if (value) {
                  handleChange({ medida_ancho: parseFloat(value) });
                }
              }}
            >
              <option value="">Selecciona un ancho</option>
              {config.anchos_disponibles.map((ancho) => (
                <option key={ancho} value={ancho}>
                  {ancho} cm
                </option>
              ))}
            </Select>
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

      {/* Material - NO mostrar para Impresión Láser */}
      {!isImpresionLaser && config.materiales && config.materiales.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Material</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona el material
              </label>
              <Select
                value={localConfig.material_id || ''}
                onChange={(e) => {
                  const value = e.target?.value;
                  if (!value) return;

                  const material = config.materiales?.find(m => m.material_id === value);
                  if (material) {
                    handleChange({
                      material_id: material.material_id,
                      material_nombre: material.material_nombre,
                      variante_id: material.variante_id,
                      variante_nombre: material.variante_nombre,
                      espesor: material.espesor || null
                    });
                  }
                }}
              >
                <option value="">Selecciona un material</option>
                {config.materiales.map((material) => (
                  <option key={material.id} value={material.material_id}>
                    {material.material_nombre} - {material.variante_nombre}
                    {material.espesor && ` (${material.espesor} ${material.unidad_espesor})`}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Tecnología y Tintas - NO mostrar tecnología para Impresión Láser */}
      {config.tecnologias && config.tecnologias.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {isImpresionLaser ? 'Impresión' : 'Tecnología e Impresión'}
            </h3>
          </div>

          <div className="space-y-4">
            {/* Solo mostrar selector de tecnología si NO es Impresión Láser */}
            {!isImpresionLaser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tecnología
                </label>
                <Select
                  value={localConfig.tecnologia_id || ''}
                  onChange={(e) => {
                    const value = e.target?.value;
                    if (!value) return;

                    const tecnologia = config.tecnologias?.find(t => t.tecnologia_id === value);
                    if (tecnologia) {
                      handleChange({
                        tecnologia_id: tecnologia.tecnologia_id,
                        tecnologia_nombre: tecnologia.tecnologia_nombre,
                        tinta: null,
                        tinta_nombre: null
                      });
                    }
                  }}
                >
                  <option value="">Selecciona una tecnología</option>
                  {config.tecnologias.map((tec) => (
                    <option key={tec.tecnologia_id} value={tec.tecnologia_id}>
                      {tec.tecnologia_nombre}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Selector de tintas */}
            {localConfig.tecnologia_id && (() => {
              const tecnologia = config.tecnologias?.find(t => t.tecnologia_id === localConfig.tecnologia_id);
              return tecnologia && tecnologia.tintas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de tinta
                  </label>
                  <Select
                    value={localConfig.tinta || ''}
                    onChange={(e) => {
                      const value = e.target?.value;
                      if (!value) return;

                      const nombresMap: Record<string, string> = {
                        'K': 'Negro (K)',
                        'CMYK': 'Cuatricromía (CMYK)',
                        'CMYK+W': 'CMYK + Blanco',
                        'CMYK+V': 'CMYK + Barniz',
                        'CMYK+W+V': 'CMYK + Blanco + Barniz'
                      };
                      handleChange({
                        tinta: value,
                        tinta_nombre: nombresMap[value] || value
                      });
                    }}
                  >
                    <option value="">Selecciona una tinta</option>
                    {tecnologia.tintas.map((tinta) => (
                      <option key={tinta} value={tinta}>
                        {tinta === 'K' ? 'Negro (K)' : tinta === 'CMYK' ? 'Cuatricromía (CMYK)' : tinta}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })()}
          </div>
        </Card>
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
                className={`p-4 cursor-pointer transition-all ${
                  localConfig.cara_impresa === 'solo_frente'
                    ? 'ring-2 ring-blue-600 bg-blue-50'
                    : 'hover:border-blue-300'
                }`}
                onClick={() => handleChange({ cara_impresa: 'solo_frente' })}
              >
                <h4 className="font-medium text-gray-900">Solo Frente</h4>
                <p className="text-sm text-gray-600 mt-1">Impresión en una sola cara</p>
              </Card>
            )}

            {config.caras_impresas.includes('frente_y_dorso') && (
              <Card
                className={`p-4 cursor-pointer transition-all ${
                  localConfig.cara_impresa === 'frente_y_dorso'
                    ? 'ring-2 ring-blue-600 bg-blue-50'
                    : 'hover:border-blue-300'
                }`}
                onClick={() => handleChange({ cara_impresa: 'frente_y_dorso' })}
              >
                <h4 className="font-medium text-gray-900">Frente y Dorso</h4>
                <p className="text-sm text-gray-600 mt-1">Impresión en ambas caras</p>
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
