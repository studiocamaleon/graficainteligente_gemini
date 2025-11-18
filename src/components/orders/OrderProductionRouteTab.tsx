import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Route, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ItemRouteEditor } from './ItemRouteEditor';
import { EmptyState } from '../ui/EmptyState';
import { useOrdenItemRutas } from '../../hooks/useOrdenItemRutas';

interface OrdenItem {
  id: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
}

interface OrderProductionRouteTabProps {
  items: OrdenItem[];
  readonly?: boolean;
}

export function OrderProductionRouteTab({ items, readonly = false }: OrderProductionRouteTabProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [itemsWithRoutes, setItemsWithRoutes] = useState<Map<string, number>>(new Map());

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleRouteCountChange = useCallback((itemId: string, count: number) => {
    setItemsWithRoutes(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, count);
      return newMap;
    });
  }, []);

  useEffect(() => {
    if (items.length === 1) {
      setExpandedItems(new Set([items[0].id]));
    } else if (items.length > 0 && expandedItems.size === 0) {
      setExpandedItems(new Set([items[0].id]));
    }
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Route}
          title="No hay items en la orden"
          description="Agrega productos a esta orden para configurar sus rutas de producción"
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Rutas de Producción</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configura la secuencia de producción de cada item y agrega comentarios para los operadores
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{items.length}</span>
            <span>{items.length === 1 ? 'producto' : 'productos'}</span>
          </div>
        </div>

        {!readonly && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Instrucciones</p>
              <ul className="text-blue-700 space-y-1 list-disc list-inside">
                <li>Las rutas se generan automáticamente desde las plantillas de productos</li>
                <li>Puedes agregar, eliminar o reordenar pasos según necesites</li>
                <li>Los comentarios en cada paso son visibles para los operadores de producción</li>
                <li>Los cambios se guardan automáticamente al confirmar la orden</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <ItemRouteCard
            key={item.id}
            item={item}
            index={index}
            isExpanded={expandedItems.has(item.id)}
            onToggle={() => toggleExpanded(item.id)}
            readonly={readonly}
            onRouteCountChange={handleRouteCountChange}
          />
        ))}
      </div>
    </div>
  );
}

interface ItemRouteCardProps {
  item: OrdenItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  readonly: boolean;
  onRouteCountChange: (itemId: string, count: number) => void;
}

function ItemRouteCard({
  item,
  index,
  isExpanded,
  onToggle,
  readonly,
  onRouteCountChange,
}: ItemRouteCardProps) {
  const { rutas, loading } = useOrdenItemRutas({ ordenItemId: item.id });

  useEffect(() => {
    if (!loading) {
      onRouteCountChange(item.id, rutas.length);
    }
  }, [rutas.length, loading, item.id, onRouteCountChange]);

  const tienePasoPrincipal = rutas.some(r => r.tipo_etapa === 'principal');
  const tieneComentarios = rutas.some(r => r.comentario_vendedor);

  return (
    <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex-shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-gray-900">{item.producto_nombre}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm text-gray-500">Cantidad: {item.cantidad}</span>
              {loading ? (
                <span className="text-xs text-gray-400">Cargando ruta...</span>
              ) : (
                <>
                  <span className="text-sm text-gray-500">
                    {rutas.length} {rutas.length === 1 ? 'paso' : 'pasos'}
                  </span>
                  {!tienePasoPrincipal && rutas.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      Sin etapa principal
                    </span>
                  )}
                  {tieneComentarios && (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <CheckCircle2 className="w-3 h-3" />
                      Con comentarios
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="ml-3">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
              <ItemRouteEditor
                ordenItemId={item.id}
                productoId={item.producto_id}
                productoNombre={item.producto_nombre}
                readonly={readonly}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
