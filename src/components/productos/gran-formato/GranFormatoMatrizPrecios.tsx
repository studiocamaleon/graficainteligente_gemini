import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '../../ui/Input';
import type { RangoPrecio, PrecioGFInput } from '../../../hooks/useAllProductosGranFormatoPrecios';
import { normalizeRangoMax, normalizeRangoMin, formatRangoValue, isInfiniteRango } from '../../../utils/rangoUtils';

interface ProductoEnTabla {
  id: string;
  nombre: string;
  tipo_venta?: 'mt2' | 'mt_lineal';
  ancho_fijo?: number;
}

interface Props {
  productos: ProductoEnTabla[];
  tecnologiaId: string;
  tinta: string;
  rangos: RangoPrecio[];
  unidadMedida: string;
  preciosActuales: Map<string, Map<string, number>>;
  onPreciosChange: (precios: PrecioGFInput[]) => void;
  readonly?: boolean;
}

interface PrecioState {
  [key: string]: number; // key format: "productoId-rangoKey"
}

export function GranFormatoMatrizPrecios({
  productos,
  tecnologiaId,
  tinta,
  rangos,
  unidadMedida,
  preciosActuales,
  onPreciosChange,
  readonly = false,
}: Props) {
  const [preciosState, setPreciosState] = useState<PrecioState>({});
  const isInitialized = useRef(false);
  const hasLocalChanges = useRef(false);

  const getRangoKey = (rango: RangoPrecio) => {
    const min = normalizeRangoMin(rango.min);
    const max = normalizeRangoMax(rango.max);
    return `${min}-${max}`;
  };

  // Initialize state from existing prices only once
  useEffect(() => {
    if (isInitialized.current) return;

    const initialState: PrecioState = {};

    productos.forEach((producto) => {
      const preciosProducto = preciosActuales.get(producto.id);
      if (preciosProducto) {
        rangos.forEach((rango) => {
          const rangoKey = getRangoKey(rango);
          const precio = preciosProducto.get(rangoKey);
          if (precio !== undefined) {
            const key = `${producto.id}-${rangoKey}`;
            initialState[key] = precio;
          }
        });
      }
    });

    setPreciosState(initialState);
    isInitialized.current = true;
  }, []);

  const handlePrecioChange = (productoId: string, rango: RangoPrecio, value: string) => {
    const rangoKey = getRangoKey(rango);
    const key = `${productoId}-${rangoKey}`;
    const precio = parseFloat(value) || 0;

    hasLocalChanges.current = true;

    const newState = {
      ...preciosState,
      [key]: precio,
    };

    setPreciosState(newState);
  };

  // Notify parent of changes after state updates (not during render)
  useEffect(() => {
    if (!isInitialized.current || !hasLocalChanges.current) return;

    // Build array of all precios for this table
    const preciosArray: PrecioGFInput[] = [];

    productos.forEach((producto) => {
      rangos.forEach((r) => {
        const rKey = getRangoKey(r);
        const k = `${producto.id}-${rKey}`;
        const p = preciosState[k] || 0;

        if (p > 0) {
          preciosArray.push({
            producto_gran_formato_id: producto.id,
            tecnologia_id: tecnologiaId,
            tinta,
            rango_precio_min: normalizeRangoMin(r.min),
            rango_precio_max: normalizeRangoMax(r.max),
            precio: p,
          });
        }
      });
    });

    onPreciosChange(preciosArray);
  }, [preciosState, productos, rangos, tecnologiaId, tinta, onPreciosChange]);

  const getUnidadLabel = () => {
    if (unidadMedida === 'mt2') return 'm²';
    if (unidadMedida === 'mt_lineal') return 'ml';
    return 'unidades';
  };

  const formatRango = (rango: RangoPrecio) => {
    const unidad = getUnidadLabel();
    const min = normalizeRangoMin(rango.min);
    const max = normalizeRangoMax(rango.max);
    return formatRangoValue(min, max, unidad);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 w-64 min-w-[256px]">
              Producto
            </th>
            {rangos.map((rango, index) => (
              <th
                key={index}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {formatRango(rango)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productos.map((producto) => (
            <tr key={producto.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 w-64 min-w-[256px]">
                <div className="truncate" title={producto.nombre}>
                  {producto.nombre}
                </div>
                {producto.tipo_venta === 'mt_lineal' && producto.ancho_fijo && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                      {producto.ancho_fijo} cm
                    </span>
                  </div>
                )}
              </td>
              {rangos.map((rango, rangoIndex) => {
                const rangoKey = getRangoKey(rango);
                const key = `${producto.id}-${rangoKey}`;
                const valor = preciosState[key] || 0;

                return (
                  <td key={rangoIndex} className="px-4 py-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={valor > 0 ? valor : ''}
                      onChange={(e) => handlePrecioChange(producto.id, rango, e.target.value)}
                      placeholder="$"
                      className="w-full"
                      disabled={readonly}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
