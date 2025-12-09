import { forwardRef } from 'react';
import { formatCurrency } from '../../../utils/pdfHelpers';
import { isInfiniteRango, normalizeRangoMax } from '../../../utils/rangoUtils';
import type { TecnologiaAgrupada } from '../../../hooks/useAllProductosGranFormatoPrecios';

interface GranFormatoPDFTemplateProps {
  tecnologias: TecnologiaAgrupada[];
}

const getInkLabel = (tinta: string): string => {
  const tintaUpper = tinta.toUpperCase();
  const labels: { [key: string]: string } = {
    CMYK: 'CMYK',
    RGB: 'RGB',
    BLANCO: 'Blanco',
    BARNIZ: 'Barniz',
  };
  return labels[tintaUpper] || tinta;
};

export const GranFormatoPDFTemplate = forwardRef<HTMLDivElement, GranFormatoPDFTemplateProps>(
  ({ tecnologias }, ref) => {
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
              <p className="text-gray-500 mt-1">Gran Formato</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {tecnologias.map((tecnologia, techIndex) => (
            <div key={tecnologia.id} className={`${techIndex > 0 ? 'page-break' : ''}`}>
              {/* Technology Header */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3">
                  {tecnologia.nombre}
                </h2>
              </div>

              <div className="space-y-10">
                {tecnologia.tintas.map((tintaData) => (
                  <div key={tintaData.tinta} className="avoid-break">

                    {/* Ink Header */}
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded">
                        Tinta: {getInkLabel(tintaData.tinta)}
                      </span>
                    </div>

                    <div className="space-y-6">
                      {Array.from(tintaData.productosPorRango.entries()).map(([rangoId, productos]) => {
                        if (productos.length === 0) return null;

                        const primerProducto = productos[0];
                        const isLinear = primerProducto.tipo_venta === 'mt_lineal';

                        // Extract Ranges for Headers
                        const ranges = primerProducto.rangos;

                        return (
                          <div key={rangoId} className="border border-gray-200 rounded-lg overflow-hidden avoid-break">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                                <tr>
                                  <th className="px-4 py-3 border-b border-gray-200 w-1/4">Producto</th>
                                  <th className="px-4 py-3 border-b border-gray-200 w-24 text-center">Unidad</th>
                                  {isLinear && (
                                    <th className="px-4 py-3 border-b border-gray-200 w-20 text-center">Ancho</th>
                                  )}
                                  {ranges.map((rango, idx) => {
                                    const nMax = normalizeRangoMax(rango.max);
                                    const label = isInfiniteRango(nMax)
                                      ? `≥ ${rango.min}`
                                      : `${rango.min}-${nMax}`;
                                    return (
                                      <th key={idx} className="px-4 py-3 border-b border-gray-200 text-right">
                                        {label}
                                        <span className="normal-case font-normal text-xs text-gray-400 block">{primerProducto.unidad_medida}</span>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {productos.map((producto, pIdx) => (
                                  <tr key={pIdx} className="hover:bg-slate-50/50 avoid-break">
                                    <td className="px-4 py-3 font-medium text-slate-700">
                                      {producto.nombre}
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-500 text-xs">
                                      {producto.tipo_venta === 'mt2' ? 'm²' : 'ml'}
                                    </td>
                                    {isLinear && (
                                      <td className="px-4 py-3 text-center text-slate-600">
                                        {producto.ancho_fijo ? `${producto.ancho_fijo} cm` : '-'}
                                      </td>
                                    )}
                                    {ranges.map((rango, rIdx) => {
                                      const nMax = normalizeRangoMax(rango.max);
                                      const precioObj = producto.precios?.find(
                                        p => p.rango_min === rango.min && p.rango_max === nMax
                                      );

                                      return (
                                        <td key={rIdx} className="px-4 py-3 text-right font-medium text-slate-700">
                                          {precioObj && precioObj.precio > 0
                                            ? formatCurrency(precioObj.precio)
                                            : <span className="text-gray-300">-</span>
                                          }
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

GranFormatoPDFTemplate.displayName = 'GranFormatoPDFTemplate';
