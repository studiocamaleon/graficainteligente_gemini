import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { PDFTable } from '../PDFTable';
import { PDFBadge } from '../PDFBadge';
import type { ProductoSelloConPrecio } from '../../../hooks/useProductosSellosPrecios';

interface SellosPDFTemplateProps {
  productos: ProductoSelloConPrecio[];
}

const getTipoProductoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    sello: 'Sello',
    repuesto: 'Repuesto',
    polimero: 'Polímero',
    tinta: 'Tinta',
    accesorios: 'Accesorios',
  };
  return labels[tipo] || tipo;
};

const formatMedida = (ancho: number | null, alto: number | null): string => {
  if (!ancho && !alto) return '-';
  if (ancho && alto) return `${ancho} x ${alto} mm`;
  if (ancho) return `${ancho} mm`;
  if (alto) return `${alto} mm`;
  return '-';
};

export const SellosPDFTemplate = forwardRef<HTMLDivElement, SellosPDFTemplateProps>(
  ({ productos }, ref) => {
    const columns = [
      { key: 'nombre', label: 'Producto' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'medida', label: 'Medida' },
      { key: 'marca', label: 'Marca' },
      { key: 'precio', label: 'Precio Unitario' },
    ];

    const data = productos.map((producto) => ({
      nombre: producto.nombre,
      tipo: (
        <PDFBadge variant="violet">{getTipoProductoLabel(producto.tipo_producto)}</PDFBadge>
      ),
      medida: formatMedida(producto.medida_ancho, producto.medida_alto),
      marca: producto.marca || '-',
      precio: producto.precio_unitario > 0 ? `$ ${producto.precio_unitario.toFixed(2)}` : '-',
    }));

    return (
      <PDFLayout ref={ref} title="Lista de Precios - Sellos y Accesorios">
        <PDFSectionHeader
          title="Productos de Sellos"
          description="Lista completa de precios unitarios"
        />
        <PDFTable columns={columns} data={data} />

        <div style={{ marginTop: '24px', fontSize: '12px', color: '#6B7280' }}>
          <p>
            <strong>Nota:</strong> Los precios mostrados son unitarios y no incluyen IVA. El
            impuesto se aplica según la configuración de cada producto.
          </p>
          <p style={{ marginTop: '8px' }}>
            Total de productos: {productos.length}
          </p>
        </div>
      </PDFLayout>
    );
  }
);

SellosPDFTemplate.displayName = 'SellosPDFTemplate';
