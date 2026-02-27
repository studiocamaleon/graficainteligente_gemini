import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
    CentroCopiadoTamanioPapel,
    CentroCopiadoPapel,
    CentroCopiadoRangoPrecioImpresion,
    TipoTintaCopiado
} from '../types/database';
import { formatCurrency } from '../utils/pdfHelpers';

interface PrecioCargado {
    tamanio_papel_id: string;
    papel_id: string;
    rango_precio_id: string;
    cara_impresa: 'frente' | 'frente_y_dorso';
    precio: number;
}

// We need an interface that includes what we need from Papel, which seems to include material?.nombre.
// The existing hook defines CombinacionTamanioPapel, but the component uses papeles separately.
// The logic in Template uses 'papeles' which are CentroCopiadoPapel[].
// Let's assume passed 'papeles' have material joined.

interface CentroCopiadoPapelWithMaterial extends CentroCopiadoPapel {
    material?: { nombre: string } | null;
}

const getPrecio = (
    preciosMap: Map<string, PrecioCargado[]>,
    tamanioId: string,
    papelId: string,
    rangoId: string,
    cara: 'frente' | 'frente_y_dorso'
) => {
    const key = `${tamanioId}|${papelId}`;
    const preciosList = preciosMap.get(key);
    if (!preciosList) return '-';

    const found = preciosList.find(p => p.rango_precio_id === rangoId && p.cara_impresa === cara);
    return found && found.precio > 0 ? formatCurrency(found.precio) : '-';
};

export function useCentroCopiadoExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (
        tamanios: CentroCopiadoTamanioPapel[],
        papeles: CentroCopiadoPapelWithMaterial[],
        rangos: CentroCopiadoRangoPrecioImpresion[],
        loadPreciosExistentes: (tipoTinta: TipoTintaCopiado) => Promise<Map<string, PrecioCargado[]>>
    ) => {
        if (!tamanios.length || !papeles.length || !rangos.length) return;

        try {
            setIsExporting(true);

            // Fetch Data
            const preciosCMYK = await loadPreciosExistentes('CMYK');
            const preciosColor = await loadPreciosExistentes('COLOR');
            const preciosBN = await loadPreciosExistentes('K');

            const doc = new jsPDF('p', 'mm', 'a4');

            // Title Page or Header
            // Actually, we can just start.

            const renderSection = (tipoTinta: TipoTintaCopiado, preciosMap: Map<string, PrecioCargado[]>, startNewPage: boolean) => {
                if (startNewPage) {
                    doc.addPage();
                }

                let finalY = (startNewPage || (doc as any).internal.getCurrentPageInfo().pageNumber === 1) ? 20 : (doc as any).lastAutoTable.finalY + 15;

                // If first page, add Title
                if ((doc as any).internal.getCurrentPageInfo().pageNumber === 1 && !startNewPage) {
                    doc.setFontSize(18);
                    doc.text('Lista de Precios - Centro de Copiado', 14, 20);
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);
                    finalY = 35;
                } else if (startNewPage) {
                    finalY = 20;
                }


                // Section Title
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');

                if (tipoTinta === 'CMYK') {
                    doc.setTextColor(0, 150, 150); // Cyanish
                } else if (tipoTinta === 'COLOR') {
                    doc.setTextColor(56, 116, 203);
                } else {
                    doc.setTextColor(50, 50, 50); // Gray
                }

                doc.text(
                    tipoTinta === 'CMYK'
                        ? 'Impresión Full Color (CMYK)'
                        : tipoTinta === 'COLOR'
                            ? 'Impresión Color'
                            : 'Impresión Blanco y Negro',
                    14,
                    finalY
                );
                finalY += 10;

                // Iterate Tamanios
                for (const tamanio of tamanios) {
                    if (finalY > 250) {
                        doc.addPage();
                        finalY = 20;
                    }

                    doc.setFontSize(12);
                    doc.setTextColor(0);
                    doc.text(`Formato: ${tamanio.nombre} (${tamanio.ancho_mm}x${tamanio.alto_mm}mm)`, 14, finalY);
                    finalY += 5;

                    // Table Header
                    // Row 1: Papel (rowspan 2), Ranges (colspan 2)
                    const headerRow1 = [
                        { content: 'Papel', rowSpan: 2, styles: { valign: 'middle', halign: 'left' } }
                    ];

                    rangos.forEach(r => {
                        headerRow1.push({
                            content: `${r.hojas_desde} - ${r.hojas_hasta || '+'}`,
                            colSpan: 2,
                            styles: { halign: 'center' }
                        });
                    });

                    // Row 2: Frente, F/D
                    const headerRow2: string[] = [];
                    rangos.forEach(() => {
                        headerRow2.push('Frente');
                        headerRow2.push('F/D');
                    });

                    // Body
                    const body = papeles.map(papel => {
                        const row: any[] = [
                            `${papel.material?.nombre || 'N/A'}\n${papel.variante_nombre} ${papel.espesor ? `(${papel.espesor}g)` : ''}`
                        ];

                        rangos.forEach(rango => {
                            row.push(getPrecio(preciosMap, tamanio.id, papel.id, rango.id, 'frente'));
                            row.push(getPrecio(preciosMap, tamanio.id, papel.id, rango.id, 'frente_y_dorso'));
                        });

                        return row;
                    });

                    autoTable(doc, {
                        startY: finalY + 2,
                        head: [headerRow1, headerRow2],
                        body: body,
                        theme: 'grid',
                        headStyles: {
                            fillColor: [240, 240, 240],
                            textColor: [50, 50, 50],
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
                        didParseCell: (data) => {
                            if (data.section === 'body' && data.column.index > 0) {
                                data.cell.styles.halign = 'right';
                            }
                        },
                        margin: { left: 14, right: 14 }
                    });

                    finalY = (doc as any).lastAutoTable.finalY + 10;
                }
            };

            renderSection('CMYK', preciosCMYK, false);
            renderSection('COLOR', preciosColor, true);
            renderSection('K', preciosBN, true);

            doc.save(`Lista_Precios_Centro_Copiado_${new Date().toISOString().split('T')[0]}.pdf`);

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
