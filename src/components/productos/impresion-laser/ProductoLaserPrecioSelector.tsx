import { Select } from '../../ui/Select';
import { useProductosImpresionLaser } from '../../../hooks/useProductosImpresionLaser';
import type { ProductoImpresionLaser } from '../../../hooks/useProductosImpresionLaser';

interface ProductoLaserPrecioSelectorProps {
  selectedProductoId: string;
  onProductoChange: (productoId: string) => void;
}

export function ProductoLaserPrecioSelector({
  selectedProductoId,
  onProductoChange,
}: ProductoLaserPrecioSelectorProps) {
  const { productos, isLoading } = useProductosImpresionLaser({ isActive: true });

  // Filtrar productos que tengan configuración completa
  const productosValidos = productos.filter((producto: ProductoImpresionLaser) => {
    return (
      producto.medidas_disponibles.length > 0 &&
      producto.caras_impresas.length > 0
    );
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (productosValidos.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          No hay productos de impresión láser activos con configuración completa.
          Asegúrate de crear productos con al menos una medida y una opción de cara impresa configurada.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Seleccionar Producto
      </label>
      <Select
        value={selectedProductoId}
        onChange={onProductoChange}
        className="w-full"
      >
        <option value="">Seleccione un producto...</option>
        {productosValidos.map((producto) => (
          <option key={producto.id} value={producto.id}>
            {producto.nombre} ({producto.medidas_disponibles.length} medida
            {producto.medidas_disponibles.length !== 1 ? 's' : ''})
          </option>
        ))}
      </Select>

      {selectedProductoId && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            Configura los precios base para cada combinación de medida, tinta, cantidad y cara impresa.
            Estos precios se usarán como base para las cotizaciones.
          </p>
        </div>
      )}
    </div>
  );
}
