import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { ProductoTalonarioPrecioTable } from './ProductoTalonarioPrecioTable';
import { useProductoTalonarios } from '../../../hooks/useProductosTalonarios';
import { useProductosTalonariosPrecios } from '../../../hooks/useProductosTalonariosPrecios';
import { useTecnologiasTintasPasos } from '../../../hooks/useTecnologiasTintasPasos';
import type { PrecioInput } from '../../../hooks/useProductosTalonariosPrecios';

interface ProductoTalonarioPreciosSectionProps {
  productoId: string;
  onPreciosChange: (precios: PrecioInput[]) => void;
}

interface CombinacionPrecios {
  medida: { ancho: number; alto: number };
  tintaId: string;
  tintaNombre: string;
  precios: Array<{
    cantidad: number;
    tipo_copia: string;
    precio: number;
  }>;
}

export function ProductoTalonarioPreciosSection({
  productoId,
  onPreciosChange,
}: ProductoTalonarioPreciosSectionProps) {
  const { producto, isLoading: loadingProducto } = useProductoTalonarios(productoId);
  const { precios: preciosExistentes, isLoading: loadingPrecios } = useProductosTalonariosPrecios(productoId);
  const { tintasPasos, isLoading: loadingTintas } = useTecnologiasTintasPasos();
  const [combinaciones, setCombinaciones] = useState<CombinacionPrecios[]>([]);
  const [preciosLocales, setPreciosLocales] = useState<Map<string, CombinacionPrecios>>(new Map());

  useEffect(() => {
    if (!producto || !tintasPasos) return;

    // Obtener las tintas del producto
    const tintasProducto = producto.tecnologias.length > 0 ? producto.tecnologias[0].tintas : [];

    // Crear todas las combinaciones de medida x tinta
    const todasCombinaciones: CombinacionPrecios[] = [];

    producto.medidas_disponibles.forEach((medida) => {
      tintasProducto.forEach((tintaId) => {
        const tinta = tintasPasos.find((t) => t.id === tintaId);
        if (!tinta) return;

        const key = `${medida.ancho}x${medida.alto}-${tintaId}`;

        // Buscar precios existentes para esta combinación
        const preciosParaCombinacion = preciosExistentes.filter(
          (p) =>
            p.medida_ancho === medida.ancho &&
            p.medida_alto === medida.alto &&
            p.tinta_id === tintaId
        );

        todasCombinaciones.push({
          medida: { ancho: medida.ancho, alto: medida.alto },
          tintaId: tintaId,
          tintaNombre: tinta.nombre,
          precios: preciosParaCombinacion.map((p) => ({
            cantidad: p.cantidad,
            tipo_copia: p.tipo_copia,
            precio: p.precio,
          })),
        });
      });
    });

    setCombinaciones(todasCombinaciones);

    // Inicializar mapa local de precios
    const mapaInicial = new Map<string, CombinacionPrecios>();
    todasCombinaciones.forEach((comb) => {
      const key = `${comb.medida.ancho}x${comb.medida.alto}-${comb.tintaId}`;
      mapaInicial.set(key, comb);
    });
    setPreciosLocales(mapaInicial);
  }, [producto, preciosExistentes, tintasPasos]);

  const handleCombinacionPreciosChange = (
    medida: { ancho: number; alto: number },
    tintaId: string,
    precios: Array<{ cantidad: number; tipo_copia: string; precio: number }>
  ) => {
    const key = `${medida.ancho}x${medida.alto}-${tintaId}`;
    const combinacionActualizada = preciosLocales.get(key);

    if (combinacionActualizada) {
      combinacionActualizada.precios = precios;
      const nuevoMapa = new Map(preciosLocales);
      nuevoMapa.set(key, combinacionActualizada);
      setPreciosLocales(nuevoMapa);

      // Convertir todos los precios locales a PrecioInput y notificar al padre
      const todosLosPrecios: PrecioInput[] = [];
      nuevoMapa.forEach((comb) => {
        comb.precios.forEach((p) => {
          todosLosPrecios.push({
            medida_ancho: comb.medida.ancho,
            medida_alto: comb.medida.alto,
            tinta_id: comb.tintaId,
            cantidad: p.cantidad,
            tipo_copia: p.tipo_copia as 'duplicado' | 'triplicado' | 'cuadruplicado',
            precio: p.precio,
          });
        });
      });

      onPreciosChange(todosLosPrecios);
    }
  };

  const getCantidadesParaProducto = (): number[] => {
    if (!producto) return [1];

    if (producto.tipo_venta === 'cantidades_fijas' && producto.cantidades_fijas.length > 0) {
      return producto.cantidades_fijas;
    }

    return [1];
  };

  if (loadingProducto || loadingPrecios || loadingTintas) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            No se pudo cargar la información del producto.
          </p>
        </div>
      </div>
    );
  }

  if (producto.medidas_disponibles.length === 0 || producto.tipo_copia.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-800 mb-1">
              Configuración incompleta
            </p>
            <p className="text-sm text-yellow-700">
              El producto necesita al menos una medida y una opción de cara impresa configuradas
              para poder asignar precios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (producto.tecnologias.length === 0 || producto.tecnologias[0].tintas.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-yellow-800 mb-1">
              Configuración incompleta
            </p>
            <p className="text-sm text-yellow-700">
              El producto necesita tener al menos una tinta configurada para poder asignar precios.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cantidades = getCantidadesParaProducto();

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-base font-semibold text-blue-900 mb-2">{producto.nombre}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-blue-800">
          <div>
            <span className="font-medium">Medidas:</span> {producto.medidas_disponibles.length}
          </div>
          <div>
            <span className="font-medium">Tintas:</span>{' '}
            {producto.tecnologias[0]?.tintas.length || 0}
          </div>
          <div>
            <span className="font-medium">Caras:</span> {producto.tipo_copia.length}
          </div>
        </div>
      </div>

      {combinaciones.map((combinacion, index) => {
        const materialInfo = producto.materiales.length > 0 ? {
          materialNombre: producto.materiales[0].material_nombre,
          varianteNombre: producto.materiales[0].variante_nombre,
          espesor: producto.materiales[0].espesor,
          unidadEspesor: producto.materiales[0].unidad_espesor,
        } : undefined;

        return (
          <ProductoTalonarioPrecioTable
            key={`${combinacion.medida.ancho}x${combinacion.medida.alto}-${combinacion.tintaId}`}
            medida={combinacion.medida}
            tintaId={combinacion.tintaId}
            tintaNombre={combinacion.tintaNombre}
            cantidades={cantidades}
            carasImpresas={producto.tipo_copia}
            materialInfo={materialInfo}
            preciosExistentes={combinacion.precios}
            onPreciosChange={(precios) =>
              handleCombinacionPreciosChange(combinacion.medida, combinacion.tintaId, precios)
            }
          />
        );
      })}
    </div>
  );
}
