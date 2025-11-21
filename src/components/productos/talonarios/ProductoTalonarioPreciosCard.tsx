import { useState, useCallback, useEffect } from 'react';
import { Package } from 'lucide-react';
import { Card } from '../../ui/Card';
import { ProductoTalonarioPrecioMatriz } from './ProductoTalonarioPrecioMatriz';
import type { ProductoTalonarioParaPrecios } from '../../../hooks/useAllProductosTalonarioPrecios';
import type { PrecioInput } from '../../../hooks/useProductosTalonariosPrecios';

interface Props {
  producto: ProductoTalonarioParaPrecios;
  onPreciosChange: (productoId: string, precios: PrecioInput[]) => void;
}

interface PreciosPorCombinacion {
  [key: string]: PrecioInput[]; // key format: "ancho-alto-tintaId"
}

export function ProductoTalonarioPreciosCard({ producto, onPreciosChange }: Props) {
  const [preciosPorCombinacion, setPreciosPorCombinacion] = useState<PreciosPorCombinacion>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastProductoId, setLastProductoId] = useState<string | null>(null);

  // Get cantidades based on tipo_venta
  const getCantidades = (): number[] => {
    if (producto.tipo_venta === 'cantidades_fijas') {
      return producto.cantidades_fijas || [];
    }
    // For 'unidades' return [1]
    return [1];
  };

  const cantidades = getCantidades();

  // Generate all combinations grouped by medida
  const generateCombinacionesGrouped = () => {
    const grouped: Map<
      string,
      {
        medida: { ancho: number; alto: number };
        tintas: Array<{ id: string; nombre: string }>;
      }
    > = new Map();

    producto.medidas_disponibles.forEach((medida) => {
      const key = `${medida.ancho}-${medida.alto}`;
      const tintasForMedida: Array<{ id: string; nombre: string }> = [];

      producto.tecnologias.forEach((tecnologia) => {
        tecnologia.tintas.forEach((tinta) => {
          tintasForMedida.push(tinta);
        });
      });

      grouped.set(key, {
        medida,
        tintas: tintasForMedida,
      });
    });

    return Array.from(grouped.values());
  };

  const combinacionesGrouped = generateCombinacionesGrouped();
  const totalCombinaciones = combinacionesGrouped.reduce(
    (total, group) => total + group.tintas.length,
    0
  );

  // Reset initialization when producto changes
  useEffect(() => {
    if (lastProductoId !== producto.id) {
      setIsInitialized(false);
      setLastProductoId(producto.id);
      setPreciosPorCombinacion({});
    }
  }, [producto.id, lastProductoId]);

  // Initialize state with existing prices
  useEffect(() => {
    if (!isInitialized && producto.precios_existentes.length > 0) {
      const initialPreciosPorCombinacion: PreciosPorCombinacion = {};

      // Group existing prices by combination key
      producto.precios_existentes.forEach((precio) => {
        const key = `${precio.medida_ancho}-${precio.medida_alto}-${precio.tinta}`;

        if (!initialPreciosPorCombinacion[key]) {
          initialPreciosPorCombinacion[key] = [];
        }

        initialPreciosPorCombinacion[key].push({
          medida_ancho: precio.medida_ancho,
          medida_alto: precio.medida_alto,
          tinta: precio.tinta,
          cantidad: precio.cantidad,
          cara_impresa: precio.cara_impresa,
          precio: precio.precio,
        });
      });

      setPreciosPorCombinacion(initialPreciosPorCombinacion);
      setIsInitialized(true);
    }
  }, [producto.precios_existentes, isInitialized]);

  const handleCombinacionChange = useCallback(
    (medida: { ancho: number; alto: number }, tintaId: string, precios: PrecioInput[]) => {
      const key = `${medida.ancho}-${medida.alto}-${tintaId}`;

      const newPreciosPorCombinacion = {
        ...preciosPorCombinacion,
        [key]: precios,
      };

      setPreciosPorCombinacion(newPreciosPorCombinacion);

      // Flatten all prices (including unchanged ones) and send to parent
      // This ensures all combinations are preserved, not just the modified ones
      const allPrecios = Object.values(newPreciosPorCombinacion).flat();
      onPreciosChange(producto.id, allPrecios);
    },
    [preciosPorCombinacion, producto.id, onPreciosChange]
  );

  if (totalCombinaciones === 0) {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{producto.nombre}</h3>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Este producto no tiene configuraciones de medidas o tintas disponibles.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{producto.nombre}</h3>
            <p className="text-sm text-gray-500">
              {totalCombinaciones} {totalCombinaciones === 1 ? 'configuración' : 'configuraciones'}
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {combinacionesGrouped.map((group) => {
            const tintasCount = group.tintas.length;
            const useSideBySide = tintasCount === 2;

            return (
              <div key={`${group.medida.ancho}-${group.medida.alto}`} className="space-y-4">
                {useSideBySide ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {group.tintas.map((tinta) => {
                      const materialInfo = producto.materiales.length > 0 ? {
                        materialNombre: producto.materiales[0].material_nombre,
                        varianteNombre: producto.materiales[0].variante_nombre,
                        espesor: producto.materiales[0].espesor,
                        unidadEspesor: producto.materiales[0].unidad_espesor,
                      } : undefined;

                      return (
                        <ProductoTalonarioPrecioMatriz
                          key={`${group.medida.ancho}-${group.medida.alto}-${tinta}`}
                          productoId={producto.id}
                          productoNombre={producto.nombre}
                          medida={group.medida}
                          tinta={tinta}
                          cantidades={cantidades}
                          caras={producto.tipo_copia}
                          materialInfo={materialInfo}
                          preciosExistentes={producto.precios_existentes}
                          onChange={(precios) =>
                            handleCombinacionChange(group.medida, tinta, precios)
                          }
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {group.tintas.map((tinta) => {
                      const materialInfo = producto.materiales.length > 0 ? {
                        materialNombre: producto.materiales[0].material_nombre,
                        varianteNombre: producto.materiales[0].variante_nombre,
                        espesor: producto.materiales[0].espesor,
                        unidadEspesor: producto.materiales[0].unidad_espesor,
                      } : undefined;

                      return (
                        <ProductoTalonarioPrecioMatriz
                          key={`${group.medida.ancho}-${group.medida.alto}-${tinta}`}
                          productoId={producto.id}
                          productoNombre={producto.nombre}
                          medida={group.medida}
                          tinta={tinta}
                          cantidades={cantidades}
                          caras={producto.tipo_copia}
                          materialInfo={materialInfo}
                          preciosExistentes={producto.precios_existentes}
                          onChange={(precios) =>
                            handleCombinacionChange(group.medida, tinta, precios)
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
