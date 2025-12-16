import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Table } from '../../ui/Table';
import { Package, Ruler, Layers, Palette, Wrench, Sparkles, DollarSign } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { SelectedConfiguration } from './ConfigurationStep';
import type { SelectedService, SelectedFinishing } from './ServicesAndFinishingsStep';

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
}

export function UniversalSummaryStep({
  config,
  selectedConfig,
  selectedServicios,
  selectedAcabados,
  precioBase,
  precioServicios,
  precioAcabados,
  precioTotal,
  isCalculatingPrice
}: UniversalSummaryStepProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return `$${value.toFixed(2)}`;
  };

  // Nota: Ya no necesitamos funciones para obtener nombres
  // porque los servicios y acabados de cada línea ya contienen toda la información

  // Determinar si hay múltiples líneas
  const hasMultipleLines = config.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0;

  // Calcular totales para múltiples líneas
  const totalUnidades = hasMultipleLines
    ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + line.cantidad, 0)
    : selectedConfig.cantidad;

  const totalMT2 = hasMultipleLines
    ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + (line.mt2_calculado || 0) * line.cantidad, 0)
    : 0;

  const totalMetrosLineales = hasMultipleLines
    ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + (line.metros_lineales || 0) * line.cantidad, 0)
    : 0;

  const totalPrecioGeneral = hasMultipleLines
    ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + (line.precio_total_linea || 0), 0)
    : precioTotal !== null ? precioTotal * selectedConfig.cantidad : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Resumen del Pedido</h2>
        <p className="text-gray-600">
          Revisa los detalles antes de agregar {hasMultipleLines ? 'los items' : 'el item'} a la orden
        </p>
      </div>

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
                {selectedConfig.espesor && selectedConfig.unidad_espesor && (
                  selectedConfig.unidad_espesor === 'gr' || selectedConfig.unidad_espesor === 'g'
                    ? ` (${selectedConfig.espesor} ${selectedConfig.unidad_espesor})`
                    : ` (${selectedConfig.espesor}${selectedConfig.unidad_espesor})`
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
              <span className="font-medium">
                {selectedConfig.cara_impresa === 'solo_frente' ? 'Solo Frente' : 'Frente y Dorso'}
              </span>
            </div>
          )}

          {selectedConfig.color && (
            <div className="flex justify-between">
              <span className="text-gray-600">Color:</span>
              <span className="font-medium">{selectedConfig.color}</span>
            </div>
          )}

          {selectedConfig.marca && (
            <div className="flex justify-between">
              <span className="text-gray-600">Marca:</span>
              <span className="font-medium">{selectedConfig.marca}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Servicios Globales */}
      {selectedServicios.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Servicios Globales</h3>
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

      {/* Líneas de Producción (para múltiples líneas) */}
      {hasMultipleLines ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Líneas de Producción</h3>
          </div>

          <div className="space-y-4">
            {selectedConfig.lineas_medidas.map((linea, index) => (
              <div key={linea.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="font-semibold text-gray-900 mb-3">
                  Línea {index + 1}
                </div>

                <div className="space-y-2 text-sm">
                  {/* Medidas */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medidas:</span>
                    <span className="font-medium">
                      {config.tipo_venta_real === 'mt2' ? (
                        <>
                          {linea.ancho}x{linea.alto} cm
                          <Badge variant="info" size="sm" className="ml-2">
                            {linea.mt2_calculado?.toFixed(2)} MT2
                          </Badge>
                        </>
                      ) : (
                        <>
                          {linea.metros_lineales} mts × {linea.ancho_seleccionado} cm
                        </>
                      )}
                    </span>
                  </div>

                  {/* Cantidad */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cantidad:</span>
                    <span className="font-medium">{linea.cantidad} unidades</span>
                  </div>

                  {/* Servicios */}
                  {linea.servicios && linea.servicios.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-gray-600">Servicios:</span>
                      <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                        {linea.servicios.map((servicio) => (
                          <Badge key={servicio.servicio_id} variant="warning" size="sm">
                            {servicio.servicio_nombre}
                            {servicio.nivel_nombre && ` (${servicio.nivel_nombre})`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Acabados */}
                  {linea.acabados && linea.acabados.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-gray-600">Acabados:</span>
                      <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                        {linea.acabados.map((acabado) => (
                          <Badge key={acabado.acabado_id} variant="success" size="sm">
                            {acabado.acabado_nombre}
                            {acabado.nivel_nombre && ` (${acabado.nivel_nombre})`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Precios */}
                  {linea.precio_total_linea && (
                    <div className="pt-2 border-t border-gray-300 mt-2">
                      <div className="flex justify-between font-semibold text-blue-600">
                        <span>Subtotal Línea:</span>
                        <span>{formatCurrency(linea.precio_total_linea)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <>
          {/* Cantidad para productos sin múltiples líneas */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Cantidad</h3>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Unidades:</span>
              <span className="font-medium">{selectedConfig.cantidad}</span>
            </div>

            {selectedConfig.medida_ancho && selectedConfig.medida_alto && (
              <div className="flex justify-between mt-2">
                <span className="text-gray-600">Medidas:</span>
                <span className="font-medium">
                  {selectedConfig.medida_ancho} x {selectedConfig.medida_alto} {config.unidad_medida || ((config.categoria === 'Impresion Laser') ? 'mm' : 'cm')}
                </span>
              </div>
            )}
          </Card>


        </>
      )}

      {/* Total General */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Total General</h3>
        </div>

        {isCalculatingPrice ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Calculando precio...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Unidades:</span>
              <span className="text-xl font-bold text-gray-900">{totalUnidades}</span>
            </div>

            {config.tipo_venta_real === 'mt2' && totalMT2 > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total MT2:</span>
                <span className="text-xl font-bold text-gray-900">{totalMT2.toFixed(2)}</span>
              </div>
            )}

            {config.tipo_venta_real === 'mt_lineal' && totalMetrosLineales > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total Metros Lineales:</span>
                <span className="text-xl font-bold text-gray-900">{totalMetrosLineales.toFixed(2)}</span>
              </div>
            )}

            {!hasMultipleLines && (
              <>
                <div className="flex justify-between items-center text-sm border-t pt-2">
                  <span className="text-gray-600">Precio Base (unitario):</span>
                  <span className="font-medium">{formatCurrency(precioBase)}</span>
                </div>

                {precioServicios > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Servicios (unitario):</span>
                    <span className="font-medium">{formatCurrency(precioServicios)}</span>
                  </div>
                )}

                {precioAcabados > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Acabados (unitario):</span>
                    <span className="font-medium">{formatCurrency(precioAcabados)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Precio Unitario:</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(precioTotal)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center pt-3 border-t-2 border-blue-300">
              <span className="text-lg font-semibold text-gray-900">TOTAL PRECIO:</span>
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalPrecioGeneral)}
              </span>
            </div>

            {config.impuesto_iva > 0 && (
              <div className="text-sm text-gray-600 text-right">
                + IVA {config.impuesto_iva}%
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
