import { Card } from '../../ui/card';
import { Badge } from '../../ui/Badge';
import { ConfigDetailRenderer } from '../../shared/ConfigDetailRenderer';
import { Package, Ruler, Layers, Wrench, Sparkles } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { SelectedConfiguration } from './ConfigurationStep';
import type { SelectedService, SelectedFinishing } from './ServicesAndFinishingsStep';
import type { ItemCopiadoConfig } from '../../centro-copiado/CentroCopiadoItemForm';
import { formatCurrency as globalFormatCurrency } from '../../../utils/stringUtils';

interface UniversalSummaryStepProps {
  config: ProductConfiguration;
  selectedConfig: SelectedConfiguration;
  selectedServicios: SelectedService[];
  selectedAcabados: SelectedFinishing[];
  precioBase: number | null;
  precioServicios: number;
  precioAcabados: number;
  precioTotal: number | null;
  isCalculatingPrice: boolean;
  centroCopiadoConfig?: Partial<ItemCopiadoConfig>;
  centroCopiadoPrice?: number;
}

export function UniversalSummaryStep({
  config,
  selectedConfig,
  selectedServicios,
  selectedAcabados,
  centroCopiadoConfig,
}: UniversalSummaryStepProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return globalFormatCurrency(value);
  };

  const hasMultipleLines = config.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0;

  // Centro de Copiado Logic
  if (config.categoria === 'Centro de Copiado' && centroCopiadoConfig) {
    const configCopiado = centroCopiadoConfig;

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Detalle Copiado</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Juegos:</span>
              <span className="font-medium">{configCopiado.cantidad_copias}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hojas por juego:</span>
              <span className="font-medium">{configCopiado.cantidad_hojas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Papel:</span>
              <span className="font-medium">{configCopiado.papel_detalle || configCopiado.papel_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tinta:</span>
              <Badge variant="outline">{configCopiado.tipo_tinta}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Caras:</span>
              <span className="font-medium capitalize">{configCopiado.cara_impresa}</span>
            </div>
            {configCopiado.observaciones && (
              <div className="pt-2 border-t mt-2">
                <span className="text-gray-500 block mb-1">Observaciones:</span>
                <p className="text-gray-700 italic">"{configCopiado.observaciones}"</p>
              </div>
            )}
          </div>
        </Card>

        {selectedServicios.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Extras</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedServicios.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{s.servicio_nombre}</span>
                  <Badge variant="secondary">{s.nivel_nombre}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Producto */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Producto</h3>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Nombre:</span>
            <span className="font-medium">{config.nombre}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Categoría:</span>
            <Badge variant="blue">{config.categoria}</Badge>
          </div>

          {config.es_compuesto && config.componentes && config.componentes.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block mb-2">Composición del Producto</span>
              <div className="space-y-2">
                {config.componentes.map((comp: any, idx: number) => (
                  <div key={idx} className="flex flex-col p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{comp.nombre}</span>
                      <Badge variant="default" size="sm">x{comp.cantidad}</Badge>
                    </div>
                    <div className="pt-2 border-t border-gray-200/50">
                      <ConfigDetailRenderer
                        config={comp.config || comp.configuracion}
                        tipoItem={comp.tipo_componente}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Configuración Común */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Configuración Común</h3>
        </div>

        <div className="space-y-2">
          {selectedConfig.material_nombre && (
            <div className="flex justify-between">
              <span className="text-gray-600">Material:</span>
              <span className="font-medium">
                {selectedConfig.material_nombre}
                {selectedConfig.variante_nombre && ` - ${selectedConfig.variante_nombre}`}
                {selectedConfig.espesor && (
                  ` (${selectedConfig.espesor}${selectedConfig.unidad_espesor || ''})`
                )}
              </span>
            </div>
          )}

          {selectedConfig.tecnologia_nombre && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tecnología:</span>
              <span className="font-medium">{selectedConfig.tecnologia_nombre}</span>
            </div>
          )}

          {selectedConfig.tinta_nombre && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tinta:</span>
              <span className="font-medium">{selectedConfig.tinta_nombre}</span>
            </div>
          )}

          {selectedConfig.cara_impresa && (
            <div className="flex justify-between">
              <span className="text-gray-600">Impresión:</span>
              <span className="font-medium capitalize">
                {selectedConfig.cara_impresa.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Extras (se aplican fuera del wizard via "Aplicar Servicio") */}
      {selectedServicios.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Extras</h3>
          </div>
          <div className="space-y-2">
            {selectedServicios.map((servicio, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-600">
                  {servicio.servicio_nombre}
                  {servicio.nivel_nombre && ` (${servicio.nivel_nombre})`}
                </span>
                <Badge variant="warning">{servicio.servicio_nombre}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Acabados Globales */}
      {selectedAcabados.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Acabados Globales</h3>
          </div>
          <div className="space-y-2">
            {selectedAcabados.map((acabado, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-600">
                  {acabado.acabado_nombre}
                  {acabado.nivel_nombre && ` (${acabado.nivel_nombre})`}
                </span>
                <Badge variant="success">{acabado.acabado_nombre}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Líneas de Producción / Cantidad */}
      {hasMultipleLines ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Líneas de Producción</h3>
          </div>
          <div className="space-y-4">
            {selectedConfig.lineas_medidas.map((linea, index) => (
              <div key={linea.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="font-semibold text-gray-900 mb-2">Línea {index + 1}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medidas:</span>
                    <span className="font-medium">
                      {config.tipo_venta_real === 'mt2'
                        ? `${linea.ancho}x${linea.alto} cm (${linea.mt2_calculado?.toFixed(2)} m²)`
                        : `${linea.metros_lineales} m × ${linea.ancho_seleccionado} cm`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cantidad:</span>
                    <span className="font-medium">{linea.cantidad} uds</span>
                  </div>
                  {linea.precio_total_linea && (
                    <div className="flex justify-between font-bold text-blue-600 mt-2 pt-2 border-t border-gray-200">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(linea.precio_total_linea)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Cantidad y Medidas</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Unidades Totales:</span>
              <span className="font-bold text-gray-900">{selectedConfig.cantidad}</span>
            </div>
            {(selectedConfig.medida_ancho || selectedConfig.medida_alto) && (
              <div className="flex justify-between">
                <span className="text-gray-600">Medidas:</span>
                <span className="font-medium">
                  {selectedConfig.medida_ancho} x {selectedConfig.medida_alto} cm
                </span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
