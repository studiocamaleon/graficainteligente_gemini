import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFTable } from '../PDFTable';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { PDFBadge } from '../PDFBadge';
import { formatCurrency } from '../../../utils/pdfHelpers';
import type { TecnologiaAgrupada } from '../../../hooks/useAllProductosGranFormatoPrecios';

interface GranFormatoPDFTemplateProps {
  tecnologias: TecnologiaAgrupada[];
}

const getInkBadgeText = (tinta: string): string => {
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
      <PDFLayout
        ref={ref}
        title="Lista de Precios"
        subtitle="Gran Formato"
      >
        <div className="space-y-8">
          {tecnologias.map((tecnologia) => (
            <div key={tecnologia.id} className="space-y-4">
              <PDFSectionHeader
                title={tecnologia.nombre}
                color="purple"
              />

              {tecnologia.tintas.map((tintaData) => (
                <div key={tintaData.tinta} className="ml-4 space-y-3">
                  <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-700">Tinta:</span>
                    <PDFBadge label={getInkBadgeText(tintaData.tinta)} color="blue" />
                  </div>

                  {Array.from(tintaData.productosPorRango.entries()).map(([rangoId, productos]) => {
                    if (productos.length === 0) return null;

                    const primerProducto = productos[0];
                    const columns: any[] = [
                      { header: 'Producto', key: 'nombre', align: 'left' as const, width: '30%' },
                      { header: 'Tipo de Venta', key: 'tipo_venta', align: 'center' as const, width: '15%' },
                    ];

                    if (primerProducto.tipo_venta === 'mt_lineal') {
                      columns.push({
                        header: 'Ancho',
                        key: 'ancho',
                        align: 'center' as const,
                        width: '12%',
                      });
                    }

                    primerProducto.rangos.forEach((rango) => {
                      const rangoText =
                        rango.max === Infinity
                          ? `≥ ${rango.min} ${primerProducto.unidad_medida}`
                          : `${rango.min}-${rango.max} ${primerProducto.unidad_medida}`;
                      columns.push({
                        header: rangoText,
                        key: `rango_${rango.min}_${rango.max}`,
                        align: 'right' as const,
                      });
                    });

                    const tableData = productos.map((producto) => {
                      const row: Record<string, any> = {
                        nombre: producto.nombre,
                        tipo_venta: producto.tipo_venta === 'mt2' ? 'm²' : 'mt lineal',
                      };

                      if (primerProducto.tipo_venta === 'mt_lineal') {
                        row.ancho = producto.ancho_fijo ? `${producto.ancho_fijo} cm` : '-';
                      }

                      primerProducto.rangos.forEach((rango) => {
                        const precioData = producto.precios.find(
                          (p) => p.rango_min === rango.min && p.rango_max === rango.max
                        );
                        row[`rango_${rango.min}_${rango.max}`] = precioData
                          ? formatCurrency(precioData.precio)
                          : '-';
                      });

                      return row;
                    });

                    return (
                      <PDFTable
                        key={rangoId}
                        columns={columns}
                        data={tableData}
                        className="mb-4"
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </PDFLayout>
    );
  }
);

GranFormatoPDFTemplate.displayName = 'GranFormatoPDFTemplate';
