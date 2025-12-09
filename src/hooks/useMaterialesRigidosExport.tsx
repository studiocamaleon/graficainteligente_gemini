import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../utils/pdfHelpers';
import type { ProductoMaterialRigidoParaPrecios } from './useAllProductosMaterialesRigidosPrecios';

interface ProductosAgrupados {
    [materialId: string]: {
        material_nombre: string;
        productos: ProductoMaterialRigidoParaPrecios[];
    };
}

const calcularM2Placa = (ancho: number, alto: number): number => {
    return (ancho * alto) / 10000;
};

const calcularPrecioM2 = (precioPlaca: number, ancho: number, alto: number): number => {
    const m2 = calcularM2Placa(ancho, alto);
    return m2 > 0 ? precioPlaca / m2 : 0;
};

export function useMaterialesRigidosExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (productosAgrupados: ProductosAgrupados) => {
        try {
            setIsExporting(true);
            const doc = new jsPDF();
            const materialesIds = Object.keys(productosAgrupados);

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Materiales Rígidos', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35;

            // Iterate Materials
            for (const materialId of materialesIds) {
                const grupo = productosAgrupados[materialId];

                // Check page break
                if (finalY > 250) {
                    doc.addPage();
                    finalY = 20;
                }

                // Material Header
                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.setFont('helvetica', 'bold');
                doc.text(grupo.material_nombre, 14, finalY);

                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.setFont('helvetica', 'normal');
                const variantsCount = grupo.productos.length;
                doc.text(`${variantsCount} ${variantsCount === 1 ? 'Variante' : 'Variantes'}`, 14, finalY + 5);

                finalY += 10;

                // Define Table Columns
                const head = [['Producto / Variante', 'Espesor', 'Medida Placa', 'Precio Placa', 'Precio m²']];

                // Define Table Rows
                const body = grupo.productos.map(producto => {
                    const precioPlaca = producto.precio_actual?.precio_placa || 0;
                    const precioM2 = calcularPrecioM2(precioPlaca, producto.medida_placa_ancho, producto.medida_placa_alto);
                    const m2Placa = calcularM2Placa(producto.medida_placa_ancho, producto.medida_placa_alto);

                    return [
                        `${producto.nombre}\n${producto.material.variante_nombre}`,
                        producto.material.espesor !== null ? `${producto.material.espesor} mm` : '-',
                        `${producto.medida_placa_ancho} x ${producto.medida_placa_alto} cm\n(${m2Placa.toFixed(2)} m²)`,
                        precioPlaca > 0 ? formatCurrency(precioPlaca) : '-',
                        precioM2 > 0 ? formatCurrency(precioM2) : '-'
                    ];
                });

                autoTable(doc, {
                    startY: finalY,
                    head: head,
                    body: body,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [63, 81, 181], // Indigo 500
                        fontSize: 9,
                        halign: 'left'
                    },
                    styles: {
                        fontSize: 9,
                        cellPadding: 3,
                        valign: 'middle'
                    },
                    columnStyles: {
                        0: { cellWidth: 'auto', fontStyle: 'bold' }, // Name
                        1: { cellWidth: 20, halign: 'center' }, // Thickness
                        2: { cellWidth: 35, halign: 'center' }, // Size
                        3: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Price Placa
                        4: { cellWidth: 25, halign: 'right', textColor: 100 }  // Price m2
                    },
                    margin: { left: 14, right: 14 }
                });

                finalY = (doc as any).lastAutoTable.finalY + 10;
            }

            doc.save(`Lista_Precios_Materiales_Rigidos_${new Date().toISOString().split('T')[0]}.pdf`);

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
