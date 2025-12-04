import { Package, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface OrdenItem {
  id?: string;
  tipo_item?: 'catalogo' | 'personalizado';
  producto_id: string | null;
  producto_nombre: string;
  producto_categoria?: string;
  cantidad: number;
  configuracion: any;
  precio_base: number;
  precio_servicios: number;
  precio_acabados: number;
  precio_servicios_globales?: number;
  precio_acabados_globales?: number;
  precio_unitario_final: number;
  precio_total: number;
  descuento_individual?: number;
  item_grupo_id?: string;
}

interface ItemsGrupoCardProps {
  items: OrdenItem[];
  onEliminarGrupo: () => void;
  onCantidadChange: (itemId: string, nuevaCantidad: number) => void;
  onDescuentoChange: (itemId: string, descuento: number) => void;
}

export function ItemsGrupoCard({
  items,
  onEliminarGrupo,
  onCantidadChange,
  onDescuentoChange,
}: ItemsGrupoCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (items.length === 0) return null;

  // Obtener servicios y acabados globales del primer item
  const primerItem = items[0];
  const serviciosGlobales = primerItem.configuracion?.servicios_globales_grupo || [];
  const acabadosGlobales = primerItem.configuracion?.acabados_globales_grupo || [];

  // Calcular totales del grupo
  const totalCantidad = items.reduce((sum, item) => sum + item.cantidad, 0);
  const totalPrecio = items.reduce((sum, item) => sum + item.precio_total, 0);
  const totalServiciosGlobales = items.reduce((sum, item) => sum + (item.precio_servicios_globales || 0), 0);
  const totalAcabadosGlobales = items.reduce((sum, item) => sum + (item.precio_acabados_globales || 0), 0);

  const renderConfiguracionLinea = (item: OrdenItem) => {
    const config = item.configuracion;
    if (!config) return null;

    const formatCaraImpresa = (cara: string) => {
      if (cara === '1/0') return 'Frente';
      if (cara === '1/1') return 'Frente y Dorso';
      if (cara === 'frente_y_dorso' || cara === 'solo_frente') return cara === 'frente_y_dorso' ? 'Frente y Dorso' : 'Frente';
      return cara;
    };

    const formatEspesorOGramaje = () => {
      if (config.espesor && config.unidad_espesor) {
        if (config.unidad_espesor === 'gr' || config.unidad_espesor === 'g') {
          return `${config.espesor} ${config.unidad_espesor}`;
        }
        return `${config.espesor}${config.unidad_espesor}`;
      }
      if (config.espesor) {
        return `${config.espesor}mm`;
      }
      if (config.gramaje) {
        return `${config.gramaje} g`;
      }
      return null;
    };

    const espesorFormateado = formatEspesorOGramaje();

    return (
      <div className="flex flex-wrap gap-1.5 text-sm text-gray-600">
        {(config.medida_ancho || config.medida_alto) && (
          <span>
            {config.medida_ancho && config.medida_alto
              ? `${config.medida_ancho}x${config.medida_alto} cm`
              : `${config.medida_ancho || config.medida_alto} cm`
            }
          </span>
        )}
        {config.material_nombre && (
          <>
            {(config.medida_ancho || config.medida_alto) && <span className="text-gray-400">|</span>}
            <span>
              {config.material_nombre}
              {config.variante_nombre && ` - ${config.variante_nombre}`}
            </span>
          </>
        )}
        {espesorFormateado && (
          <>
            <span className="text-gray-400">|</span>
            <span>{espesorFormateado}</span>
          </>
        )}
        {config.tecnologia_nombre && (
          <>
            <span className="text-gray-400">|</span>
            <span>{config.tecnologia_nombre}</span>
          </>
        )}
        {config.tinta_nombre && (
          <>
            <span className="text-gray-400">|</span>
            <span>{config.tinta_nombre}</span>
          </>
        )}
        {config.cara_impresa && (
          <>
            <span className="text-gray-400">|</span>
            <span>{formatCaraImpresa(config.cara_impresa)}</span>
          </>
        )}
        {config.color && (
          <>
            <span className="text-gray-400">|</span>
            <span>{config.color}</span>
          </>
        )}
        {config.marca && (
          <>
            <span className="text-gray-400">|</span>
            <span>{config.marca}</span>
          </>
        )}

        {/* Servicios por item (si existen) */}
        {config.servicios_seleccionados && config.servicios_seleccionados.length > 0 && (
          <>
            <span className="text-gray-400">|</span>
            {config.servicios_seleccionados.map((s: any, idx: number) => (
              <Badge key={`servicio-${idx}`} variant="blue" size="sm">
                {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
              </Badge>
            ))}
          </>
        )}

        {/* Acabados por item (si existen) */}
        {config.acabados_seleccionados && config.acabados_seleccionados.length > 0 && (
          <>
            <span className="text-gray-400">|</span>
            {config.acabados_seleccionados.map((a: any, idx: number) => (
              <Badge key={`acabado-${idx}`} variant="purple" size="sm">
                {a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre}
              </Badge>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="p-4">
        {/* Header del Grupo */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-gray-900">
                  Grupo de Items - {primerItem.producto_nombre}
                </h4>
                <Badge variant="primary" size="sm">{items.length} líneas</Badge>
              </div>
              <div className="text-sm text-gray-600">
                {totalCantidad} unidades totales
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right mr-4">
              <div className="text-xs text-gray-500 mb-0.5">Total del Grupo</div>
              <div className="text-xl font-bold text-blue-600">
                ${totalPrecio.toFixed(2)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onEliminarGrupo}
              title="Eliminar todo el grupo"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Servicios y Acabados Globales del Grupo */}
        {(serviciosGlobales.length > 0 || acabadosGlobales.length > 0) && (
          <div className="mb-3 p-3 bg-white rounded-lg border border-blue-200">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
              Servicios/Acabados Aplicados al Grupo Completo
            </div>
            <div className="flex flex-wrap gap-2">
              {serviciosGlobales.map((s: any, idx: number) => (
                <Badge key={`servicio-global-${idx}`} variant="blue" className="text-sm">
                  {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                  {totalServiciosGlobales > 0 && idx === serviciosGlobales.length - 1 && (
                    <span className="ml-2 font-semibold">
                      ${totalServiciosGlobales.toFixed(2)}
                    </span>
                  )}
                </Badge>
              ))}
              {acabadosGlobales.map((a: any, idx: number) => (
                <Badge key={`acabado-global-${idx}`} variant="purple" className="text-sm">
                  {a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre}
                  {totalAcabadosGlobales > 0 && idx === acabadosGlobales.length - 1 && (
                    <span className="ml-2 font-semibold">
                      ${totalAcabadosGlobales.toFixed(2)}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2 italic">
              Estos servicios se aplican una sola vez al grupo completo y se distribuyen proporcionalmente
            </div>
          </div>
        )}

        {/* Detalle de Líneas (Items individuales) */}
        {isExpanded && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Líneas del Grupo
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Cantidad */}
                  <div className="flex-shrink-0">
                    <label className="text-xs text-gray-500 block mb-1">Cantidad</label>
                    <Input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => onCantidadChange(item.id!, parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                  </div>

                  {/* Configuración */}
                  <div className="flex-1">
                    {renderConfiguracionLinea(item)}
                  </div>

                  {/* Precios */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-500 mb-1">Unitario</div>
                    <div className="font-medium text-gray-900 mb-2">
                      ${item.precio_unitario_final.toFixed(2)}
                    </div>
                    {(item.precio_servicios_globales || item.precio_acabados_globales) && (
                      <div className="text-xs text-blue-600 mb-1">
                        +${((item.precio_servicios_globales || 0) + (item.precio_acabados_globales || 0)).toFixed(2)} globales
                      </div>
                    )}
                  </div>

                  {/* Descuento */}
                  <div className="flex-shrink-0">
                    <label className="text-xs text-gray-500 block mb-1">Desc. %</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.descuento_individual || 0}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          const numValue = parseFloat(value) || 0;
                          if (numValue >= 0 && numValue <= 100) {
                            onDescuentoChange(item.id!, numValue);
                          }
                        }}
                        className="w-16 text-center"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-500 mb-1">Total Línea</div>
                    <div className="font-semibold text-lg text-blue-600">
                      ${item.precio_total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
