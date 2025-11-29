import { useState, useEffect, useRef } from 'react';
import { Input } from '../../ui/Input';
import type { ProductoPorAncho, PrecioPCInput } from '../../../hooks/useAllProductosPlotterCortePrecios';
import { normalizeRangoMax, normalizeRangoMin, formatRangoValue } from '../../../utils/rangoUtils';

interface Props {
  productosPorAncho: ProductoPorAncho[];
  onPreciosChange: (precios: PrecioPCInput[]) => void;
  readonly?: boolean;
}

interface PrecioState {
  [key: string]: number;
}

export function PlotterCorteMatrizPrecios({ productosPorAncho, onPreciosChange, readonly = false }: Props) {
  const [preciosState, setPreciosState] = useState<PrecioState>({});
  const isInitialized = useRef(false);
  const hasLocalChanges = useRef(false);

  const getRangoKey = (min: number, max: number) => {
    const normalizedMin = normalizeRangoMin(min);
    const normalizedMax = normalizeRangoMax(max);
    return `${normalizedMin}-${normalizedMax}`;
  };

  useEffect(() => {
    if (isInitialized.current) return;

    const initialState: PrecioState = {};

    productosPorAncho.forEach(item => {
      if (item.precios) {
        item.rangos.forEach(rango => {
          const rangoKey = getRangoKey(rango.min, rango.max);
          const precio = item.precios!.get(rangoKey);
          if (precio !== undefined) {
            const key = `${item.producto_id}-${item.ancho}-${rangoKey}`;
            initialState[key] = precio;
          }
        });
      }
    });

    setPreciosState(initialState);
    isInitialized.current = true;
  }, []);

  const handlePrecioChange = (
    productoId: string,
    ancho: number,
    min: number,
    max: number,
    value: string
  ) => {
    const rangoKey = getRangoKey(min, max);
    const key = `${productoId}-${ancho}-${rangoKey}`;
    const precio = parseFloat(value) || 0;

    hasLocalChanges.current = true;

    const newState = {
      ...preciosState,
      [key]: precio,
    };

    setPreciosState(newState);
  };

  useEffect(() => {
    if (!isInitialized.current || !hasLocalChanges.current) return;

    const preciosArray: PrecioPCInput[] = [];

    productosPorAncho.forEach(item => {
      item.rangos.forEach(rango => {
        const rangoKey = getRangoKey(rango.min, rango.max);
        const key = `${item.producto_id}-${item.ancho}-${rangoKey}`;
        const precio = preciosState[key] || 0;

        if (precio > 0) {
          preciosArray.push({
            producto_id: item.producto_id,
            ancho: item.ancho,
            cantidad_desde: normalizeRangoMin(rango.min),
            cantidad_hasta: normalizeRangoMax(rango.max),
            precio,
          });
        }
      });
    });

    onPreciosChange(preciosArray);
  }, [preciosState, productosPorAncho, onPreciosChange]);

  if (productosPorAncho.length === 0) return null;

  const primerItem = productosPorAncho[0];
  const rangos = primerItem.rangos;
  const unidadMedida = primerItem.unidad_medida === 'mt_lineal' ? 'ml' : 'unidades';

  const formatRango = (min: number, max: number) => {
    const normalizedMin = normalizeRangoMin(min);
    const normalizedMax = normalizeRangoMax(max);
    return formatRangoValue(normalizedMin, normalizedMax, unidadMedida);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 w-80 min-w-[320px]">
              Material
            </th>
            {rangos.map((rango, index) => (
              <th
                key={index}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {formatRango(rango.min, rango.max)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productosPorAncho.map(item => {
            const key = `${item.producto_id}-${item.ancho}`;

            return (
              <tr key={key} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 w-80 min-w-[320px]">
                  <div className="flex items-center gap-2">
                    <span className="truncate" title={item.producto_nombre}>
                      {item.producto_nombre}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-600 text-white whitespace-nowrap">
                      {item.ancho} cm
                    </span>
                  </div>
                </td>
                {item.rangos.map((rango, rangoIndex) => {
                  const rangoKey = getRangoKey(rango.min, rango.max);
                  const stateKey = `${item.producto_id}-${item.ancho}-${rangoKey}`;
                  const valor = preciosState[stateKey] || 0;

                  return (
                    <td key={rangoIndex} className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valor > 0 ? valor : ''}
                        onChange={e =>
                          handlePrecioChange(
                            item.producto_id,
                            item.ancho,
                            rango.min,
                            rango.max,
                            e.target.value
                          )
                        }
                        placeholder="$"
                        className="w-full"
                        disabled={readonly}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
