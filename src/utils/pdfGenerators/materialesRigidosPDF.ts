import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDateForFilename, addHeader, addFooter, estimateTableHeight, hasEnoughSpaceForTable } from '../pdfHelpers';
import type {
  ProductoMaterialRigidoParaPrecios,
  ProductosAgrupadosPorMaterial,
} from '../../hooks/useAllProductosMaterialesRigidosPrecios';

interface TableRow {
  producto: string;
  variante: string;
  espesor: string;
  medida: string;
  precioPlaca: string;
  precioM2: string;
}

const calcularM2Placa = (ancho: number, alto: number): number => {
  return (ancho * alto) / 10000;
};

const calcularPrecioM2 = (
  precioPlaca: number,
  ancho: number,
  alto: number
): number => {
  const m2 = calcularM2Placa(ancho, alto);
  return m2 > 0 ? precioPlaca / m2 : 0;
};

export const generateMaterialesRigidosPDF = (
  productosAgrupados: ProductosAgrupadosPorMaterial
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 30;
  let currentY = 55;

  addHeader(doc, 'Lista de Precios', 'Materiales Rígidos');

  const materialesIds = Object.keys(productosAgrupados);

  if (materialesIds.length === 0) {
    doc.setFontSize(12);
    doc.text('No hay productos disponibles para exportar.', 20, currentY);
    addFooter(doc);
    doc.save(`Lista_Precios_Materiales_Rigidos_${formatDateForFilename()}.pdf`);
    return;
  }

  materialesIds.forEach((materialId, materialIndex) => {
    const grupo = productosAgrupados[materialId];

    const estimatedTableHeight = estimateTableHeight(grupo.productos.length, 5, 9);
    if (!hasEnoughSpaceForTable(currentY, pageHeight, bottomMargin, estimatedTableHeight + 30, 2)) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(239, 246, 255);
    doc.roundedRect(10, currentY, pageWidth - 20, 12, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(grupo.material_nombre, 15, currentY + 8);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${grupo.productos.length} ${grupo.productos.length === 1 ? 'combinación' : 'combinaciones'}`,
      pageWidth - 20,
      currentY + 8,
      { align: 'right' }
    );

    currentY += 18;

    const tableData: TableRow[] = grupo.productos.map((producto) => {
      const precioPlaca = producto.precio_actual?.precio_placa || 0;
      const precioM2 =
        precioPlaca > 0
          ? calcularPrecioM2(
              precioPlaca,
              producto.medida_placa_ancho,
              producto.medida_placa_alto
            )
          : 0;
      const m2Placa = calcularM2Placa(
        producto.medida_placa_ancho,
        producto.medida_placa_alto
      );

      return {
        producto: producto.nombre,
        variante: producto.material.variante_nombre,
        espesor:
          producto.material.espesor !== null
            ? `${producto.material.espesor} mm`
            : 'No aplica',
        medida: `${producto.medida_placa_ancho} × ${producto.medida_placa_alto} cm\n(${m2Placa.toFixed(2)} m²)`,
        precioPlaca: precioPlaca > 0 ? formatCurrency(precioPlaca) : '-',
        precioM2: precioM2 > 0 ? formatCurrency(precioM2) : '-',
      };
    });

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'Producto',
          'Variante',
          'Espesor',
          'Medida de Placa',
          'Precio por Placa',
          'Precio por m²',
        ],
      ],
      body: tableData.map((row) => [
        row.producto,
        row.variante,
        row.espesor,
        row.medida,
        row.precioPlaca,
        row.precioM2,
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 10, right: 10, top: 10, bottom: bottomMargin },
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      pageBreak: 'auto',
      didDrawPage: (data) => {
        addFooter(doc);
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  doc.save(`Lista_Precios_Materiales_Rigidos_${formatDateForFilename()}.pdf`);
};
