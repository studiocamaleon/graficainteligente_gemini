import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProductoSelloConPrecio } from './useProductosSellosPrecios';
import { formatCurrency } from '../utils/pdfHelpers';

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

export function useSellosExport() {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async (productos: ProductoSelloConPrecio[]) => {
        if (!productos || productos.length === 0) return;

        try {
            setIsExporting(true);
            const doc = new jsPDF();

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Sellos y Accesorios', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            // Define Columns
            const head = [['Producto', 'Tipo', 'Marca', 'Medida', 'Precio Unitario']];

            // Define Rows
            const body = productos.map(p => [
                p.nombre,
                getTipoProductoLabel(p.tipo_producto),
                p.marca || '-',
                formatMedida(p.medida_ancho, p.medida_alto),
                p.precio_unitario > 0 ? formatCurrency(p.precio_unitario) : '-'
            ]);

            autoTable(doc, {
                startY: 35,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: {
                    fillColor: [63, 81, 181],
                    fontSize: 9,
                    halign: 'left'
                },
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                    valign: 'middle'
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 'auto' }, // Name
                    1: { cellWidth: 30 }, // Type
                    2: { cellWidth: 30 }, // Brand
                    3: { halign: 'center', cellWidth: 30 }, // Size
                    4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' } // Price
                },
                margin: { left: 14, right: 14 }
            });

            // Footer Note
            const finalY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('* Precios unitarios. No incluye IVA.', 14, finalY);

            doc.save(`Lista_Precios_Sellos_${new Date().toISOString().split('T')[0]}.pdf`);

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
