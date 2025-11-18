import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFTable } from '../PDFTable';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { InkColorCircles } from '../InkColorCircles';
import { formatCurrency, sortTintas } from '../../../utils/pdfHelpers';
import type { ProductoLaserParaPrecios } from '../../../hooks/useAllProductosLaserPrecios';

interface ImpresionLaserPDFTemplateProps {
  productos: ProductoLaserParaPrecios[];
}

const getCantidades = (producto: ProductoLaserParaPrecios): number[] => {
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

interface TintaData {
  id: string;
  nombre: string;
}

interface MedidaGroup {
  medida: { ancho: number; alto: number };
  tintas: TintaData[];
}

export const ImpresionLaserPDFTemplate = forwardRef<HTMLDivElement, ImpresionLaserPDFTemplateProps>(
  ({ productos }, ref) => {
    const getMaterialInfo = (producto: ProductoLaserParaPrecios): string => {
      if (producto.materiales.length === 0) return '';
      const material = producto.materiales[0];
      let info = `${material.material_nombre} - ${material.variante_nombre}`;
      if (material.espesor) {
        info += ` (${material.espesor} ${material.unidad_espesor})`;
      }
      return info;
    };

    const groupByMedida = (producto: ProductoLaserParaPrecios): MedidaGroup[] => {
      const groups = new Map<string, MedidaGroup>();

      producto.medidas_disponibles.forEach((medida) => {
        const key = `${medida.ancho}x${medida.alto}`;

        if (!groups.has(key)) {
          const todasLasTintas: TintaData[] = [];
          producto.tecnologias.forEach((tecnologia) => {
            tecnologia.tintas.forEach((tinta) => {
              todasLasTintas.push(tinta);
            });
          });

          const tintasOrdenadas = sortTintas(todasLasTintas.map(t => t.nombre));
          const tintasOrdenadaData = tintasOrdenadas.map(nombre =>
            todasLasTintas.find(t => t.nombre === nombre)!
          );

          groups.set(key, {
            medida,
            tintas: tintasOrdenadaData,
          });
        }
      });

      return Array.from(groups.values());
    };

    return (
      <PDFLayout
        ref={ref}
        title="Lista de Precios"
        subtitle="Impresión Láser"
      >
        <div className="space-y-10">
          {productos.map((producto) => {
            const materialInfo = getMaterialInfo(producto);
            const medidaGroups = groupByMedida(producto);
            const cantidades = getCantidades(producto);

            return (
              <div key={producto.id} className="space-y-6 page-break">
                <PDFSectionHeader
                  title={producto.nombre}
                  subtitle={materialInfo}
                  color="blue"
                />

                {medidaGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    Sin configuraciones disponibles
                  </div>
                ) : (
                  <div className="space-y-8">
                    {medidaGroups.map((group) => {
                      const useSideBySide = group.tintas.length === 2;

                      return (
                        <div key={`${group.medida.ancho}x${group.medida.alto}`} className="space-y-4">
                          <div className="text-sm font-semibold text-gray-700 bg-gray-100 px-4 py-2 rounded-lg">
                            Medida: {group.medida.ancho} × {group.medida.alto} mm
                          </div>

                          {useSideBySide ? (
                            <div className="grid grid-cols-2 gap-4">
                              {group.tintas.map((tinta) => {
                                const columns = [
                                  { header: 'Cantidad', key: 'cantidad', align: 'center' as const, width: '30%' },
                                  ...producto.caras_impresas.map((cara) => ({
                                    header: formatCaraLabel(cara),
                                    key: cara,
                                    align: 'right' as const,
                                    width: '35%',
                                  })),
                                ];

                                const tableData = cantidades.map((cantidad) => {
                                  const row: any = { cantidad: cantidad.toString() };

                                  producto.caras_impresas.forEach((cara) => {
                                    const precio = producto.precios_existentes.find(
                                      (p) =>
                                        p.medida_ancho === group.medida.ancho &&
                                        p.medida_alto === group.medida.alto &&
                                        p.tinta_id === tinta.id &&
                                        p.cantidad === cantidad &&
                                        p.cara_impresa === cara
                                    );
                                    row[cara] = precio ? formatCurrency(precio.precio) : '-';
                                  });

                                  return row;
                                });

                                return (
                                  <div key={tinta.id} className="space-y-2">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                                      <InkColorCircles tinta={tinta.nombre} size="sm" />
                                      <span className="text-sm font-bold text-gray-800">{tinta.nombre}</span>
                                    </div>
                                    <PDFTable columns={columns} data={tableData} />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {group.tintas.map((tinta) => {
                                const columns = [
                                  { header: 'Cantidad', key: 'cantidad', align: 'center' as const, width: '20%' },
                                  ...producto.caras_impresas.map((cara) => ({
                                    header: formatCaraLabel(cara),
                                    key: cara,
                                    align: 'right' as const,
                                    width: '40%',
                                  })),
                                ];

                                const tableData = cantidades.map((cantidad) => {
                                  const row: any = { cantidad: cantidad.toString() };

                                  producto.caras_impresas.forEach((cara) => {
                                    const precio = producto.precios_existentes.find(
                                      (p) =>
                                        p.medida_ancho === group.medida.ancho &&
                                        p.medida_alto === group.medida.alto &&
                                        p.tinta_id === tinta.id &&
                                        p.cantidad === cantidad &&
                                        p.cara_impresa === cara
                                    );
                                    row[cara] = precio ? formatCurrency(precio.precio) : '-';
                                  });

                                  return row;
                                });

                                return (
                                  <div key={tinta.id} className="space-y-2">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                                      <InkColorCircles tinta={tinta.nombre} size="sm" />
                                      <span className="text-sm font-bold text-gray-800">{tinta.nombre}</span>
                                    </div>
                                    <PDFTable columns={columns} data={tableData} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PDFLayout>
    );
  }
);

ImpresionLaserPDFTemplate.displayName = 'ImpresionLaserPDFTemplate';
