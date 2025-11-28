import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDateForFilename, addHeader, addFooter, estimateTableHeight, hasEnoughSpaceForTable } from '../pdfHelpers';

interface MaterialUVPDF {
  material_nombre: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
  dim_ancho_cm: number;
  dim_alto_cm: number;
  precio_por_m2: number;
}

interface PrecioImpresionUVPDF {
  tinta: string;
  rango_minimo: number;
  rango_maximo: number | null;
  precio_por_m2: number;
}

interface ProductoUVPDF {
  nombre: string;
  limite_ancho_cm: number | null;
  limite_alto_cm: number | null;
  material_cliente_permitido: boolean;
  materiales: MaterialUVPDF[];
  precios_impresion: PrecioImpresionUVPDF[];
}

const getNombreTinta = (tinta: string): string => {
  const nombresMap: Record<string, string> = {
    'K': 'Negro (K)',
    'CMYK': 'Color (CMYK)',
    'CMYK+W': 'Color + Blanco',
    'CMYK+V': 'Color + Barniz',
    'CMYK+W+V': 'Color + Blanco + Barniz'
  };
  return nombresMap[tinta] || tinta;
};

const formatRango = (minimo: number, maximo: number | null): string => {
  if (maximo === null) {
    return `${minimo.toFixed(2)} m² en adelante`;
  }
  return `${minimo.toFixed(2)} - ${maximo.toFixed(2)} m²`;
};

