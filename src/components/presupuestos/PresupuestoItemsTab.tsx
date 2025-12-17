import { Package, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { PresupuestoItem } from '../../types/presupuestos';

interface PresupuestoItemsTabProps {
  items: PresupuestoItem[];
  presupuestoId?: string;
  esEditable?: boolean;
}

export function PresupuestoItemsTab({ items, presupuestoId, esEditable = false }: PresupuestoItemsTabProps) {
  const formatCurrency = (value: number | null) => {
    if (value === null) return 'Por Cotizar';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No hay items"
        description="Este presupuesto no tiene items agregados"
      />
    );
  }

  // Separar items con y sin precio
  const itemsCompletos = items.filter(
    (item) => item.precio_unitario_final !== null && item.precio_total !== null
  );
  const itemsPendientes = items.filter(
    (item) => item.precio_unitario_final === null || item.precio_total === null
  );

  const total = itemsCompletos.reduce((sum, item) => sum + Number(item.precio_total), 0);

  const tienePendientes = itemsPendientes.length > 0;
  const esPendiente = (item: PresupuestoItem) =>
    item.precio_unitario_final === null || item.precio_total === null;

  // Helper to render config details
  const renderConfiguracion = (config: any, tipoItem?: string) => {
    if (!config) return null;

    // Lógica específica para Centro de Copiado
    if (tipoItem === 'centro_copiado') {
      return (
        <div className="space-y-1 text-xs text-gray-600 mt-1">
          {/* Info Copias/Hojas */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{config.cantidad_copias} juegos</span>
            <span className="text-gray-300">|</span>
            <span>{config.cantidad_hojas} hojas orig.</span>
          </div>

          {/* Info Papel/Tinta */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {config.tamanio_nombre && <Badge variant="outline" className="text-[10px] h-5">{config.tamanio_nombre}</Badge>}
            {config.papel_detalle && <Badge variant="outline" className="text-[10px] h-5">{config.papel_detalle}</Badge>}
            <Badge variant={config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'purple' : 'gray'} className="text-[10px] h-5">
              {config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'Color' : 'B/N'}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              {config.cara_impresa === 'frente_y_dorso' || config.cara_impresa === 'doble' || config.cara_impresa === '1/1' ? 'Doble Faz' : 'Simple Faz'}
            </Badge>
          </div>

          {/* Terminaciones (Anillado, Plastificado, Guillotinado) */}
          {(config.anillado || config.plastificado || config.guillotinado || config.abrochado || config.corte || config.dobladillo) && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {config.anillado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Anillado {config.anillado.tipo}</Badge>
              )}
              {config.plastificado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Plastificado {config.plastificado.tipo}</Badge>
              )}
              {config.guillotinado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Guillotinado</Badge>
              )}
              {config.abrochado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Abrochado</Badge>
              )}
              {config.corte && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Corte</Badge>
              )}
              {config.dobladillo && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Dobladillo</Badge>
              )}
            </div>
          )}

          {/* Servicios y Acabados Extra */}
          {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
            (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100">
                {config.servicios_seleccionados?.map((s: any, idx: number) => (
                  <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                    {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                  </Badge>
                ))}
                {config.acabados_seleccionados?.map((a: any, idx: number) => (
                  <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                    {a.nombre}
                  </Badge>
                ))}
              </div>
            )}
        </div>
      );
    }

    // Standard Render Logic (Existing)
    const hasServices = (config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
      (config.acabados_seleccionados && config.acabados_seleccionados.length > 0);

    if (!hasServices) return null;

    return (
      <div className="space-y-1 mt-0.5">
        {/* Services Badges */}
        <div className="flex flex-wrap gap-1 mt-1">
          {config.servicios_seleccionados?.map((s: any, idx: number) => (
            <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
              {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
            </Badge>
          ))}
          {config.acabados_seleccionados?.map((a: any, idx: number) => (
            <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
              {a.nombre}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Banner informativo si hay items pendientes */}
      {tienePendientes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">
              Cotización Incompleta
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Hay {itemsPendientes.length} item(s) sin precio asignado. El total calculado es parcial.
            </p>
          </div>
        </div>
      )}

      {/* Tabla de Items - Minimalista */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left w-2/5">Item / Descripción</th>
              <th className="px-6 py-4 text-right">Cantidad</th>
              <th className="px-6 py-4 text-right">Unitario</th>
              <th className="px-6 py-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const isPendiente = esPendiente(item);

              return (
                <tr
                  key={item.id}
                  className={`group hover:bg-gray-50 transition-colors ${isPendiente ? 'bg-amber-50/30' : ''}`}
                >
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-base ${isPendiente ? 'text-amber-800' : 'text-gray-900'}`}>
                          {item.producto_nombre}
                        </span>
                        {isPendiente && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Pendiente</span>}
                        {item.tipo_item === 'item_personalizado' && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Personalizado</span>}
                        {item.tipo_item === 'centro_copiado' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Centro de Copiado</span>}
                      </div>
                      {item.descripcion && (
                        <p className="text-gray-500 text-xs leading-relaxed max-w-lg">
                          {item.descripcion}
                        </p>
                      )}
                      {item.producto_categoria && (
                        <span className="inline-block text-[10px] text-gray-400 font-medium uppercase mt-1">
                          {item.producto_categoria}
                        </span>
                      )}
                    </div>
                    {/* Render Configuration Details */}
                    {renderConfiguracion(item.configuracion, item.tipo_item)}
                  </td>
                  <td className="px-6 py-4 text-right align-top text-gray-600 font-medium pt-5">
                    {item.cantidad} <span className="text-xs font-normal text-gray-400">u.</span>
                  </td>
                  <td className="px-6 py-4 text-right align-top text-gray-600 pt-5">
                    {isPendiente ? (
                      <span className="text-amber-600 italic text-xs">A definir</span>
                    ) : (
                      formatCurrency(item.precio_unitario_final)
                    )}
                  </td>
                  <td className="px-6 py-4 text-right align-top pt-5">
                    {isPendiente ? (
                      <span className="text-gray-300">-</span>
                    ) : (
                      <span className="font-bold text-gray-900">{formatCurrency(item.precio_total)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totales Section */}
      <div className="flex justify-end pt-4">
        <div className="w-full md:w-1/3 space-y-3">
          {tienePendientes && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Items cotizados ({itemsCompletos.length})</span>
              <span className="font-medium text-gray-700">{formatCurrency(total)}</span>
            </div>
          )}

          <div className="flex justify-between items-end border-t border-gray-100 pt-4">
            <div>
              <span className="block text-sm font-medium text-gray-500 uppercase tracking-wide">Total Estimado</span>
              {tienePendientes && <span className="text-xs text-amber-600 block mt-1">* Parcial (faltan precios)</span>}
            </div>
            <span className="text-3xl font-bold text-gray-900 tracking-tight">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
