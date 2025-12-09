import { forwardRef } from 'react';
import { InkColorCircles } from '../InkColorCircles';
import { formatCurrency, sortTintas } from '../../../utils/pdfHelpers';
import type { ProductoLaserParaPrecios } from '../../../hooks/useAllProductosLaserPrecios';
import { formatRangoValue } from '../../../utils/rangoUtils';

interface ImpresionLaserPDFTemplateProps {
  productos: ProductoLaserParaPrecios[];
}

interface MedidaGroup {
  medida: { ancho: number; alto: number };
  tintas: string[];
}

const formatCaraLabel = (cara: string): string => {
  if (cara === 'solo_frente') return 'Solo Frente';
  if (cara === 'frente_y_dorso') return 'Frente y Dorso';
  return cara;
};

export const ImpresionLaserPDFTemplate = forwardRef<HTMLDivElement, ImpresionLaserPDFTemplateProps>(
  ({ productos }, ref) => {

    // Helper to group product configurations by Size (Medida)
    const groupByMedida = (producto: ProductoLaserParaPrecios): MedidaGroup[] => {
      const groups = new Map<string, MedidaGroup>();
      producto.medidas_disponibles.forEach((medida) => {
        const key = `${medida.ancho}x${medida.alto}`;
        if (!groups.has(key)) {
          const todasLasTintas: string[] = [];
          producto.tecnologias.forEach((tecnologia) => {
            tecnologia.tintas.forEach((tinta) => todasLasTintas.push(tinta));
          });
          groups.set(key, { medida, tintas: sortTintas(todasLasTintas) });
        }
      });
      return Array.from(groups.values());
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
              <p className="text-gray-500 mt-1">Impresión Láser</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {productos.map((producto, index) => {
            const medidaGroups = groupByMedida(producto);
            // Determine columns based on sales type
            const isRange = (producto.tipo_venta as string) === 'rango' || producto.tipo_venta === 'unidades';

            return (
              <div key={producto.id} className={`${index > 0 ? 'page-break' : ''} mb-8`}>
                {/* Product Header */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                    {producto.nombre}
                  </h2>
                  {producto.materiales.length > 0 && (
                    <div className="text-sm text-slate-500 mt-1 pl-0.5">
                      {producto.materiales.map((m, i) => (
                        <span key={i}>{m.material_nombre} {m.variante_nombre} {m.espesor ? `(${m.espesor} ${m.unidad_espesor})` : ''}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Groups by Medida */}
                {medidaGroups.length === 0 ? (
                  <div className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center">Sin configuraciones disponibles</div>
                ) : (
                  <div className="space-y-10">
                    {medidaGroups.map((group) => (
                      <div key={`${group.medida.ancho}x${group.medida.alto}`} className="avoid-break">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                          <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded">
                            {group.medida.ancho} x {group.medida.alto} cm
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          {group.tintas.map((tinta) => (
                            <div key={tinta} className="avoid-break">
                              <div className="flex items-center gap-2 mb-3">
                                <InkColorCircles tinta={tinta} size="sm" />
                                <span className="font-bold text-slate-700 text-sm">{tinta}</span>
                              </div>

                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                                    <tr>
                                      <th className="px-4 py-2 border-b border-gray-200 w-1/3">
                                        {isRange ? (producto.rango_precio?.unidad_medida || 'Cantidad') : 'Cantidad'}
                                      </th>
                                      {producto.caras_impresas.map(cara => (
                                        <th key={cara} className="px-4 py-2 border-b border-gray-200 text-right">
                                          {formatCaraLabel(cara)}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {isRange && producto.rango_precio?.rangos ? (
                                      // Render Rows for Ranges
                                      producto.rango_precio.rangos.map((rango, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 avoid-break">
                                          <td className="px-4 py-2 text-slate-700 font-medium">
                                            {formatRangoValue(rango.min, rango.max || 0, '')}
                                          </td>
                                          {producto.caras_impresas.map(cara => {
                                            const p = producto.precios_existentes.find((cx: any) =>
                                              cx.medida_ancho === group.medida.ancho &&
                                              cx.medida_alto === group.medida.alto &&
                                              cx.tinta === tinta &&
                                              cx.cara_impresa === cara &&
                                              cx.rango_precio_min === rango.min
                                            );
                                            return (
                                              <td key={cara} className="px-4 py-2 text-right text-slate-600">
                                                {p?.precio && p.precio > 0 ? formatCurrency(p.precio) : '-'}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))
                                    ) : (
                                      // Render Rows for Fixed Quantities
                                      producto.cantidades_fijas?.map((qty, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 avoid-break">
                                          <td className="px-4 py-2 text-slate-700 font-medium">
                                            {qty}
                                          </td>
                                          {producto.caras_impresas.map(cara => {
                                            const p = producto.precios_existentes.find(cx =>
                                              cx.medida_ancho === group.medida.ancho &&
                                              cx.medida_alto === group.medida.alto &&
                                              cx.tinta === tinta &&
                                              cx.cara_impresa === cara &&
                                              cx.cantidad === qty
                                            );
                                            return (
                                              <td key={cara} className="px-4 py-2 text-right text-slate-600">
                                                {p?.precio && p.precio > 0 ? formatCurrency(p.precio) : '-'}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ImpresionLaserPDFTemplate.displayName = 'ImpresionLaserPDFTemplate';
