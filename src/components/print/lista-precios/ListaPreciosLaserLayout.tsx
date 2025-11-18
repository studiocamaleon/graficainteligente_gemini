import { forwardRef } from 'react';
import { Package } from 'lucide-react';
import { PrintableDocument } from '../PrintableDocument';
import { PrintHeader } from '../PrintHeader';
import { PrintFooter } from '../PrintFooter';
import { PrintInkBadge } from '../PrintInkBadge';
import type { ProductoLaserParaPrecios } from '../../../hooks/useAllProductosLaserPrecios';

interface ListaPreciosLaserLayoutProps {
  productos: ProductoLaserParaPrecios[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const ListaPreciosLaserLayout = forwardRef<
  HTMLDivElement,
  ListaPreciosLaserLayoutProps
>(({ productos }, ref) => {
  return (
    <PrintableDocument ref={ref}>
      <PrintHeader title="Lista de Precios" subtitle="Impresión Láser" />

      {productos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay productos disponibles para exportar.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {productos.map((producto, prodIndex) => (
            <div
              key={producto.id}
              className={`page-break-inside-avoid ${prodIndex > 0 ? 'page-break-before' : ''}`}
            >
              <div className="bg-blue-600 text-white rounded-lg p-4 mb-4 flex items-center gap-3">
                <Package className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">{producto.nombre}</h2>
                  <p className="text-sm text-blue-100 mt-1">
                    {producto.tipo_venta === 'unidades' ? 'Venta por unidades' : 'Cantidades fijas'}
                  </p>
                </div>
              </div>

              {producto.materiales.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Materiales:</h3>
                  <div className="flex flex-wrap gap-2">
                    {producto.materiales.map((mat, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 border border-gray-300 rounded-lg text-xs"
                      >
                        <span className="font-medium text-gray-900">{mat.material_nombre}</span>
                        {mat.variante_nombre && (
                          <span className="text-gray-600">- {mat.variante_nombre}</span>
                        )}
                        {mat.espesor && (
                          <span className="text-gray-500">
                            ({mat.espesor} {mat.unidad_espesor})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {producto.tecnologias.map((tech) => (
                <div key={tech.tecnologia_id} className="mb-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-3">
                    {tech.tecnologia_nombre}
                  </h3>

                  {tech.tintas.map((tinta) => (
                    <div key={tinta.id} className="mb-4 page-break-inside-avoid">
                      <div className="mb-3">
                        <PrintInkBadge tinta={tinta.nombre} />
                      </div>

                      {producto.medidas_disponibles.map((medida, medidaIdx) => (
                        <div key={medidaIdx} className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Medida: {medida.ancho} x {medida.alto} cm
                          </h4>

                          <table className="w-full border-collapse border border-gray-300 text-sm mb-2">
                            <thead>
                              <tr className="bg-blue-500 text-white">
                                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">
                                  Caras Impresas
                                </th>
                                {producto.tipo_venta === 'cantidades_fijas' ? (
                                  producto.cantidades_fijas.map((cant) => (
                                    <th
                                      key={cant}
                                      className="border border-gray-300 px-3 py-2 text-center font-semibold"
                                    >
                                      {cant} un.
                                    </th>
                                  ))
                                ) : (
                                  <th className="border border-gray-300 px-3 py-2 text-center font-semibold">
                                    Precio Unitario
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {producto.caras_impresas.map((cara, caraIdx) => (
                                <tr
                                  key={cara}
                                  className={caraIdx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}
                                >
                                  <td className="border border-gray-300 px-3 py-2 text-gray-900">
                                    {cara === '1' ? '1 Cara' : cara === '2' ? '2 Caras' : cara}
                                  </td>
                                  {producto.tipo_venta === 'cantidades_fijas' ? (
                                    producto.cantidades_fijas.map((cant) => (
                                      <td
                                        key={cant}
                                        className="border border-gray-300 px-3 py-2 text-right font-semibold text-green-700"
                                      >
                                        -
                                      </td>
                                    ))
                                  ) : (
                                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-green-700">
                                      -
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))}
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

ListaPreciosLaserLayout.displayName = 'ListaPreciosLaserLayout';
