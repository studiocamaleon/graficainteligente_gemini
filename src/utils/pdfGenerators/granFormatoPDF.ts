import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDateForFilename, addHeader, addFooter } from '../pdfHelpers';
import { isInfiniteRango, normalizeRangoMax } from '../rangoUtils';
import type { TecnologiaAgrupada } from '../../hooks/useAllProductosGranFormatoPrecios';

interface PreciosPorProducto {
  producto_gran_formato_id: string;
  tinta: string;
  rango_precio_min: number;
  rango_precio_max: number;
  precio: number;
}

const getInkBadgeText = (tinta: string): string => {
  const tintaUpper = tinta.toUpperCase();
  const labels: { [key: string]: string } = {
    CMYK: 'CMYK',
    RGB: 'RGB',
    BLANCO: 'Blanco',
    BARNIZ: 'Barniz',
  };
  return labels[tintaUpper] || tinta;
};

export const generateGranFormatoPDF = async (
  tecnologiasAgrupadas: TecnologiaAgrupada[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 25;
  let currentY = 55;

  addHeader(doc, 'Lista de Precios', 'Gran Formato');

  if (tecnologiasAgrupadas.length === 0) {
    doc.setFontSize(12);
    doc.text('No hay productos disponibles para exportar.', 20, currentY);
    addFooter(doc);
    doc.save(`Lista_Precios_Gran_Formato_${formatDateForFilename()}.pdf`);
    return;
  }

  for (const tecnologia of tecnologiasAgrupadas) {
    if (currentY > pageHeight - bottomMargin - 15) {
      doc.addPage();
      currentY = 10;
    }

    doc.setFillColor(147, 51, 234);
    doc.roundedRect(10, currentY, pageWidth - 20, 12, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(tecnologia.nombre, 15, currentY + 8);

    currentY += 18;

    for (const tintaData of tecnologia.tintas) {
      if (currentY > pageHeight - bottomMargin - 20) {
        doc.addPage();
        currentY = 10;
      }

      doc.setFillColor(243, 244, 246);
      doc.roundedRect(15, currentY, pageWidth - 30, 8, 1, 1, 'F');

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);
      doc.text(`Tinta: ${getInkBadgeText(tintaData.tinta)}`, 20, currentY + 5.5);

      currentY += 12;

      for (const [rangoId, productos] of tintaData.productosPorRango.entries()) {
        if (productos.length === 0) continue;

        const primerProducto = productos[0];

        const tableHeaders: string[] = ['Producto', 'Tipo de Venta'];

        if (primerProducto.tipo_venta === 'mt_lineal') {
          tableHeaders.push('Ancho');
        }

        primerProducto.rangos.forEach((rango) => {
          const normalizedMax = normalizeRangoMax(rango.max);
          const rangoText = isInfiniteRango(normalizedMax)
            ? `≥ ${rango.min} ${primerProducto.unidad_medida}`
            : `${rango.min}-${rango.max} ${primerProducto.unidad_medida}`;
          tableHeaders.push(rangoText);
        });

        const tableData = productos.map((producto) => {
          const row: string[] = [
            producto.nombre,
            producto.tipo_venta === 'mt2' ? 'm²' : 'mt lineal',
          ];

          if (primerProducto.tipo_venta === 'mt_lineal') {
            row.push(producto.ancho_fijo ? `${producto.ancho_fijo} cm` : '-');
          }

          primerProducto.rangos.forEach(() => {
            row.push('-');
          });

          return row;
        });

        const columnCount = tableHeaders.length;
        const baseWidth = 35;
        const typeWidth = 28;
        const anchoWidth = 20;
        const rangoWidth = (pageWidth - 40 - baseWidth - typeWidth - (primerProducto.tipo_venta === 'mt_lineal' ? anchoWidth : 0)) / primerProducto.rangos.length;

        const columnStyles: any = {
          0: { cellWidth: baseWidth },
          1: { cellWidth: typeWidth, halign: 'center' },
        };

        if (primerProducto.tipo_venta === 'mt_lineal') {
          columnStyles[2] = { cellWidth: anchoWidth, halign: 'center' };
          for (let i = 3; i < columnCount; i++) {
            columnStyles[i] = { cellWidth: rangoWidth, halign: 'right' };
          }
        } else {
          for (let i = 2; i < columnCount; i++) {
            columnStyles[i] = { cellWidth: rangoWidth, halign: 'right' };
          }
        }

        autoTable(doc, {
          startY: currentY,
          head: [tableHeaders],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [37, 99, 235],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 3,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: columnStyles,
          margin: { left: 10, right: 10, top: 10, bottom: bottomMargin },
          showHead: 'everyPage',
          rowPageBreak: 'avoid',
          pageBreak: 'auto',
          didDrawPage: (data) => {
            addFooter(doc);
            if (data.pageNumber > 1 && data.cursor) {
              currentY = data.cursor.y;
            }
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
      }

      currentY += 3;
    }

    currentY += 5;
  }

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

  doc.save(`Lista_Precios_Gran_Formato_${formatDateForFilename()}.pdf`);
};
