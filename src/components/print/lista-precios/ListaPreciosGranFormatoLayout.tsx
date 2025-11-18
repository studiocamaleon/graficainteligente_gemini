import { forwardRef } from 'react';
import { Zap } from 'lucide-react';
import { PrintableDocument } from '../PrintableDocument';
import { PrintHeader } from '../PrintHeader';
import { PrintFooter } from '../PrintFooter';
import { PrintInkBadge } from '../PrintInkBadge';
import type { TecnologiaAgrupada } from '../../../hooks/useAllProductosGranFormatoPrecios';

interface ListaPreciosGranFormatoLayoutProps {
  tecnologiasAgrupadas: TecnologiaAgrupada[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const ListaPreciosGranFormatoLayout = forwardRef<
  HTMLDivElement,
  ListaPreciosGranFormatoLayoutProps
>(({ tecnologiasAgrupadas }, ref) => {
  return (
    <PrintableDocument ref={ref}>
      <PrintHeader title="Lista de Precios" subtitle="Gran Formato" />

      {tecnologiasAgrupadas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay productos disponibles para exportar.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {tecnologiasAgrupadas.map((tecnologia, techIndex) => (
            <div
              key={tecnologia.id}
              className={`page-break-inside-avoid ${techIndex > 0 ? 'page-break-before' : ''}`}
            >
              <div className="bg-purple-600 text-white rounded-lg p-4 mb-6 flex items-center gap-3">
                <Zap className="w-6 h-6" />
                <h2 className="text-xl font-bold">{tecnologia.nombre}</h2>
              </div>

              {tecnologia.tintas.map((tintaData) => (
                <div key={tintaData.tinta} className="mb-8 page-break-inside-avoid">
                  <div className="mb-4">
                    <PrintInkBadge tinta={tintaData.tinta} />
                  </div>

                  {Array.from(tintaData.productosPorRango.entries()).map(
                    ([rangoId, productos]) => {
                      if (productos.length === 0) return null;

                      const primerProducto = productos[0];
                      const tieneAnchoFijo = primerProducto.tipo_venta === 'mt_lineal';

                      return (
                        <div key={rangoId} className="mb-6 page-break-inside-avoid">
                          <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead>
                              <tr className="bg-blue-600 text-white">
                                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                                  Producto
                                </th>
                                <th className="border border-gray-300 px-3 py-2 text-center font-semibold">
                                  Tipo de Venta
                                </th>
                                {tieneAnchoFijo && (
                                  <th className="border border-gray-300 px-3 py-2 text-center font-semibold">
                                    Ancho
                                  </th>
                                )}
                                {primerProducto.rangos.map((rango, index) => {
                                  const rangoText =
                                    rango.max === Infinity
                                      ? `≥ ${rango.min} ${primerProducto.unidad_medida}`
                                      : `${rango.min}-${rango.max} ${primerProducto.unidad_medida}`;
                                  return (
                                    <th
                                      key={index}
                                      className="border border-gray-300 px-3 py-2 text-center font-semibold"
                                    >
                                      {rangoText}
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {productos.map((producto, index) => (
                                <tr
                                  key={producto.id}
                                  className={index % 2 === 1 ? 'bg-gray-50' : 'bg-white'}
                                >
                                  <td className="border border-gray-300 px-3 py-2 text-gray-900">
                                    {producto.nombre}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                                    {producto.tipo_venta === 'mt2' ? 'm²' : 'mt lineal'}
                                  </td>
                                  {tieneAnchoFijo && (
                                    <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">
                                      {producto.ancho_fijo ? `${producto.ancho_fijo} cm` : '-'}
                                    </td>
                                  )}
                                  {primerProducto.rangos.map((rango, rangoIndex) => (
                                    <td
                                      key={rangoIndex}
                                      className="border border-gray-300 px-3 py-2 text-right font-semibold text-green-700"
                                    >
                                      -
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <PrintFooter />
    </PrintableDocument>
  );
});

ListaPreciosGranFormatoLayout.displayName = 'ListaPreciosGranFormatoLayout';
