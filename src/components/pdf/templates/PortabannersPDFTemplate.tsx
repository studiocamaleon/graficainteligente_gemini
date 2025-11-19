import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFSectionHeader } from '../PDFSectionHeader';
import type {
  ProductoConPrecios,
  TecnologiaSimple,
  RangoPrecio,
} from '../../../hooks/useAllProductosPortabannersPrecios';
import { normalizeRangoMin, normalizeRangoMax, formatRangoValue } from '../../../utils/rangoUtils';

interface Props {
  productosPorRango: ProductoConPrecios[][];
  tecnologias: TecnologiaSimple[];
}

export const PortabannersPDFTemplate = forwardRef<HTMLDivElement, Props>(
  ({ productosPorRango, tecnologias }, ref) => {
    const getUnidadLabel = (unidadMedida: string) => {
      if (unidadMedida === 'mt2') return 'm²';
      if (unidadMedida === 'mt_lineal') return 'ml';
      return 'unidades';
    };

    const formatRango = (rango: RangoPrecio, unidadMedida: string) => {
      const unidad = getUnidadLabel(unidadMedida);
      const min = normalizeRangoMin(rango.min);
      const max = normalizeRangoMax(rango.max);
      return formatRangoValue(min, max, unidad);
    };

    const getPrecio = (
      producto: ProductoConPrecios,
      tecnologiaId: string,
      rango: RangoPrecio
    ): string => {
      if (!producto.precios) return '-';

      const preciosTec = producto.precios.get(tecnologiaId);
      if (!preciosTec) return '-';

      const min = normalizeRangoMin(rango.min);
      const max = normalizeRangoMax(rango.max);

      const precio = preciosTec.find(
        (p) => p.rango_min === min && p.rango_max === max
      );

      return precio ? `$${precio.precio.toFixed(2)}` : '-';
    };

    return (
      <PDFLayout
        ref={ref}
        title="Lista de Precios - Portabanners"
        subtitle={`Generada el ${new Date().toLocaleDateString('es-AR')}`}
      >
        {productosPorRango.map((grupoProductos, grupoIndex) => {
          if (grupoProductos.length === 0) return null;

          const primerProducto = grupoProductos[0];
          const rangos = primerProducto.rangos;
          const unidadMedida = primerProducto.unidad_medida;
          const rangoNombre = primerProducto.rango_nombre;

          return (
            <div key={grupoIndex} className="mb-8 break-inside-avoid">
              <PDFSectionHeader title={rangoNombre} />

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th
                        rowSpan={2}
                        className="border border-gray-300 px-3 py-2 text-left font-semibold align-middle"
                        style={{ minWidth: '200px' }}
                      >
                        Producto / Medida
                      </th>
                      {tecnologias.map((tecnologia) => (
                        <th
                          key={tecnologia.id}
                          colSpan={rangos.length}
                          className="border border-gray-300 px-3 py-2 text-center font-semibold"
                        >
                          {tecnologia.nombre}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-gray-50">
                      {tecnologias.map((tecnologia) =>
                        rangos.map((rango, rangoIndex) => (
                          <th
                            key={`${tecnologia.id}-${rangoIndex}`}
                            className="border border-gray-300 px-2 py-1 text-center text-xs font-medium"
                          >
                            {formatRango(rango, unidadMedida)}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {grupoProductos.map((producto, productoIndex) => (
                      <tr
                        key={producto.id}
                        className={productoIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="border border-gray-300 px-3 py-2">
                          <div className="font-medium text-gray-900 mb-1">
                            {producto.nombre}
                          </div>
                          <div className="text-xs text-gray-600">
                            {producto.ancho_cm} × {producto.alto_cm} cm
                          </div>
                        </td>
                        {tecnologias.map((tecnologia) =>
                          rangos.map((rango, rangoIndex) => {
                            const hasThisTech = producto.tecnologias.some(
                              (t) => t.id === tecnologia.id
                            );

                            const precio = hasThisTech
                              ? getPrecio(producto, tecnologia.id, rango)
                              : '-';

                            return (
                              <td
                                key={`${tecnologia.id}-${rangoIndex}`}
                                className={`border border-gray-300 px-2 py-2 text-center ${
                                  !hasThisTech ? 'bg-gray-100' : ''
                                }`}
                              >
                                {precio}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
          <p className="mb-1">
            <strong>Nota:</strong> Los precios están expresados en pesos argentinos y no incluyen IVA.
          </p>
          <p>
            Las celdas marcadas con "-" indican que la tecnología no está disponible para ese producto.
          </p>
        </div>
      </PDFLayout>
    );
  }
);

PortabannersPDFTemplate.displayName = 'PortabannersPDFTemplate';
