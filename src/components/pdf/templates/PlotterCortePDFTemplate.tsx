import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFTable } from '../PDFTable';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { PDFBadge } from '../PDFBadge';
import { formatCurrency } from '../../../utils/pdfHelpers';
import { isInfiniteRango, normalizeRangoMax, normalizeRangoMin } from '../../../utils/rangoUtils';
import type { ProductoPorAncho } from '../../../hooks/useAllProductosPlotterCortePrecios';

interface PlotterCortePDFTemplateProps {
  productosPorAncho: ProductoPorAncho[];
}

export const PlotterCortePDFTemplate = forwardRef<HTMLDivElement, PlotterCortePDFTemplateProps>(
  ({ productosPorAncho }, ref) => {
    if (productosPorAncho.length === 0) {
      return (
        <PDFLayout ref={ref} title="Lista de Precios" subtitle="Plotter de Corte">
          <div className="text-center text-gray-500 py-8">
            No hay productos con precios configurados
          </div>
        </PDFLayout>
      );
    }

    const primerItem = productosPorAncho[0];
    const rangos = primerItem.rangos;

    const columns: any[] = [
      { header: 'Material', key: 'material', align: 'left' as const, width: '40%' },
    ];

    rangos.forEach(rango => {
      const normalizedMin = normalizeRangoMin(rango.min);
      const normalizedMax = normalizeRangoMax(rango.max);
      const rangoText = isInfiniteRango(normalizedMax)
        ? `≥ ${normalizedMin} ml`
        : `${normalizedMin}-${normalizedMax} ml`;
      columns.push({
        header: rangoText,
        key: `rango_${normalizedMin}_${normalizedMax}`,
        align: 'right' as const,
      });
    });

    const tableData = productosPorAncho.map(item => {
      const row: Record<string, any> = {
        material: (
          <div className="flex items-center gap-2">
            <span>{item.producto_nombre}</span>
            <PDFBadge label={`${item.ancho} cm`} color="pink" />
          </div>
        ),
      };

      item.rangos.forEach(rango => {
        const normalizedMin = normalizeRangoMin(rango.min);
        const normalizedMax = normalizeRangoMax(rango.max);
        const rangoKey = `${normalizedMin}-${normalizedMax}`;
        const precio = item.precios?.get(rangoKey);
        row[`rango_${normalizedMin}_${normalizedMax}`] = precio
          ? formatCurrency(precio)
          : '-';
      });

      return row;
    });

    return (
      <PDFLayout ref={ref} title="Lista de Precios" subtitle="Plotter de Corte">
        <div className="space-y-6">
          <PDFSectionHeader title="Productos de Plotter de Corte" color="pink" />
          <PDFTable columns={columns} data={tableData} />
        </div>
      </PDFLayout>
    );
  }
);

PlotterCortePDFTemplate.displayName = 'PlotterCortePDFTemplate';