export const generateImpresionUVRigidosPDF = (productos: ProductoUVPDF[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 30;
  let currentY = 55;

  addHeader(doc, 'Lista de Precios', 'Impresión UV sobre Rígidos');

  if (productos.length === 0) {
    doc.setFontSize(12);
    doc.text('No hay productos disponibles para exportar.', 20, currentY);
    addFooter(doc);
    doc.save(`Lista_Precios_Impresion_UV_Rigidos_${formatDateForFilename()}.pdf`);
    return;
  }

  productos.forEach((producto, productoIndex) => {
    // Verificar espacio para el encabezado del producto
    if (!hasEnoughSpaceForTable(currentY, pageHeight, bottomMargin, 40, 2)) {
      doc.addPage();
      currentY = 20;
    }

    // Encabezado del producto con badge
    doc.setFillColor(252, 231, 243); // pink-100
    doc.roundedRect(10, currentY, pageWidth - 20, 12, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(236, 72, 153); // pink-600
    doc.text(producto.nombre, 15, currentY + 8);

    // Badge de modalidad
    const badgeText = producto.material_cliente_permitido ? 'Con/Sin Material' : 'Solo Con Material';
    doc.setFillColor(236, 72, 153); // pink-600
    doc.roundedRect(pageWidth - 55, currentY + 2, 45, 8, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, pageWidth - 52.5, currentY + 7);

    currentY += 16;

    // Información general
    doc.setFillColor(254, 242, 242); // pink-50
    doc.setDrawColor(251, 207, 232); // pink-200
    doc.roundedRect(10, currentY, pageWidth - 20, 16, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99); // gray-700
    doc.text('Límites de Tamaño:', 15, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39); // gray-900
    const limites = producto.limite_ancho_cm && producto.limite_alto_cm
      ? `Máximo: ${producto.limite_ancho_cm} × ${producto.limite_alto_cm} cm`
      : 'Sin límites definidos';
    doc.text(limites, 15, currentY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('Modalidad de Trabajo:', 110, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    const modalidad = producto.material_cliente_permitido
      ? 'Acepta material del cliente o del catálogo'
      : 'Solo material del catálogo';
    doc.text(modalidad, 110, currentY + 11);

    currentY += 20;

    // Tabla de materiales disponibles
    if (producto.materiales.length > 0) {
      const estimatedMaterialesHeight = estimateTableHeight(producto.materiales.length, 5, 9);
      if (!hasEnoughSpaceForTable(currentY, pageHeight, bottomMargin, estimatedMaterialesHeight + 15, 2)) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Materiales Disponibles', 15, currentY + 5);

      currentY += 10;

      const materialesData = producto.materiales.map((mat) => {
        const m2 = (mat.dim_ancho_cm * mat.dim_alto_cm) / 10000;
        return [
          mat.material_nombre,
          mat.variante_nombre,
          mat.espesor && mat.unidad_espesor ? `${mat.espesor} ${mat.unidad_espesor}` : '-',
          `${mat.dim_ancho_cm} × ${mat.dim_alto_cm} cm\n(${m2.toFixed(2)} m²)`,
          formatCurrency(mat.precio_por_m2),
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Material', 'Variante', 'Espesor', 'Dimensiones', 'Precio/m²']],
        body: materialesData,
        theme: 'grid',
        headStyles: {
          fillColor: [236, 72, 153], // pink-600
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
        },
        alternateRowStyles: {
          fillColor: [252, 231, 243], // pink-100
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 45, halign: 'center' },
          4: { cellWidth: 35, halign: 'right' },
        },
        margin: { left: 10, right: 10, top: 10, bottom: bottomMargin },
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        pageBreak: 'auto',
        didDrawPage: () => {
          addFooter(doc);
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Tabla de precios de impresión UV
    if (producto.precios_impresion.length > 0) {
      const estimatedImpresionHeight = estimateTableHeight(producto.precios_impresion.length, 5, 9);
      if (!hasEnoughSpaceForTable(currentY, pageHeight, bottomMargin, estimatedImpresionHeight + 15, 2)) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Precios de Impresión UV', 15, currentY + 5);

      currentY += 10;

      const preciosData = producto.precios_impresion.map((precio) => [
        getNombreTinta(precio.tinta),
        formatRango(precio.rango_minimo, precio.rango_maximo),
        formatCurrency(precio.precio_por_m2),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Tipo de Tinta', 'Rango de m²', 'Precio/m²']],
        body: preciosData,
        theme: 'grid',
        headStyles: {
          fillColor: [236, 72, 153], // pink-600
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
        },
        alternateRowStyles: {
          fillColor: [252, 231, 243], // pink-100
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 70 },
          2: { cellWidth: 55, halign: 'right' },
        },
        margin: { left: 10, right: 10, top: 10, bottom: bottomMargin },
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        pageBreak: 'auto',
        didDrawPage: () => {
          addFooter(doc);
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Nota informativa
    if (!hasEnoughSpaceForTable(currentY, pageHeight, bottomMargin, 20, 2)) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(249, 250, 251); // gray-50
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.roundedRect(10, currentY, pageWidth - 20, 18, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81); // gray-700
    doc.text('Nota:', 15, currentY + 6);

    doc.setFont('helvetica', 'normal');
    const nota1 = 'El precio final se calcula sumando el costo del material (si aplica) más el costo de la';
    const nota2 = 'impresión UV según los m² y el tipo de tinta seleccionado.';
    doc.text(nota1, 15, currentY + 11);
    doc.text(nota2, 15, currentY + 15);

    if (producto.material_cliente_permitido) {
      doc.text('Si el cliente provee el material, solo se cobra la impresión UV.', 15, currentY + 19);
      currentY += 24;
    } else {
      currentY += 22;
    }

    // Separador entre productos
    if (productoIndex < productos.length - 1) {
      if (!hasEnoughSpaceForTable(currentY, pageHeight, bottomMargin, 10, 2)) {
        doc.addPage();
        currentY = 20;
      } else {
        doc.setDrawColor(229, 231, 235);
        doc.line(10, currentY, pageWidth - 10, currentY);
        currentY += 10;
      }
    }
  });

  // Agregar números de página
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

  doc.save(`Lista_Precios_Impresion_UV_Rigidos_${formatDateForFilename()}.pdf`);
};
