import { useState, useEffect } from 'react';
import { Package, Ruler, DollarSign } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import type {
  ProductoMaterialRigidoParaPrecios,
  PrecioMRInput,
} from '../../../hooks/useAllProductosMaterialesRigidosPrecios';

interface Props {
  materialId: string;
  materialNombre: string;
  productos: ProductoMaterialRigidoParaPrecios[];
  calcularM2Placa: (ancho: number, alto: number) => number;
  calcularPrecioM2: (precioPlaca: number, ancho: number, alto: number) => number;
  onPrecioChange: (productoComboKey: string, precio: PrecioMRInput) => void;
  productosModificados: Set<string>;
  readonly?: boolean;
}

export function MaterialesRigidosPreciosTable({
  materialId,
  materialNombre,
  productos,
  calcularM2Placa,
  calcularPrecioM2,
  onPrecioChange,
  productosModificados,
  readonly = false,
}: Props) {
  const [preciosLocales, setPreciosLocales] = useState<Map<string, number>>(new Map());

  // Initialize local prices from existing prices
  useEffect(() => {
    const newPreciosLocales = new Map<string, number>();
    productos.forEach((producto) => {
      if (producto.precio_actual) {
        newPreciosLocales.set(producto.id, producto.precio_actual.precio_placa);
      }
    });
    setPreciosLocales(newPreciosLocales);
  }, [productos]);

  const handlePrecioPlacaChange = (producto: ProductoMaterialRigidoParaPrecios, valor: string) => {
    const precioPlaca = parseFloat(valor) || 0;

    // Update local state
    const newPreciosLocales = new Map(preciosLocales);
    if (precioPlaca > 0) {
      newPreciosLocales.set(producto.id, precioPlaca);
    } else {
      newPreciosLocales.delete(producto.id);
    }
    setPreciosLocales(newPreciosLocales);

    // Only notify parent if precio is valid
    if (precioPlaca > 0) {
      onPrecioChange(producto.id, {
        producto_materiales_rigidos_id: producto.producto_materiales_rigidos_id,
        material_id: producto.material.material_id,
        variante_nombre: producto.material.variante_nombre,
        espesor: producto.material.espesor,
        medida_placa_ancho: producto.medida_placa_ancho,
        medida_placa_alto: producto.medida_placa_alto,
        precio_placa: precioPlaca,
      });
    }
  };

  const formatPrecio = (precio: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(precio);
  };

  if (productos.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Material Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{materialNombre}</h3>
          <Badge variant="secondary">{productos.length} combinaciones</Badge>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Producto
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Variante
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Espesor
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Medida de Placa
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Precio por Placa
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Precio por m²
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productos.map((producto) => {
              const precioPlacaLocal = preciosLocales.get(producto.id) || 0;
              const precioM2 =
                precioPlacaLocal > 0
                  ? calcularPrecioM2(
                      precioPlacaLocal,
                      producto.medida_placa_ancho,
                      producto.medida_placa_alto
                    )
                  : 0;
              const m2Placa = calcularM2Placa(
                producto.medida_placa_ancho,
                producto.medida_placa_alto
              );
              const isModified = productosModificados.has(producto.id);

              return (
                <tr
                  key={producto.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    isModified ? 'bg-yellow-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {producto.nombre}
                      </span>
                      {isModified && (
                        <Badge variant="warning" className="text-xs">
                          Modificado
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {producto.material.variante_nombre}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {producto.material.espesor !== null ? (
                      <Badge variant="secondary" className="text-sm">
                        {producto.material.espesor} mm
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-500 italic">No aplica</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-gray-900">
                        {producto.medida_placa_ancho} × {producto.medida_placa_alto} cm
                      </span>
                      <p className="text-xs text-gray-500">
                        {m2Placa.toFixed(2)} m²
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioPlacaLocal || ''}
                      onChange={(e) => handlePrecioPlacaChange(producto, e.target.value)}
                      placeholder="0.00"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={readonly}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className="text-sm font-semibold text-green-600">
                        {precioM2 > 0 ? formatPrecio(precioM2) : '-'}
                      </span>
                      {precioM2 > 0 && (
                        <p className="text-xs text-gray-500">
                          por m²
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
