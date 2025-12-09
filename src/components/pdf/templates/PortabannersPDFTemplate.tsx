import { forwardRef } from 'react';
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

    // Helpers
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
      <div
        ref={ref}
        className="bg-white p-8 font-sans text-gray-900"
        style={{ minWidth: '210mm', maxWidth: '210mm', margin: '0 auto', minHeight: '297mm' }}
      >
        {/* Global Styles for Print */}
        <style type="text/css">
          {`
            @page { size: A4; margin: 0; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break { page-break-before: always; }
              .avoid-break { page-break-inside: avoid; }
            }
          `}
        </style>

        {/* Header */}
        <div className="mb-12 border-b border-gray-100 pb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Lista de Precios</h1>
              <p className="text-gray-500 mt-1">Portabanners</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {productosPorRango.map((grupoProductos, grupoIndex) => {
            if (grupoProductos.length === 0) return null;

            const primerProducto = grupoProductos[0];
            const rangos = primerProducto.rangos;
            const unidadMedida = primerProducto.unidad_medida;
            const rangoNombre = primerProducto.rango_nombre;

            return (
              <div key={grupoIndex} className="avoid-break bg-white">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {rangoNombre}
                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Precios por Cantidad
                    </span>
                  </h2>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                      {/* Tech Group Headers */}
                      <tr>
                        <th rowSpan={2} className="px-4 py-3 border-b border-r border-gray-200 w-1/4 align-bottom">
                          Producto / Medida
                        </th>
                        {tecnologias.map((tecnologia) => (
                          <th
                            key={tecnologia.id}
                            colSpan={rangos.length}
                            className="px-4 py-2 border-b border-r border-gray-200 text-center bg-slate-100 text-slate-700 last:border-r-0"
                          >
                            {tecnologia.nombre}
                          </th>
                        ))}
                      </tr>
                      {/* Range Headers */}
                      <tr>
                        {tecnologias.map((tecnologia) => (
                          rangos.map((rango, rIdx) => (
                            <th
                              key={`${tecnologia.id}-${rIdx}`}
                              className="px-2 py-2 border-b border-r border-gray-200 text-center text-xs w-16 last:border-r-0"
                            >
                              {formatRango(rango, unidadMedida)}
                            </th>
                          ))
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grupoProductos.map((producto, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 avoid-break">
                          <td className="px-4 py-3 border-r border-gray-100 text-slate-700">
                            <div className="font-medium">{producto.nombre}</div>
                            <div className="text-xs text-slate-500">{producto.ancho_cm} × {producto.alto_cm} cm</div>
                          </td>
                          {tecnologias.map((tecnologia) => (
                            rangos.map((rango, rIdx) => {
                              const hasThisTech = producto.tecnologias.some(
                                t => t.id === tecnologia.id
                              );
                              const precio = hasThisTech
                                ? getPrecio(producto, tecnologia.id, rango)
                                : '-';

                              return (
                                <td
                                  key={`${tecnologia.id}-${rIdx}`}
                                  className={`px-2 py-3 border-r border-gray-100 text-right text-slate-700 ${!hasThisTech ? 'bg-gray-50/50 text-gray-400' : ''}`}
                                >
                                  {precio}
                                </td>
                              );
                            })
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

PortabannersPDFTemplate.displayName = 'PortabannersPDFTemplate';
