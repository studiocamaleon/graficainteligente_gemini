import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDateForFilename, addHeader, addFooter, sortTintas, getInkColorCircles } from '../pdfHelpers';
import type { ProductoLaserParaPrecios } from '../../hooks/useAllProductosLaserPrecios';

interface TintaData {
  id: string;
  nombre: string;
}

interface MedidaGroup {
  medida: { ancho: number; alto: number };
  tintas: TintaData[];
}

const getCantidades = (producto: ProductoLaserParaPrecios): number[] => {
  if (producto.tipo_venta === 'cantidades_fijas') {
    return producto.cantidades_fijas || [];
  }
  return [1];
};

const formatCaraLabel = (cara: string): string => {
  if (cara === 'solo_frente') return 'Solo Frente';
  if (cara === 'frente_y_dorso') return 'Frente y Dorso';
  return cara;
};

const groupByMedida = (producto: ProductoLaserParaPrecios): MedidaGroup[] => {
  const groups = new Map<string, MedidaGroup>();

  producto.medidas_disponibles.forEach((medida) => {
    const key = `${medida.ancho}x${medida.alto}`;

    if (!groups.has(key)) {
      const todasLasTintas: TintaData[] = [];
      producto.tecnologias.forEach((tecnologia) => {
        tecnologia.tintas.forEach((tinta) => {
          todasLasTintas.push(tinta);
        });
      });

      const tintasOrdenadas = sortTintas(todasLasTintas.map(t => t.nombre));
      const tintasOrdenadaData = tintasOrdenadas.map(nombre =>
        todasLasTintas.find(t => t.nombre === nombre)!
      );

      groups.set(key, {
        medida,
        tintas: tintasOrdenadaData,
      });
    }
  });

  return Array.from(groups.values());
};

