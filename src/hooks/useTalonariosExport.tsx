import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProductoTalonarioParaPrecios } from './useAllProductosTalonariosPrecios';
import { formatCurrency, sortTintas } from '../utils/pdfHelpers';

interface MedidaGroup {
    medida: { ancho: number; alto: number };
    tintas: string[];
}

const formatCaraLabel = (cara: string): string => {
    if (cara === 'solo_frente') return 'Solo Frente';
    if (cara === 'frente_y_dorso') return 'Frente y Dorso';
    // For Talonarios, it might be 'original', 'duplicado' etc which are fine as is, 
    // or they might use keys that need formatting. 
    // Based on template it uses the same formatCaraLabel helper?? 
    // Wait, the template imported formatCaraLabel?? No, it defined it locally.
    // Line 17 of TalonariosPDFTemplate: 
    // const formatCaraLabel = (cara: string): string => {
    //   if (cara === 'solo_frente') return 'Solo Frente';
    //   if (cara === 'frente_y_dorso') return 'Frente y Dorso';
    //   return cara;
    // };
    // So 'duplicado' etc returns 'duplicado'. 
    // We should capitalize generic terms if needed, but existing code returns as is.
    return cara.charAt(0).toUpperCase() + cara.slice(1);
};

const getCantidades = (producto: ProductoTalonarioParaPrecios): number[] => {
    if (producto.tipo_venta === 'cantidades_fijas') {
        return producto.cantidades_fijas || [];
    }
    return [1];
};

const getMaterialInfo = (producto: ProductoTalonarioParaPrecios): string => {
    if (producto.materiales.length === 0) return '';
    const material = producto.materiales[0];
    let info = `${material.material_nombre} - ${material.variante_nombre}`;
    if (material.espesor) {
        info += ` (${material.espesor} ${material.unidad_espesor})`;
    }
    return info;
};

export function useTalonariosExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (productos: ProductoTalonarioParaPrecios[]) => {
        try {
            setIsExporting(true);
            const doc = new jsPDF();

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Talonarios', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35;

            // Iterate Products
            for (const producto of productos) {
                // Product Header
                if (finalY > 250) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.setFont('helvetica', 'bold');
                doc.text(producto.nombre, 14, finalY);
                finalY += 6;

                const materialInfo = getMaterialInfo(producto);
                if (materialInfo) {
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.setFont('helvetica', 'normal');
                    doc.text(materialInfo, 14, finalY);
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

                const cantidades = getCantidades(producto);

                // Iterate Medida Groups
                for (const group of medidaGroups) {
                    // Size Header
                    if (finalY > 230) {
                        doc.addPage();
                        finalY = 20;
                    }

                    doc.setFontSize(11);
                    doc.setTextColor(50);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Medida: ${group.medida.ancho} x ${group.medida.alto} cm`, 14, finalY);
                    finalY += 6;

                    // Iterate Inks (Sequential)
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
                        const head = [['Cantidad']];
                        producto.tipo_copia.forEach(cara => {
                            head[0].push(formatCaraLabel(cara));
                        });

                        // Define Table Rows
                        const body = cantidades.map(cantidad => {
                            const row = [cantidad.toString()];

                            producto.tipo_copia.forEach(cara => {
                                const precio = producto.precios_existentes.find(
                                    p => p.medida_ancho === group.medida.ancho &&
                                        p.medida_alto === group.medida.alto &&
                                        p.tinta === tinta &&
                                        p.cantidad === cantidad &&
                                        p.tipo_copia === cara
                                );
                                row.push(precio?.precio && precio.precio > 0 ? formatCurrency(precio.precio) : '-');
                            });
                            return row;
                        });

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
                finalY += 8;
            }

            doc.save(`Lista_Precios_Talonarios_${new Date().toISOString().split('T')[0]}.pdf`);

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
