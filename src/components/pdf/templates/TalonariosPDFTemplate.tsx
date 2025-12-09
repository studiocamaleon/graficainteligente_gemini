import { forwardRef } from 'react';
import { InkColorCircles } from '../InkColorCircles';
import { formatCurrency, sortTintas } from '../../../utils/pdfHelpers';
import type { ProductoTalonarioParaPrecios } from '../../../hooks/useAllProductosTalonarioPrecios';

interface TalonariosPDFTemplateProps {
  productos: ProductoTalonarioParaPrecios[];
}

const getCantidades = (producto: ProductoTalonarioParaPrecios): number[] => {
  if (producto.tipo_venta === 'cantidades_fijas') {
    return producto.cantidades_fijas || [];
  }
  return [1];
};

const formatCaraLabel = (cara: string): string => {
  if (cara === 'solo_frente') return 'Solo Frente';
  if (cara === 'frente_y_dorso') return 'Frente y Dorso';
  return cara;
};

interface MedidaGroup {
  medida: { ancho: number; alto: number };
  tintas: string[];
}

export const TalonariosPDFTemplate = forwardRef<HTMLDivElement, TalonariosPDFTemplateProps>(
  ({ productos }, ref) => {
    const getMaterialInfo = (producto: ProductoTalonarioParaPrecios): string => {
      if (producto.materiales.length === 0) return '';
      const material = producto.materiales[0];
      let info = `${material.material_nombre} - ${material.variante_nombre}`;
      if (material.espesor) {
        info += ` (${material.espesor} ${material.unidad_espesor})`;
      }
      return info;
    };

    const groupByMedida = (producto: ProductoTalonarioParaPrecios): MedidaGroup[] => {
      const groups = new Map<string, MedidaGroup>();

      producto.medidas_disponibles.forEach((medida) => {
        const key = `${medida.ancho}x${medida.alto}`;

        if (!groups.has(key)) {
          const todasLasTintas: string[] = [];
          producto.tecnologias.forEach((tecnologia) => {
            tecnologia.tintas.forEach((tinta) => {
              todasLasTintas.push(tinta);
            });
          });

          const tintasOrdenadas = sortTintas(todasLasTintas);

          groups.set(key, {
            medida,
            tintas: tintasOrdenadas,
          });
        }
      });

      return Array.from(groups.values());
    };

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
              <p className="text-gray-500 mt-0">Talonarios</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {productos.map((producto, index) => {
            const materialInfo = getMaterialInfo(producto);
            const medidaGroups = groupByMedida(producto);
            const cantidades = getCantidades(producto);

            return (
              <div key={producto.id} className={`${index > 0 ? 'page-break' : ''}`}>
                {/* Product Header */}
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-slate-900 border-l-4 border-indigo-500 pl-3">
                    {producto.nombre}
                  </h2>
                  {materialInfo && (
                    <div className="text-sm text-slate-500 mt-1 pl-4">
                      {materialInfo}
                    </div>
                  )}
                </div>

                {medidaGroups.length === 0 ? (
                  <div className="text-sm text-gray-400 italic bg-gray-50 p-6 rounded-lg text-center">
                    Sin configuraciones disponibles
                  </div>
                ) : (
                  <div className="space-y-10">
                    {medidaGroups.map((group) => {
                      const useSideBySide = group.tintas.length >= 2;

                      return (
                        <div key={`${group.medida.ancho}x${group.medida.alto}`} className="avoid-break">
                          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                            <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded">
                              Medida: {group.medida.ancho} × {group.medida.alto} cm
                            </span>
                          </div>

                          <div className={`grid gap-8 ${useSideBySide ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {group.tintas.map((tinta) => (
                              <div key={tinta} className="avoid-break space-y-3">
                                <div className="flex items-center gap-2">
                                  <InkColorCircles tinta={tinta} size="sm" />
                                  <span className="font-bold text-slate-700 text-sm">{tinta}</span>
                                </div>

                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                                      <tr>
                                        <th className="px-4 py-2 border-b border-gray-200 w-1/3">Cantidad</th>
                                        {producto.tipo_copia.map(cara => (
                                          <th key={cara} className="px-4 py-2 border-b border-gray-200 text-right">
                                            {formatCaraLabel(cara)}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {cantidades.map((cantidad, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 avoid-break">
                                          <td className="px-4 py-2 text-slate-700 font-medium">{cantidad}</td>
                                          {producto.tipo_copia.map(cara => {
                                            const precio = producto.precios_existentes.find(
                                              p => p.medida_ancho === group.medida.ancho &&
                                                p.medida_alto === group.medida.alto &&
                                                p.tinta === tinta &&
                                                p.cantidad === cantidad &&
                                                p.tipo_copia === cara
                                            );
                                            return (
                                              <td key={cara} className="px-4 py-2 text-right text-slate-600">
                                                {precio?.precio && precio.precio > 0 ? formatCurrency(precio.precio) : '-'}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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

TalonariosPDFTemplate.displayName = 'TalonariosPDFTemplate';
