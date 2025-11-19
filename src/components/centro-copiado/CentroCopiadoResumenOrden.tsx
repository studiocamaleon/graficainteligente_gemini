import { DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCentroCopiadoTamanios } from '../../hooks/useCentroCopiadoTamanios';
import { useCentroCopiadoPapeles } from '../../hooks/useCentroCopiadoPapeles';
import type { ItemCopiadoConfig } from './CentroCopiadoItemForm';

interface CentroCopiadoResumenOrdenProps {
  items: Array<{ id: string; config: Partial<ItemCopiadoConfig>; precio?: number }>;
  descuento: number;
  onDescuentoChange: (descuento: number) => void;
  onGuardar: () => void;
  onCancelar: () => void;
  guardando: boolean;
}

export function CentroCopiadoResumenOrden({
  items,
  descuento,
  onDescuentoChange,
  onGuardar,
  onCancelar,
  guardando,
}: CentroCopiadoResumenOrdenProps) {
  const { tamanios } = useCentroCopiadoTamanios();
  const { papeles } = useCentroCopiadoPapeles();

  const itemsCompletos = items.filter(
    (item) =>
      item.config.tamanio_papel_id &&
      item.config.papel_id &&
      item.config.tipo_tinta &&
      item.config.cara_impresa &&
      item.config.cantidad_hojas &&
      item.config.cantidad_copias
  );

  const subtotal = items.reduce((sum, item) => sum + (item.precio || 0), 0);
  const montoDescuento = descuento > 0 ? (subtotal * descuento) / 100 : 0;
  const total = subtotal - montoDescuento;

  const puedeGuardar = itemsCompletos.length > 0 && !guardando;

  const getItemDescripcion = (item: { config: Partial<ItemCopiadoConfig> }) => {
    const config = item.config;
    const partes: string[] = [];

    const tamanio = tamanios.find(t => t.id === config.tamanio_papel_id);
    const papel = papeles.find(p => p.id === config.papel_id);

    if (tamanio) {
      partes.push(tamanio.nombre);
    }

    if (papel) {
      partes.push(papel.variante_nombre);
      if (papel.espesor && papel.unidad_espesor) {
        partes.push(`${papel.espesor}${papel.unidad_espesor}`);
      }
    }

    if (config.cantidad_hojas) {
      partes.push(`${config.cantidad_hojas}h`);
    }

    if (config.tipo_tinta === 'CMYK') {
      partes.push('Color');
    } else if (config.tipo_tinta === 'K') {
      partes.push('B/N');
    }

    if (config.cara_impresa === 'frente') {
      partes.push('1C');
    } else if (config.cara_impresa === 'frente_y_dorso') {
      partes.push('2C');
    }

    if (config.cantidad_copias && config.cantidad_copias > 1) {
      partes.push(`x${config.cantidad_copias}`);
    }

    if (config.anillado && config.anillado.tipo) {
      partes.push(`Anil.`);
    }

    if (config.plastificado && config.plastificado.tipo) {
      partes.push(`Plast.`);
    }

    return partes.join(' • ') || 'Sin configurar';
  };

  return (
    <div className="sticky top-20 z-10">
    <Card className="h-fit">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">Resumen de Orden</h3>
          <Badge variant="default">{items.length}</Badge>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay items agregados</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-2 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="primary" className="text-xs flex-shrink-0">
                        #{index + 1}
                      </Badge>
                      <span className="text-xs text-gray-700 line-clamp-2 break-words">
                        {getItemDescripcion(item)}
                      </span>
                    </div>
                    {item.precio !== undefined && (
                      <span className="text-xs font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                        ${item.precio.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {!itemsCompletos.find((i) => i.id === item.id) && (
                    <div className="flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600">Configuración incompleta</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${subtotal.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  Descuento (%)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={descuento || ''}
                    onChange={(e) => onDescuentoChange(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-600">%</span>
                </div>
                {montoDescuento > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-600">Monto descuento</span>
                    <span className="font-medium text-red-600">-${montoDescuento.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-xl font-bold text-green-600">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {itemsCompletos.length < items.length && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  Completa todos los items para poder guardar la orden
                </p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <Button
                variant="primary"
                onClick={onGuardar}
                disabled={!puedeGuardar}
                isLoading={guardando}
                className="w-full"
              >
                {guardando ? 'Guardando...' : 'Guardar Orden'}
              </Button>
              <Button
                variant="secondary"
                onClick={onCancelar}
                disabled={guardando}
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
    </div>
  );
}
