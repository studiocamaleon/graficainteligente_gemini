import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Card } from '../../ui/Card';
import { InkBadge } from '../../ui/InkBadge';
import { GranFormatoMatrizPrecios } from './GranFormatoMatrizPrecios';
import type {
  TecnologiaAgrupada,
  PrecioGFInput,
} from '../../../hooks/useAllProductosGranFormatoPrecios';
import { supabase } from '../../../lib/supabase';
import { normalizeRangoMin, normalizeRangoMax } from '../../../utils/rangoUtils';

interface Props {
  tecnologia: TecnologiaAgrupada;
  onPreciosChange: (precios: PrecioGFInput[]) => void;
}

interface PreciosCargados {
  producto_gran_formato_id: string;
  rango_precio_min: number;
  rango_precio_max: number;
  precio: number;
}

interface MatrizPreciosWrapperProps {
  productos: any[];
  tecnologiaId: string;
  tinta: string;
  rangos: any[];
  unidadMedida: string;
  preciosCargados: Map<string, PreciosCargados[]>;
  productosIds: string[];
  onTintaChange: (tinta: string, precios: PrecioGFInput[]) => void;
}

const MatrizPreciosWrapper = ({
  productos,
  tecnologiaId,
  tinta,
  rangos,
  unidadMedida,
  preciosCargados,
  productosIds,
  onTintaChange,
}: MatrizPreciosWrapperProps) => {
  const preciosActuales = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const preciosTinta = preciosCargados.get(tinta) || [];

    preciosTinta
      .filter((p) => productosIds.includes(p.producto_gran_formato_id))
      .forEach((precio) => {
        const min = normalizeRangoMin(precio.rango_precio_min);
        const max = normalizeRangoMax(precio.rango_precio_max);
        const rangoKey = `${min}-${max}`;
        if (!map.has(precio.producto_gran_formato_id)) {
          map.set(precio.producto_gran_formato_id, new Map());
        }
        map.get(precio.producto_gran_formato_id)!.set(rangoKey, precio.precio);
      });

    return map;
  }, [preciosCargados, tinta, productosIds]);

  const productosSimplificados = useMemo(
    () => productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo_venta: p.tipo_venta,
      ancho_fijo: p.ancho_fijo
    })),
    [productos]
  );

  const handlePreciosChange = useCallback(
    (precios: PrecioGFInput[]) => {
      onTintaChange(tinta, precios);
    },
    [tinta, onTintaChange]
  );

  return (
    <div className="space-y-2">
      <GranFormatoMatrizPrecios
        productos={productosSimplificados}
        tecnologiaId={tecnologiaId}
        tinta={tinta}
        rangos={rangos}
        unidadMedida={unidadMedida}
        preciosActuales={preciosActuales}
        onPreciosChange={handlePreciosChange}
      />
    </div>
  );
};

export function GranFormatoTecnologiaSection({ tecnologia, onPreciosChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [preciosPorTinta, setPreciosPorTinta] = useState<Map<string, PrecioGFInput[]>>(
    new Map()
  );
  const [preciosCargados, setPreciosCargados] = useState<
    Map<string, PreciosCargados[]>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPrecios() {
      try {
        const allProductosIds: string[] = [];
        tecnologia.tintas.forEach((tintaData) => {
          tintaData.productosPorRango.forEach((productos) => {
            productos.forEach((p) => {
              if (!allProductosIds.includes(p.id)) {
                allProductosIds.push(p.id);
              }
            });
          });
        });

        if (allProductosIds.length === 0) {
          setIsLoading(false);
          return;
        }

        const { data } = await supabase
          .from('productos_gran_formato_precios')
          .select(
            'producto_gran_formato_id, tinta, rango_precio_min, rango_precio_max, precio'
          )
          .eq('tecnologia_id', tecnologia.id)
          .in('producto_gran_formato_id', allProductosIds);

        if (data) {
          const preciosPorTintaMap = new Map<string, PreciosCargados[]>();
          data.forEach((precio) => {
            const tinta = precio.tinta;
            if (!preciosPorTintaMap.has(tinta)) {
              preciosPorTintaMap.set(tinta, []);
            }
            preciosPorTintaMap.get(tinta)!.push({
              producto_gran_formato_id: precio.producto_gran_formato_id,
              rango_precio_min: precio.rango_precio_min,
              rango_precio_max: precio.rango_precio_max,
              precio: precio.precio,
            });
          });
          setPreciosCargados(preciosPorTintaMap);
        }
      } catch (error) {
        console.error('Error loading precios:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPrecios();
  }, [tecnologia]);

  const handleTintaChange = useCallback(
    (tinta: string, precios: PrecioGFInput[]) => {
      setPreciosPorTinta((prevPreciosPorTinta) => {
        const newPreciosPorTinta = new Map(prevPreciosPorTinta);
        newPreciosPorTinta.set(tinta, precios);

        const allPrecios = Array.from(newPreciosPorTinta.values()).flat();
        onPreciosChange(allPrecios);

        return newPreciosPorTinta;
      });
    },
    [onPreciosChange]
  );

  const getPreciosActualesParaTinta = useCallback((
    tinta: string,
    productosIds: string[]
  ): Map<string, Map<string, number>> => {
    const map = new Map<string, Map<string, number>>();
    const preciosTinta = preciosCargados.get(tinta) || [];

    preciosTinta
      .filter((p) => productosIds.includes(p.producto_gran_formato_id))
      .forEach((precio) => {
        const min = normalizeRangoMin(precio.rango_precio_min);
        const max = normalizeRangoMax(precio.rango_precio_max);
        const rangoKey = `${min}-${max}`;
        if (!map.has(precio.producto_gran_formato_id)) {
          map.set(precio.producto_gran_formato_id, new Map());
        }
        map.get(precio.producto_gran_formato_id)!.set(rangoKey, precio.precio);
      });

    return map;
  }, [preciosCargados]);

  if (isLoading) {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{tecnologia.nombre}</h3>
          </div>
          <p className="text-sm text-gray-500">Cargando precios...</p>
        </div>
      </Card>
    );
  }

  if (tecnologia.tintas.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{tecnologia.nombre}</h3>
          </div>
          <p className="text-sm text-gray-500">
            No hay productos configurados con esta tecnología.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="border-b border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{tecnologia.nombre}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-8">
          {tecnologia.tintas.map((tintaData) => (
            <div key={tintaData.tinta} className="space-y-4">
              <div className="flex items-start">
                <InkBadge tinta={tintaData.tinta} />
              </div>

              {Array.from(tintaData.productosPorRango.entries()).map(
                ([rangoId, productos]) => {
                  if (productos.length === 0) return null;

                  const primeProducto = productos[0];
                  const productosIds = productos.map((p) => p.id);

                  return (
                    <MatrizPreciosWrapper
                      key={rangoId}
                      productos={productos}
                      tecnologiaId={tecnologia.id}
                      tinta={tintaData.tinta}
                      rangos={primeProducto.rangos}
                      unidadMedida={primeProducto.unidad_medida}
                      preciosCargados={preciosCargados}
                      productosIds={productosIds}
                      onTintaChange={handleTintaChange}
                    />
                  );
                }
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
