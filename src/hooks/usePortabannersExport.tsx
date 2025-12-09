import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProductoConPrecios, TecnologiaSimple, RangoPrecio } from './useAllProductosPortabannersPrecios';
import { normalizeRangoMin, normalizeRangoMax, formatRangoValue } from '../utils/rangoUtils';

const getUnidadLabel = (unidadMedida: string) => {
    if (unidadMedida === 'mt2') return 'm²';
    if (unidadMedida === 'mt_lineal') return 'ml';
    return 'unidades';
};

const formatRango = (rango: RangoPrecio, unidadMedida: string) => {
    const unidad = getUnidadLabel(unidadMedida);
    const min = normalizeRangoMin(rango.min);
    const max = normalizeRangoMax(rango.max);
    return formatRangoValue(min, max, unidad);
};

export function usePortabannersExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (productosPorRango: ProductoConPrecios[][], tecnologias: TecnologiaSimple[]) => {
        if (!productosPorRango || productosPorRango.length === 0) return;

        try {
            setIsExporting(true);
            const doc = new jsPDF('p', 'mm', 'a4'); // Portrait, mm, A4

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Portabanners', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35;

            // Iterate Groups
            for (const grupoProductos of productosPorRango) {
                if (grupoProductos.length === 0) continue;

                const primerProducto = grupoProductos[0];
                const rangos = primerProducto.rangos;
                const unidadMedida = primerProducto.unidad_medida;
                const rangoNombre = primerProducto.rango_nombre;

                // Group Header
                if (finalY > 250) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.setFont('helvetica', 'bold');
                doc.text(rangoNombre, 14, finalY);
                finalY += 5;

                // Define complex headers
                // Row 1: Product, Tech 1, Tech 2...
                const headerRow1 = [
                    { content: 'Producto / Medida', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } }
                ];

                tecnologias.forEach(tech => {
                    headerRow1.push({
                        content: tech.nombre,
                        colSpan: rangos.length,
                        styles: { halign: 'center' }
                    });
                });

                // Row 2: Empty for Product, Ranges for Techs
                const headerRow2: string[] = [];
                // Note: autoTable handles empty cells for rowSpanned columns automatically in the underlying data structure if we just provide the subsequent columns? 
                // Actually for row 2, we just list the columns that are NOT covered by rowSpan from row 1.
                // But autoTable expects consistent column count or careful handling.
                // Standard way:

                tecnologias.forEach(() => {
                    rangos.forEach(r => {
                        headerRow2.push(formatRango(r, unidadMedida));
                    });
                });

                // Columns definition
                // Col 0: Product
                // Col 1..N: Ranges

                // Body
                const body = grupoProductos.map(producto => {
                    const row: any[] = [
                        `${producto.nombre}\n${producto.ancho_cm} x ${producto.alto_cm} cm`
                    ];

                    tecnologias.forEach(tecnologia => {
                        rangos.forEach(rango => {
                            const min = normalizeRangoMin(rango.min);
                            const max = normalizeRangoMax(rango.max);

                            const hasThisTech = producto.tecnologias.some(t => t.id === tecnologia.id);

                            if (!hasThisTech) {
                                row.push('-');
                                return;
                            }

                            const preciosTec = producto.precios?.get(tecnologia.id);
                            const precioObj = preciosTec?.find(p => p.rango_min === min && p.rango_max === max);

                            row.push(precioObj ? `$${precioObj.precio.toFixed(2)}` : '-');
                        });
                    });

                    return row;
                });

                autoTable(doc, {
                    startY: finalY + 2,
                    head: [headerRow1, headerRow2],
                    body: body,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [63, 81, 181],
                        fontSize: 8,
                        halign: 'center',
                        valign: 'middle',
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200]
                    },
                    styles: {
                        fontSize: 8,
                        cellPadding: 2,
                        valign: 'middle',
                        overflow: 'linebreak'
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: 40, halign: 'left' }
                    },
                    margin: { left: 14, right: 14 },
                    didParseCell: (data) => {
                        // Alternate matching logic for cells if needed
                        if (data.section === 'body' && data.column.index > 0) {
                            data.cell.styles.halign = 'right';
                        }
                    }
                });

                finalY = (doc as any).lastAutoTable.finalY + 15;
            }

            doc.save(`Lista_Precios_Portabanners_${new Date().toISOString().split('T')[0]}.pdf`);

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
