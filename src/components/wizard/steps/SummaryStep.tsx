import { Package, Ruler, Palette, FileText, Wrench, Sparkles, AlertTriangle } from 'lucide-react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/Badge';
import type { ImpresionLaserConfig } from '../../../types/wizard';

interface SummaryStepProps {
  config: ImpresionLaserConfig;
}

export function SummaryStep({ config }: SummaryStepProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Resumen</h2>
        <p className="text-gray-600">
          Revise la configuración antes de agregar a la orden
        </p>
      </div>

      {!config.tiene_precio_configurado && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Precio no configurado</p>
            <p className="text-xs mt-1">
              Este producto no tiene precio configurado para la combinación seleccionada.
              El item se agregará con precio $0. Deberá configurar los precios antes de producir.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Producto</h3>
          </div>
          <div className="space-y-2">
            <p className="text-gray-900 font-medium">{config.producto_nombre}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{config.categoria_nombre}</Badge>
              {config.material_nombre && config.variante_nombre && (
                <Badge variant="outline">
                  {config.material_nombre} {config.variante_nombre}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Especificaciones</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cantidad:</span>
              <span className="font-medium text-gray-900">{config.cantidad} unidades</span>
            </div>
            {config.medida_ancho && config.medida_alto && (
              <div className="flex justify-between">
                <span className="text-gray-600">Medida:</span>
                <span className="font-medium text-gray-900">
                  {config.medida_ancho} × {config.medida_alto} cm
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Configuración de Impresión</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Tipo de tinta:</span>
              <span className="font-medium text-gray-900">
                {config.tipo_tinta === 'CMYK'
                  ? 'Full Color (CMYK)'
                  : config.tipo_tinta === 'COLOR'
                    ? 'Color'
                    : 'Blanco y Negro (K)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Caras impresas:</span>
              <span className="font-medium text-gray-900">
                {config.cara_impresa === 'solo_frente' ? 'Solo Frente' : 'Frente y Dorso'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Precio</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Precio base:</span>
              <span className="font-medium text-gray-900">{formatCurrency(config.precio_base)}</span>
            </div>
            {config.precio_servicios > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Extras:</span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(config.precio_servicios)}
                </span>
              </div>
            )}
            {config.precio_acabados > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Acabados:</span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(config.precio_acabados)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-900 font-semibold">Precio unitario:</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(config.precio_total)}
                </span>
              </div>
              {config.cantidad && config.precio_total && (
                <div className="flex justify-between mt-1">
                  <span className="text-gray-600">Total:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(config.precio_total * config.cantidad)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {config.servicios_seleccionados.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Extras Seleccionados</h3>
          </div>
          <div className="space-y-2">
            {config.servicios_seleccionados.map((servicio, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-gray-900">
                  {servicio.servicio_nombre}
                  {servicio.nivel_nombre && (
                    <span className="text-gray-600 ml-1">({servicio.nivel_nombre})</span>
                  )}
                </span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(servicio.impacto_calculado)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {config.acabados_seleccionados.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Acabados Seleccionados</h3>
          </div>
          <div className="space-y-2">
            {config.acabados_seleccionados.map((acabado, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-gray-900">
                  {acabado.acabado_nombre}
                  {acabado.nivel_nombre && (
                    <span className="text-gray-600 ml-1">({acabado.nivel_nombre})</span>
                  )}
                </span>
                <span className="font-medium text-green-600">
                  +{formatCurrency(acabado.impacto_calculado)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
