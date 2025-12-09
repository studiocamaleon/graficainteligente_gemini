import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProductoLaserParaPrecios } from './useAllProductosLaserPrecios';
import { formatCurrency, sortTintas } from '../utils/pdfHelpers';
import { formatRangoValue } from '../utils/rangoUtils';

interface MedidaGroup {
    medida: { ancho: number; alto: number };
    tintas: string[];
}

const formatCaraLabel = (cara: string): string => {
    if (cara === 'solo_frente') return 'Solo Frente';
    if (cara === 'frente_y_dorso') return 'Frente y Dorso';
    return cara;
};

export function useLaserExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (productos: ProductoLaserParaPrecios[]) => {
        try {
            setIsExporting(true);
            const doc = new jsPDF();

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Impresión Láser', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35;

            // Iterate Products
            for (const producto of productos) {
                // Product Header (Check page break)
                if (finalY > 250) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.setFont('helvetica', 'bold');
                doc.text(producto.nombre, 14, finalY);
                finalY += 6;

                // Materials Subtitle
                if (producto.materiales.length > 0) {
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.setFont('helvetica', 'normal');
                    const mats = producto.materiales.map(m =>
                        `${m.material_nombre} ${m.variante_nombre} ${m.espesor ? `(${m.espesor} ${m.unidad_espesor})` : ''}`
                    ).join(', ');
                    doc.text(mats, 14, finalY);
                    finalY += 8;
                } else {
                    finalY += 4;
                }

                // Group by Medida Logic
                const groups = new Map<string, MedidaGroup>();
                producto.medidas_disponibles.forEach((medida) => {
                    const key = `${medida.ancho}x${medida.alto}`;
                    if (!groups.has(key)) {
                        const todasLasTintas: string[] = [];
                        producto.tecnologias.forEach((tecnologia) => {
                            tecnologia.tintas.forEach((tinta) => todasLasTintas.push(tinta));
                        });
                        groups.set(key, { medida, tintas: sortTintas(todasLasTintas) });
                    }
                });
                const medidaGroups = Array.from(groups.values());

                if (medidaGroups.length === 0) {
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.text('Sin configuraciones disponibles', 14, finalY);
                    finalY += 10;
                    continue;
                }

                const isRange = producto.tipo_venta === 'rango' || producto.tipo_venta === 'unidades';

                // Iterate Medida Groups
                for (const group of medidaGroups) {
                    // Size Header
                    if (finalY > 240) {
                        doc.addPage();
                        finalY = 20;
                    }

                    doc.setFontSize(11);
                    doc.setTextColor(50);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${group.medida.ancho} x ${group.medida.alto} cm`, 14, finalY);
                    finalY += 6;

                    // Iterate Inks (Side by Side Grid logic in HTML, but sequential tables in PDF is safer/cleaner)
                    // We will stack them sequentially.
                    for (const tinta of group.tintas) {
                        if (finalY > 230) {
                            doc.addPage();
                            finalY = 20;
                        }

                        // Ink Header
                        doc.setFontSize(10);
                        doc.setTextColor(70);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`Tinta: ${tinta}`, 14, finalY);
                        finalY += 4;

                        // Define Table Columns
                        const head = [[
                            isRange ? (producto.rango_precio?.unidad_medida || 'Cantidad') : 'Cantidad'
                        ]];

                        producto.caras_impresas.forEach(cara => {
                            head[0].push(formatCaraLabel(cara));
                        });

                        // Define Table Rows
                        let body: (string | number)[][] = [];

                        if (isRange && producto.rango_precio?.rangos) {
                            body = producto.rango_precio.rangos.map(r => {
                                const row = [formatRangoValue(r.min, r.max || 0, '')];

                                producto.caras_impresas.forEach(cara => {
                                    // Find price logic
                                    const p = producto.precios_existentes.find((cx: any) =>
                                        cx.medida_ancho === group.medida.ancho &&
                                        cx.medida_alto === group.medida.alto &&
                                        cx.tinta === tinta &&
                                        cx.cara_impresa === cara &&
                                        cx.rango_precio_min === r.min
                                    );
                                    row.push(p?.precio && p.precio > 0 ? formatCurrency(p.precio) : '-');
                                });
                                return row;
                            });
                        } else if (producto.cantidades_fijas) {
                            body = producto.cantidades_fijas.map(qty => {
                                const row = [qty.toString()];

                                producto.caras_impresas.forEach(cara => {
                                    const p = producto.precios_existentes.find((cx: any) =>
                                        cx.medida_ancho === group.medida.ancho &&
                                        cx.medida_alto === group.medida.alto &&
                                        cx.tinta === tinta &&
                                        cx.cara_impresa === cara &&
                                        cx.cantidad === qty
                                    );
                                    row.push(p?.precio && p.precio > 0 ? formatCurrency(p.precio) : '-');
                                });
                                return row;
                            });
                        }

                        autoTable(doc, {
                            startY: finalY,
                            head: head,
                            body: body,
                            theme: 'grid',
                            headStyles: {
                                fillColor: [30, 41, 59], // Slate 800
                                fontSize: 9,
                                halign: 'center'
                            },
                            styles: { fontSize: 9, cellPadding: 3, valign: 'middle', halign: 'right' },
                            columnStyles: {
                                0: { halign: 'center', fontStyle: 'bold', cellWidth: 30 } // Quantity Col
                            },
                            margin: { left: 14, right: 14 }
                        });

                        finalY = (doc as any).lastAutoTable.finalY + 8;
                    }
                    finalY += 4;
                }
                finalY += 8; // Extra space between products
            }

            doc.save(`Lista_Precios_Laser_${new Date().toISOString().split('T')[0]}.pdf`);

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
