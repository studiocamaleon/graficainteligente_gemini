import { forwardRef } from 'react';
import { formatCurrency } from '../../../utils/pdfHelpers';
import { isInfiniteRango, normalizeRangoMax, normalizeRangoMin } from '../../../utils/rangoUtils';
import type { ProductoPorAncho } from '../../../hooks/useAllProductosPlotterCortePrecios';

interface PlotterCortePDFTemplateProps {
  productosPorAncho: ProductoPorAncho[];
}

export const PlotterCortePDFTemplate = forwardRef<HTMLDivElement, PlotterCortePDFTemplateProps>(
  ({ productosPorAncho }, ref) => {

    // Check if we have data
    if (productosPorAncho.length === 0) {
      return (
        <div ref={ref} className="p-12 text-center text-gray-500">
          No hay productos configurados.
        </div>
      );
    }

    // Assume all products share the same range structure (as implied by previous logic)
    // or we can extract ranges from the first item if safe.
    const ranges = productosPorAncho[0].rangos;

    return (
      <div
        ref={ref}
        className="bg-white p-4 font-sans text-gray-900"
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
        <div className="mb-4 border-b border-gray-100 pb-3">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Lista de Precios</h1>
              <p className="text-gray-500 mt-0">Plotter de Corte</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="border border-gray-200 rounded-lg overflow-hidden avoid-break">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3 border-b border-gray-200">Material</th>
                  <th className="px-4 py-3 border-b border-gray-200 text-center w-24">Ancho</th>
                  {ranges.map((rango, idx) => {
                    const min = normalizeRangoMin(rango.min);
                    const max = normalizeRangoMax(rango.max);
                    const label = isInfiniteRango(max) ? `≥ ${min}` : `${min}-${max}`;
                    return (
                      <th key={idx} className="px-4 py-3 border-b border-gray-200 text-right">
                        {label} <span className="normal-case font-normal text-xs text-gray-400 block">ml</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productosPorAncho.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 avoid-break">
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {item.producto_nombre}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 font-medium">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {item.ancho} cm
                      </span>
                    </td>
                    {ranges.map((rango, rIdx) => {
                      const min = normalizeRangoMin(rango.min);
                      const max = normalizeRangoMax(rango.max);
                      const key = `${min}-${max}`;
                      const precio = item.precios?.get(key);

                      return (
                        <td key={rIdx} className="px-4 py-3 text-right font-medium text-slate-700">
                          {precio ? formatCurrency(precio) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
);

PlotterCortePDFTemplate.displayName = 'PlotterCortePDFTemplate';
