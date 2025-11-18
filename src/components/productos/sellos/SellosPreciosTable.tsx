import { useState, useEffect } from 'react';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import type { ProductoSelloConPrecio, PrecioSelloInput } from '../../../hooks/useProductosSellosPrecios';

interface SellosPreciosTableProps {
  productos: ProductoSelloConPrecio[];
  onPreciosChange: (precios: PrecioSelloInput[]) => void;
}

const getTipoProductoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    sello: 'Sello',
    repuesto: 'Repuesto',
    polimero: 'Polímero',
    tinta: 'Tinta',
    accesorios: 'Accesorios',
  };
  return labels[tipo] || tipo;
};

export function SellosPreciosTable({ productos, onPreciosChange }: SellosPreciosTableProps) {
  const [precios, setPrecios] = useState<Record<string, number>>({});

  useEffect(() => {
    const initialPrecios: Record<string, number> = {};
    productos.forEach((producto) => {
      initialPrecios[producto.id] = producto.precio_unitario;
    });
    setPrecios(initialPrecios);
  }, [productos]);

  const handlePrecioChange = (productoId: string, value: string) => {
    const precio = parseFloat(value) || 0;
    const newPrecios = {
      ...precios,
      [productoId]: precio,
    };
    setPrecios(newPrecios);

    const preciosArray: PrecioSelloInput[] = Object.entries(newPrecios).map(
      ([producto_id, precio_unitario]) => ({
        producto_id,
        precio_unitario,
      })
    );

    onPreciosChange(preciosArray);
  };

  if (productos.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
              Tipo
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
              Precio Unitario
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productos.map((producto) => (
            <tr key={producto.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200">
                {producto.nombre}
              </td>
              <td className="px-6 py-4 border-r border-gray-200">
                <Badge variant="default" className="bg-violet-600 text-white">
                  {getTipoProductoLabel(producto.tipo_producto)}
                </Badge>
              </td>
              <td className="px-6 py-4 w-64">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precios[producto.id] > 0 ? precios[producto.id] : ''}
                    onChange={(e) => handlePrecioChange(producto.id, e.target.value)}
                    placeholder="0.00"
                    className="w-full"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
