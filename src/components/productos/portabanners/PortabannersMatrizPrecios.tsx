import { useState, useEffect, useRef } from 'react';
import { Input } from '../../ui/Input';
import type {
  RangoPrecio,
  TecnologiaSimple,
  ProductoConPrecios,
  PrecioPortabannerInput
} from '../../../hooks/useAllProductosPortabannersPrecios';
import { normalizeRangoMax, normalizeRangoMin, formatRangoValue } from '../../../utils/rangoUtils';

interface Props {
  productos: ProductoConPrecios[];
  tecnologias: TecnologiaSimple[];
  rangos: RangoPrecio[];
  unidadMedida: string;
  onPreciosChange: (precios: PrecioPortabannerInput[]) => void;
}

interface PrecioState {
  [key: string]: number; // key format: "productoId-tecnologiaId-rangoKey"
}

export function PortabannersMatrizPrecios({
  productos,
  tecnologias,
  rangos,
  unidadMedida,
  onPreciosChange,
}: Props) {
  const [preciosState, setPreciosState] = useState<PrecioState>({});
  const isInitialized = useRef(false);
  const hasLocalChanges = useRef(false);

  const getRangoKey = (rango: RangoPrecio) => {
    const min = normalizeRangoMin(rango.min);
    const max = normalizeRangoMax(rango.max);
    return `${min}-${max}`;
  };

  // Initialize state from existing prices
  useEffect(() => {
    if (isInitialized.current) return;

    const initialState: PrecioState = {};

    productos.forEach((producto) => {
      if (producto.precios) {
        producto.precios.forEach((preciosTec, tecnologiaId) => {
          preciosTec.forEach((precio) => {
            const rangoKey = `${precio.rango_min}-${precio.rango_max}`;
            const key = `${producto.id}-${tecnologiaId}-${rangoKey}`;
            initialState[key] = precio.precio;
          });
        });
      }
    });

    setPreciosState(initialState);
    isInitialized.current = true;
  }, []);

  const handlePrecioChange = (
    productoId: string,
    tecnologiaId: string,
    rango: RangoPrecio,
    value: string
  ) => {
    const rangoKey = getRangoKey(rango);
    const key = `${productoId}-${tecnologiaId}-${rangoKey}`;
    const precio = parseFloat(value) || 0;

    hasLocalChanges.current = true;

    const newState = {
      ...preciosState,
      [key]: precio,
    };

    setPreciosState(newState);
  };

  // Notify parent of changes
  useEffect(() => {
    if (!isInitialized.current || !hasLocalChanges.current) return;

    const preciosArray: PrecioPortabannerInput[] = [];

    productos.forEach((producto) => {
      tecnologias.forEach((tecnologia) => {
        rangos.forEach((rango) => {
          const rangoKey = getRangoKey(rango);
          const key = `${producto.id}-${tecnologia.id}-${rangoKey}`;
          const precio = preciosState[key] || 0;

          if (precio > 0) {
            preciosArray.push({
              producto_id: producto.id,
              tecnologia_id: tecnologia.id,
              rango_precio_min: normalizeRangoMin(rango.min),
              rango_precio_max: normalizeRangoMax(rango.max),
              precio: precio,
            });
          }
        });
      });
    });

    onPreciosChange(preciosArray);
  }, [preciosState, productos, tecnologias, rangos, onPreciosChange]);

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

  const totalColumnas = 1 + tecnologias.length * rangos.length;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th
              rowSpan={2}
              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 w-80 min-w-[320px] align-middle"
            >
              Producto / Medida
            </th>
            {tecnologias.map((tecnologia) => (
              <th
                key={tecnologia.id}
                colSpan={rangos.length}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
              >
                {tecnologia.nombre}
              </th>
            ))}
          </tr>
          <tr>
            {tecnologias.map((tecnologia) =>
              rangos.map((rango, rangoIndex) => (
                <th
                  key={`${tecnologia.id}-${rangoIndex}`}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                >
                  {formatRango(rango)}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productos.map((producto) => (
            <tr key={producto.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm border-r border-gray-200 w-80 min-w-[320px]">
                <div className="font-medium text-gray-900 mb-1">{producto.nombre}</div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                    {producto.ancho_cm} × {producto.alto_cm} cm
                  </span>
                </div>
              </td>
              {tecnologias.map((tecnologia) =>
                rangos.map((rango, rangoIndex) => {
                  const rangoKey = getRangoKey(rango);
                  const key = `${producto.id}-${tecnologia.id}-${rangoKey}`;
                  const valor = preciosState[key] || 0;

                  // Check if this product has this technology
                  const hasThisTech = producto.tecnologias.some(
                    (t) => t.id === tecnologia.id
                  );

                  if (!hasThisTech) {
                    return (
                      <td
                        key={`${tecnologia.id}-${rangoIndex}`}
                        className="px-4 py-3 bg-gray-50 border-r border-gray-200"
                      >
                        <div className="text-center text-xs text-gray-400">-</div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={`${tecnologia.id}-${rangoIndex}`}
                      className="px-4 py-3 border-r border-gray-200"
                    >
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valor > 0 ? valor : ''}
                        onChange={(e) =>
                          handlePrecioChange(producto.id, tecnologia.id, rango, e.target.value)
                        }
                        placeholder="$"
                        className="w-full"
                      />
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
