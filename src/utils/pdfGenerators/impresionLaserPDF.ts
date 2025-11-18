import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDateForFilename, addHeader, addFooter } from '../pdfHelpers';
import type { ProductoLaserParaPrecios } from '../../hooks/useAllProductosLaserPrecios';

interface CombinacionPrecio {
  medida: string;
  tinta: string;
  cantidad: number;
  cara: string;
  precio: number;
}

const getCantidades = (producto: ProductoLaserParaPrecios): number[] => {
  if (producto.tipo_venta === 'cantidades_fijas') {
    return producto.cantidades_fijas || [];
  }
  return [1];
};

export const generateImpresionLaserPDF = (productos: ProductoLaserParaPrecios[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 60;

  addHeader(doc, 'Lista de Precios', 'Impresión Láser');

  if (productos.length === 0) {
    doc.setFontSize(12);
    doc.text('No hay productos disponibles para exportar.', 20, currentY);
    addFooter(doc);
    doc.save(`Lista_Precios_Impresion_Laser_${formatDateForFilename()}.pdf`);
    return;
  }

  productos.forEach((producto, productoIndex) => {
    if (productoIndex > 0) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(15, currentY, pageWidth - 30, 15, 2, 2, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(producto.nombre, 20, currentY + 10);

    currentY += 22;

    if (producto.materiales.length > 0) {
      const material = producto.materiales[0];
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      const materialText = `Material: ${material.material_nombre} - ${material.variante_nombre}${
        material.espesor ? ` (${material.espesor} ${material.unidad_espesor})` : ''
      }`;
      doc.text(materialText, 20, currentY);
      currentY += 8;
    }

    const combinaciones: CombinacionPrecio[] = [];

    producto.medidas_disponibles.forEach((medida) => {
      producto.tecnologias.forEach((tecnologia) => {
        tecnologia.tintas.forEach((tinta) => {
          const cantidades = getCantidades(producto);

          cantidades.forEach((cantidad) => {
            producto.caras_impresas.forEach((cara) => {
              const precioExistente = producto.precios_existentes.find(
                (p) =>
                  p.medida_ancho === medida.ancho &&
                  p.medida_alto === medida.alto &&
                  p.tinta_id === tinta.id &&
                  p.cantidad === cantidad &&
                  p.cara_impresa === cara
              );

              if (precioExistente) {
                combinaciones.push({
                  medida: `${medida.ancho} × ${medida.alto} cm`,
                  tinta: tinta.nombre,
                  cantidad: cantidad,
                  cara: cara === 'simple' ? 'Simple' : 'Doble',
                  precio: precioExistente.precio,
                });
              }
            });
          });
        });
      });
    });

    if (combinaciones.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Sin precios configurados', 20, currentY);
      currentY += 20;
      return;
    }

    const tableData = combinaciones.map((combo) => [
      combo.medida,
      combo.tinta,
      combo.cantidad.toString(),
      combo.cara,
      formatCurrency(combo.precio),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Medida', 'Tinta', 'Cantidad', 'Cara', 'Precio']],
      body: tableData,
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
        0: { cellWidth: 40, halign: 'center' },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
      didDrawPage: () => {
        addFooter(doc);
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
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

  doc.save(`Lista_Precios_Impresion_Laser_${formatDateForFilename()}.pdf`);
};