const drawInkCircles = (doc: jsPDF, x: number, y: number, tinta: string) => {
  const circles = getInkColorCircles(tinta);
  const circleRadius = 2;
  const spacing = 5;
  let currentX = x;

  circles.forEach((circle) => {
    const rgb = hexToRgb(circle.color);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);

    if (circle.isVarnish) {
      doc.circle(currentX, y, circleRadius, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('V', currentX, y + 0.8, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    } else {
      doc.circle(currentX, y, circleRadius, 'F');

      if (circle.color === '#ffffff') {
        doc.setDrawColor(200, 200, 200);
        doc.circle(currentX, y, circleRadius, 'D');
        doc.setDrawColor(0, 0, 0);
      }
    }

    currentX += spacing;
  });

  return currentX;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};


export const generateImpresionLaserPDF = (productos: ProductoLaserParaPrecios[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 25;
  let currentY = 55;
  let isFirstProduct = true;

  addHeader(doc, 'Lista de Precios', 'Impresión Láser');

  if (productos.length === 0) {
    doc.setFontSize(12);
    doc.text('No hay productos disponibles para exportar.', 20, currentY);
    addFooter(doc);
    doc.save(`Lista_Precios_Impresion_Laser_${formatDateForFilename()}.pdf`);
    return;
  }

  productos.forEach((producto) => {
    const medidaGroups = groupByMedida(producto);
    const cantidades = getCantidades(producto);

    if (!isFirstProduct) {
      currentY += 8;
    }

    if (currentY > pageHeight - bottomMargin - 20) {
      doc.addPage();
      currentY = 10;
    }

    isFirstProduct = false;

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(10, currentY, pageWidth - 20, 15, 2, 2, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(producto.nombre, 15, currentY + 10);

    currentY += 15;

    if (currentY > pageHeight - bottomMargin - 15) {
      doc.addPage();
      currentY = 10;
    }

    if (producto.materiales.length > 0) {
      const material = producto.materiales[0];
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      const materialText = `Material: ${material.material_nombre} - ${material.variante_nombre}${
        material.espesor ? ` (${material.espesor} ${material.unidad_espesor})` : ''
      }`;
      doc.text(materialText, 15, currentY);
      currentY += 6;
    }

    if (medidaGroups.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Sin configuraciones disponibles', 15, currentY);
      currentY += 20;
      return;
    }

    medidaGroups.forEach((group) => {
      if (currentY > pageHeight - bottomMargin - 15) {
        doc.addPage();
        currentY = 10;
      }

      doc.setFillColor(243, 244, 246);
      doc.roundedRect(10, currentY, pageWidth - 20, 7, 1, 1, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text(`Medida: ${group.medida.ancho} × ${group.medida.alto} mm`, 15, currentY + 5);

      currentY += 8;

      const useSideBySide = group.tintas.length === 2;

      if (useSideBySide) {
        const tableWidth = (pageWidth - 30) / 2;
        const spacing = 5;

        group.tintas.forEach((tinta, tintaIndex) => {
          const startX = 10 + (tintaIndex * (tableWidth + spacing));
          let localY = currentY;

          doc.setFillColor(239, 246, 255);
          doc.roundedRect(startX, localY, tableWidth, 6, 1, 1, 'F');
          doc.setDrawColor(191, 219, 254);
          doc.roundedRect(startX, localY, tableWidth, 6, 1, 1, 'D');

          drawInkCircles(doc, startX + 3, localY + 3, tinta.nombre);

          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(31, 41, 55);
          doc.text(tinta.nombre, startX + 25, localY + 4.5);

          localY += 6;

          const headers = ['Cantidad', ...producto.caras_impresas.map(formatCaraLabel)];
          const tableData = cantidades.map((cantidad) => {
            const row: any[] = [cantidad.toString()];

            producto.caras_impresas.forEach((cara) => {
              const precio = producto.precios_existentes.find(
                (p) =>
                  p.medida_ancho === group.medida.ancho &&
                  p.medida_alto === group.medida.alto &&
                  p.tinta_id === tinta.id &&
                  p.cantidad === cantidad &&
                  p.cara_impresa === cara
              );
              row.push(precio ? formatCurrency(precio.precio) : '-');
            });

            return row;
          });

          autoTable(doc, {
            startY: localY,
            head: [headers],
            body: tableData,
            theme: 'grid',
            margin: { left: startX, right: pageWidth - startX - tableWidth, top: 10, bottom: bottomMargin },
            tableWidth: tableWidth,
            showHead: 'everyPage',
            headStyles: {
              fillColor: [37, 99, 235],
              textColor: [255, 255, 255],
              fontSize: 7.5,
              fontStyle: 'bold',
              halign: 'center',
              cellPadding: 2,
            },
            bodyStyles: {
              fontSize: 7.5,
              cellPadding: 2,
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252],
            },
            columnStyles: {
              0: { halign: 'center' },
              1: { halign: 'right' },
              2: { halign: 'right' },
            },
            didDrawPage: () => {
              addFooter(doc);
            },
          });
        });

        const lastTable = (doc as any).lastAutoTable;
        currentY = lastTable.finalY + 3;
      } else {
        group.tintas.forEach((tinta) => {
          if (currentY > pageHeight - bottomMargin - 15) {
            doc.addPage();
            currentY = 10;
          }

          doc.setFillColor(239, 246, 255);
          doc.roundedRect(10, currentY, pageWidth - 20, 6, 1, 1, 'F');
          doc.setDrawColor(191, 219, 254);
          doc.roundedRect(10, currentY, pageWidth - 20, 6, 1, 1, 'D');

          drawInkCircles(doc, 13, currentY + 3, tinta.nombre);

          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(31, 41, 55);
          doc.text(tinta.nombre, 35, currentY + 4.5);

          currentY += 8;

          const headers = ['Cantidad', ...producto.caras_impresas.map(formatCaraLabel)];
          const tableData = cantidades.map((cantidad) => {
            const row: any[] = [cantidad.toString()];

            producto.caras_impresas.forEach((cara) => {
              const precio = producto.precios_existentes.find(
                (p) =>
                  p.medida_ancho === group.medida.ancho &&
                  p.medida_alto === group.medida.alto &&
                  p.tinta_id === tinta.id &&
                  p.cantidad === cantidad &&
                  p.cara_impresa === cara
              );
              row.push(precio ? formatCurrency(precio.precio) : '-');
            });

            return row;
          });

          autoTable(doc, {
            startY: currentY,
            head: [headers],
            body: tableData,
            theme: 'grid',
            headStyles: {
              fillColor: [37, 99, 235],
              textColor: [255, 255, 255],
              fontSize: 8.5,
              fontStyle: 'bold',
              halign: 'center',
              cellPadding: 2.5,
            },
            bodyStyles: {
              fontSize: 8.5,
              cellPadding: 2.5,
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252],
            },
            columnStyles: {
              0: { halign: 'center', cellWidth: 40 },
              1: { halign: 'right' },
              2: { halign: 'right' },
            },
            margin: { left: 10, right: 10, top: 10, bottom: bottomMargin },
            showHead: 'everyPage',
            didDrawPage: () => {
              addFooter(doc);
            },
          });

          currentY = (doc as any).lastAutoTable.finalY + 3;
        });
      }
    });
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  doc.save(`Lista_Precios_Impresion_Laser_${formatDateForFilename()}.pdf`);
};
