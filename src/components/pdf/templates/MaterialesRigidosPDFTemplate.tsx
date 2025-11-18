import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFTable } from '../PDFTable';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { PDFBadge } from '../PDFBadge';
import { formatCurrency } from '../../../utils/pdfHelpers';
import type { ProductosAgrupadosPorMaterial } from '../../../hooks/useAllProductosMaterialesRigidosPrecios';

interface MaterialesRigidosPDFTemplateProps {
  productosAgrupados: ProductosAgrupadosPorMaterial;
}

const calcularM2Placa = (ancho: number, alto: number): number => {
  return (ancho * alto) / 10000;
};

const calcularPrecioM2 = (
  precioPlaca: number,
  ancho: number,
  alto: number
): number => {
  const m2 = calcularM2Placa(ancho, alto);
  return m2 > 0 ? precioPlaca / m2 : 0;
};

export const MaterialesRigidosPDFTemplate = forwardRef<HTMLDivElement, MaterialesRigidosPDFTemplateProps>(
  ({ productosAgrupados }, ref) => {
    const materialesIds = Object.keys(productosAgrupados);

    return (
      <PDFLayout
        ref={ref}
        title="Lista de Precios"
        subtitle="Materiales Rígidos"
      >
        <div className="space-y-8">
          {materialesIds.map((materialId) => {
            const grupo = productosAgrupados[materialId];

            const columns = [
              { header: 'Producto', key: 'nombre', align: 'left' as const, width: '22%' },
              { header: 'Variante', key: 'variante', align: 'left' as const, width: '18%' },
              { header: 'Espesor', key: 'espesor', align: 'center' as const, width: '13%' },
              { header: 'Medida de Placa', key: 'medida', align: 'center' as const, width: '20%' },
              { header: 'Precio por Placa', key: 'precio_placa', align: 'right' as const, width: '13%' },
              { header: 'Precio por m²', key: 'precio_m2', align: 'right' as const, width: '14%' },
            ];

            const tableData = grupo.productos.map((producto) => {
              const precioPlaca = producto.precio_actual?.precio_placa || 0;
              const precioM2 =
                precioPlaca > 0
                  ? calcularPrecioM2(
                      precioPlaca,
                      producto.medida_placa_ancho,
                      producto.medida_placa_alto
                    )
                  : 0;
              const m2Placa = calcularM2Placa(
                producto.medida_placa_ancho,
                producto.medida_placa_alto
              );

              return {
                nombre: producto.nombre,
                variante: producto.material.variante_nombre,
                espesor:
                  producto.material.espesor !== null
                    ? `${producto.material.espesor} mm`
                    : 'No aplica',
                medida: `${producto.medida_placa_ancho} × ${producto.medida_placa_alto} cm (${m2Placa.toFixed(2)} m²)`,
                precio_placa: precioPlaca > 0 ? formatCurrency(precioPlaca) : '-',
                precio_m2: precioM2 > 0 ? formatCurrency(precioM2) : '-',
              };
            });

            return (
              <div key={materialId} className="space-y-4">
                <PDFSectionHeader
                  title={grupo.material_nombre}
                  badge={
                    <PDFBadge
                      label={`${grupo.productos.length} ${grupo.productos.length === 1 ? 'combinación' : 'combinaciones'}`}
                      color="blue"
                      size="md"
                    />
                  }
                  color="blue"
                />

                <PDFTable
                  columns={columns}
                  data={tableData}
                />
              </div>
            );
          })}
        </div>
      </PDFLayout>
    );
  }
);

MaterialesRigidosPDFTemplate.displayName = 'MaterialesRigidosPDFTemplate';
