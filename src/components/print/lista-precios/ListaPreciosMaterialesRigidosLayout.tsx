import { forwardRef } from 'react';
import { Box } from 'lucide-react';
import { PrintableDocument } from '../PrintableDocument';
import { PrintHeader } from '../PrintHeader';
import { PrintFooter } from '../PrintFooter';
import type { ProductoMaterialRigidoParaPrecios } from '../../../hooks/useAllProductosMaterialesRigidosPrecios';

interface ListaPreciosMaterialesRigidosLayoutProps {
  productosAgrupados: {
    [materialId: string]: {
      material_nombre: string;
      productos: ProductoMaterialRigidoParaPrecios[];
    };
  };
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const ListaPreciosMaterialesRigidosLayout = forwardRef<
  HTMLDivElement,
  ListaPreciosMaterialesRigidosLayoutProps
>(({ productosAgrupados }, ref) => {
  const materialesArray = Object.entries(productosAgrupados);

  return (
    <PrintableDocument ref={ref}>
      <PrintHeader title="Lista de Precios" subtitle="Materiales Rígidos" />

      {materialesArray.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay productos disponibles para exportar.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {materialesArray.map(([materialId, grupo], materialIndex) => (
            <div
              key={materialId}
              className={`page-break-inside-avoid ${materialIndex > 0 ? 'page-break-before' : ''}`}
            >
              <div className="bg-orange-600 text-white rounded-lg p-4 mb-4 flex items-center gap-3">
                <Box className="w-6 h-6" />
                <h2 className="text-xl font-bold">{grupo.material_nombre}</h2>
              </div>

              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-orange-500 text-white">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                      Producto
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      Variante
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      Espesor
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold">
                      Medida Placa
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold">
                      Precio Placa
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold">
                      Precio m²
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.productos.map((producto, prodIndex) => (
                    <tr
                      key={producto.id}
                      className={prodIndex % 2 === 1 ? 'bg-gray-50' : 'bg-white'}
                    >
                      <td className="border border-gray-300 px-3 py-2 text-gray-900">
                        {producto.nombre}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                        {producto.material.variante_nombre || '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                        {producto.material.espesor
                          ? `${producto.material.espesor} mm`
                          : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                        {producto.medida_placa_ancho} x {producto.medida_placa_alto} cm
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-green-700">
                        {producto.precio_actual
                          ? formatCurrency(producto.precio_actual.precio_placa)
                          : '-'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-green-700">
                        {producto.precio_actual
                          ? formatCurrency(producto.precio_actual.precio_mt2)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <PrintFooter />
    </PrintableDocument>
  );
});

ListaPreciosMaterialesRigidosLayout.displayName = 'ListaPreciosMaterialesRigidosLayout';
