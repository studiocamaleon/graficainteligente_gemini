import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TecnologiaAgrupada } from './useAllProductosGranFormatoPrecios';
import { formatCurrency } from '../utils/pdfHelpers';
import { isInfiniteRango, normalizeRangoMax } from '../utils/rangoUtils';

const getInkLabel = (tinta: string): string => {
    const labels: { [key: string]: string } = {
        CMYK: 'CMYK',
        RGB: 'RGB',
        BLANCO: 'Blanco',
        BARNIZ: 'Barniz',
    };
    return labels[tinta.toUpperCase()] || tinta;
};

export function useGranFormatoExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (tecnologias: TecnologiaAgrupada[]) => {
        try {
            setIsExporting(true);
            const doc = new jsPDF();

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Gran Formato', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35;

            // Iterate Technologies
            for (const tecnologia of tecnologias) {
                // Check if we need a new page for the technology header
                if (finalY > 250) {
                    doc.addPage();
                    finalY = 20;
                }

                // Technology Header
                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.setFont('helvetica', 'bold');
                doc.text(tecnologia.nombre, 14, finalY);
                finalY += 8;

                // Iterate Inks
                for (const tintaData of tecnologia.tintas) {
                    // Ink Subheader
                    if (finalY > 250) {
                        doc.addPage();
                        finalY = 20;
                    }

                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(70);
                    doc.text(`Tinta: ${getInkLabel(tintaData.tinta)}`, 14, finalY);
                    finalY += 6;

                    // Iterate Range Groups
                    for (const [rangoId, productos] of tintaData.productosPorRango.entries()) {
                        if (productos.length === 0) continue;

                        const primerProducto = productos[0];
                        const isLinear = primerProducto.tipo_venta === 'mt_lineal';
                        const ranges = primerProducto.rangos;

                        // Define Columns
                        const head = [['Producto', 'Unidad']];
                        if (isLinear) head[0].push('Ancho');

                        ranges.forEach(r => {
                            const nMax = normalizeRangoMax(r.max);
                            const label = isInfiniteRango(nMax) ? `>= ${r.min}` : `${r.min}-${nMax}`;
                            head[0].push(`${label}\n${primerProducto.unidad_medida}`);
                        });

                        // Define Rows
                        const body = productos.map(p => {
                            const row = [
                                p.nombre,
                                p.tipo_venta === 'mt2' ? 'm²' : 'ml'
                            ];

                            if (isLinear) {
                                row.push(p.ancho_fijo ? `${p.ancho_fijo} cm` : '-');
                            }

                            ranges.forEach(r => {
                                const nMax = normalizeRangoMax(r.max);
                                const precioObj = p.precios?.find(
                                    pr => pr.rango_min === r.min && pr.rango_max === nMax
                                );
                                row.push(precioObj && precioObj.precio > 0
                                    ? formatCurrency(precioObj.precio)
                                    : '-');
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
                                0: { fontStyle: 'bold', cellWidth: 40, halign: 'left' }, // Name
                                1: { halign: 'center', cellWidth: 20 }, // Unit
                                // Remaining columns (prices) default to auto but we can align them
                            },
                            didParseCell: (data) => {
                                // Right align price columns (start index depends on isLinear)
                                const firstPriceColIndex = isLinear ? 3 : 2;
                                if (data.section === 'body' && data.column.index >= firstPriceColIndex) {
                                    data.cell.styles.halign = 'right';
                                }
                            },
                            margin: { left: 14, right: 14 }
                        });

                        finalY = (doc as any).lastAutoTable.finalY + 10;
                    }
                }

                finalY += 5; // Extra space between technologies
            }

            doc.save(`Lista_Precios_Gran_Formato_${new Date().toISOString().split('T')[0]}.pdf`);

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
