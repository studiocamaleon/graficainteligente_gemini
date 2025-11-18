import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFTable } from '../PDFTable';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { formatCurrency } from '../../../utils/pdfHelpers';
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

export const ImpresionLaserPDFTemplate = forwardRef<HTMLDivElement, ImpresionLaserPDFTemplateProps>(
  ({ productos }, ref) => {
    return (
      <PDFLayout
        ref={ref}
        title="Lista de Precios"
        subtitle="Impresión Láser"
      >
        <div className="space-y-8">
          {productos.map((producto) => {
            let subtitle = '';
            if (producto.materiales.length > 0) {
              const material = producto.materiales[0];
              subtitle = `Material: ${material.material_nombre} - ${material.variante_nombre}`;
              if (material.espesor) {
                subtitle += ` (${material.espesor} ${material.unidad_espesor})`;
              }
            }

            const combinaciones: Array<{
              medida: string;
              tinta: string;
              cantidad: number;
              cara: string;
              precio: number;
            }> = [];

            producto.medidas_disponibles.forEach((medida) => {
              producto.tecnologias.forEach((tecnologia) => {
                tecnologia.tintas.forEach((tinta) => {
                  const cantidades = getCantidades(producto);

                  cantidades.forEach((cantidad) => {
                    producto.caras_impresas.forEach((cara) => {
                      const precioExistente = producto.precios_existentes.find(
                        (p) =>
                          p.medida_ancho === medida.ancho &&
                          p.medida_alto === medida.alto &&
                          p.tinta_id === tinta.id &&
                          p.cantidad === cantidad &&
                          p.cara_impresa === cara
                      );

                      if (precioExistente) {
                        combinaciones.push({
                          medida: `${medida.ancho} × ${medida.alto} cm`,
                          tinta: tinta.nombre,
                          cantidad: cantidad,
                          cara: cara === 'simple' ? 'Simple' : 'Doble',
                          precio: precioExistente.precio,
                        });
                      }
                    });
                  });
                });
              });
            });

            const columns = [
              { header: 'Medida', key: 'medida', align: 'center' as const, width: '25%' },
              { header: 'Tinta', key: 'tinta', align: 'left' as const, width: '30%' },
              { header: 'Cantidad', key: 'cantidad', align: 'center' as const, width: '15%' },
              { header: 'Cara', key: 'cara', align: 'center' as const, width: '15%' },
              { header: 'Precio', key: 'precio', align: 'right' as const, width: '15%' },
            ];

            const tableData = combinaciones.map((combo) => ({
              medida: combo.medida,
              tinta: combo.tinta,
              cantidad: combo.cantidad.toString(),
              cara: combo.cara,
              precio: formatCurrency(combo.precio),
            }));

            return (
              <div key={producto.id} className="space-y-4 page-break">
                <PDFSectionHeader
                  title={producto.nombre}
                  subtitle={subtitle}
                  color="blue"
                />

                {combinaciones.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    Sin precios configurados
                  </div>
                ) : (
                  <PDFTable
                    columns={columns}
                    data={tableData}
                  />
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
