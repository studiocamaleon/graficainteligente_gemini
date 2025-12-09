import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProductoPorAncho } from './useAllProductosPlotterCortePrecios';
import { formatCurrency } from '../utils/pdfHelpers';
import { isInfiniteRango, normalizeRangoMax, normalizeRangoMin } from '../utils/rangoUtils';

export function usePlotterCorteExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (productosPorAncho: ProductoPorAncho[]) => {
        if (!productosPorAncho || productosPorAncho.length === 0) return;

        try {
            setIsExporting(true);
            const doc = new jsPDF();

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Plotter de Corte', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35;

            // Get ranges from first item (Assuming all share same ranges for this module)
            const ranges = productosPorAncho[0].rangos;

            // Define Columns
            const head = [['Material', 'Ancho']];

            // Add Range Columns
            ranges.forEach(r => {
                const min = normalizeRangoMin(r.min);
                const max = normalizeRangoMax(r.max);
                const label = isInfiniteRango(max) ? `>= ${min}` : `${min}-${max}`;
                head[0].push(`${label}\nml`);
            });

            // Define Rows
            const body = productosPorAncho.map(item => {
                const row = [
                    item.producto_nombre,
                    `${item.ancho} cm`
                ];

                ranges.forEach(r => {
                    const min = normalizeRangoMin(r.min);
                    const max = normalizeRangoMax(r.max);
                    const key = `${min}-${max}`;
                    const precio = item.precios?.get(key);
                    row.push(precio ? formatCurrency(precio) : '-');
                });

                return row;
            });

            autoTable(doc, {
                startY: finalY,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: {
                    fillColor: [63, 81, 181],
                    fontSize: 9,
                    halign: 'center',
                    valign: 'middle'
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                    valign: 'middle'
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 'auto', halign: 'left' }, // Material
                    1: { halign: 'center', cellWidth: 25 }, // Ancho
                    // Range columns align right
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index >= 2) {
                        data.cell.styles.halign = 'right';
                    }
                },
                margin: { left: 14, right: 14 }
            });

            doc.save(`Lista_Precios_Plotter_Corte_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    }, []);

    return {
        handleExport,
        isExporting
    };
}
