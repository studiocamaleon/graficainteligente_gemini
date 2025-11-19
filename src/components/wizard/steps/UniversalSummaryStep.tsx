import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Resumen del Item</h2>
        <p className="text-gray-600">
          Revisa los detalles antes de agregar el item a la orden
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
          <div className="flex justify-between">
            <span className="text-gray-600">Cantidad:</span>
            <span className="font-medium">{selectedConfig.cantidad}</span>
          </div>
        </div>
      </Card>

      {/* Configuración */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ruler className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Configuración</h3>
        </div>

        <div className="space-y-2">
          {selectedConfig.medida_ancho && selectedConfig.medida_alto && (
            <div className="flex justify-between">
              <span className="text-gray-600">Medidas:</span>
              <span className="font-medium">
                {selectedConfig.medida_ancho} x {selectedConfig.medida_alto} cm
              </span>
            </div>
          )}

          {selectedConfig.material_nombre && (
            <div className="flex justify-between">
              <span className="text-gray-600">Material:</span>
              <span className="font-medium">
                {selectedConfig.material_nombre}
                {selectedConfig.variante_nombre && ` - ${selectedConfig.variante_nombre}`}
                {selectedConfig.espesor && ` (${selectedConfig.espesor}mm)`}
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

      {/* Servicios */}
      {selectedServicios.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Servicios</h3>
          </div>

          <div className="space-y-2">
            {selectedServicios.map((servicio, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-600">
                  {servicio.servicio_nombre}
                  {servicio.nivel_nombre && ` - ${servicio.nivel_nombre}`}
                </span>
                <span className="font-medium">
                  {servicio.valor_porcentaje && `${servicio.valor_porcentaje}%`}
                  {servicio.valor_porcentaje && servicio.valor_monto && ' + '}
                  {servicio.valor_monto && `$${servicio.valor_monto}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Acabados */}
      {selectedAcabados.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Acabados</h3>
          </div>

          <div className="space-y-2">
            {selectedAcabados.map((acabado, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-600">
                  {acabado.acabado_nombre}
                  {acabado.nivel_nombre && ` - ${acabado.nivel_nombre}`}
                </span>
                <span className="font-medium">
                  {acabado.valor_porcentaje && `${acabado.valor_porcentaje}%`}
                  {acabado.valor_porcentaje && acabado.valor_monto && ' + '}
                  {acabado.valor_monto && `$${acabado.valor_monto}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Precios */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Precios</h3>
        </div>

        {isCalculatingPrice ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Calculando precio...</span>
          </div>
        ) : precioTotal !== null ? (
          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>Precio base:</span>
              <span className="font-medium">{formatCurrency(precioBase)}</span>
            </div>

            {precioServicios > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Servicios:</span>
                <span className="font-medium">{formatCurrency(precioServicios)}</span>
              </div>
            )}

            {precioAcabados > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Acabados:</span>
                <span className="font-medium">{formatCurrency(precioAcabados)}</span>
              </div>
            )}

            <div className="pt-3 border-t-2 border-blue-300">
              <div className="flex justify-between">
                <span className="text-lg font-semibold text-gray-900">Precio unitario:</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(precioTotal)}</span>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between">
                <span className="text-lg font-semibold text-gray-900">Total ({selectedConfig.cantidad} {selectedConfig.cantidad === 1 ? 'unidad' : 'unidades'}):</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(precioTotal * selectedConfig.cantidad)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-yellow-600 font-medium">
              ⚠️ No se pudo calcular el precio
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Verifica que el producto tenga precios configurados
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
