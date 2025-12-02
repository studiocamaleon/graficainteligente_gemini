import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PDFOptions {
  incluirLogo?: boolean;
  incluirCondiciones?: boolean;
}

export async function generarPresupuestoPDF(
  presupuesto: PresupuestoConRelaciones,
  companyData: any,
  options: PDFOptions = {}
): Promise<Blob> {
  const { incluirLogo = true, incluirCondiciones = true } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  // Colores
  const primaryColor: [number, number, number] = [37, 99, 235]; // blue-600
  const textColor: [number, number, number] = [31, 41, 55]; // gray-800
  const lightGray: [number, number, number] = [243, 244, 246]; // gray-100

  // Header con logo y datos empresa
  if (incluirLogo && companyData?.logo_url) {
    try {
      doc.addImage(companyData.logo_url, 'PNG', margin, yPosition, 40, 20);
    } catch (error) {
      console.error('Error cargando logo:', error);
    }
  }

  // Datos de la empresa (derecha)
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  const companyInfo = [
    companyData?.razon_social || 'Empresa',
    companyData?.direccion || '',
    companyData?.telefono ? `Tel: ${companyData.telefono}` : '',
    companyData?.email ? `Email: ${companyData.email}` : '',
  ].filter(Boolean);

  companyInfo.forEach((line, index) => {
    doc.text(line, pageWidth - margin, yPosition + index * 5, { align: 'right' });
  });

  yPosition += 30;

  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('PRESUPUESTO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Número y fecha
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(`N° ${presupuesto.numero_presupuesto}`, pageWidth / 2, yPosition, {
    align: 'center',
  });
  yPosition += 6;
  doc.text(
    `Fecha: ${new Date(presupuesto.fecha_creacion).toLocaleDateString('es-ES')}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 15;

  // Datos del cliente
  doc.setFillColor(...lightGray);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, 25, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('CLIENTE', margin + 5, yPosition + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  const clienteInfo = [
    presupuesto.cliente?.razon_social || 'Sin cliente',
    presupuesto.cliente?.email || '',
    presupuesto.cliente?.telefono || '',
    presupuesto.cliente?.direccion || '',
  ].filter(Boolean);

  clienteInfo.forEach((line, index) => {
    doc.text(line, margin + 5, yPosition + 13 + index * 5);
  });

  yPosition += 30;

  // Validez
  if (presupuesto.fecha_validez) {
    doc.setFontSize(9);
    doc.setTextColor(200, 50, 50);
    doc.text(
      `Válido hasta: ${new Date(presupuesto.fecha_validez).toLocaleDateString('es-ES')}`,
      pageWidth - margin,
      yPosition,
      { align: 'right' }
    );
    yPosition += 10;
  }

  // Tabla de items
  const tableData = (presupuesto.items || []).map((item) => [
    item.producto_nombre,
    item.descripcion || '-',
    item.cantidad.toString(),
    formatCurrency(item.precio_unitario_final),
    formatCurrency(item.precio_total),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Producto', 'Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    alternateRowStyles: {
      fillColor: lightGray,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 60 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // Totales
  const totales = calcularTotales(presupuesto);

  doc.setFillColor(...lightGray);
  doc.rect(pageWidth - margin - 70, yPosition, 70, 25, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text('Subtotal:', pageWidth - margin - 65, yPosition + 8);
  doc.text(
    formatCurrency(totales.subtotal),
    pageWidth - margin - 5,
    yPosition + 8,
    { align: 'right' }
  );

  if (totales.descuentos > 0) {
    doc.setTextColor(200, 50, 50);
    doc.text('Descuentos:', pageWidth - margin - 65, yPosition + 14);
    doc.text(
      `-${formatCurrency(totales.descuentos)}`,
      pageWidth - margin - 5,
      yPosition + 14,
      { align: 'right' }
    );
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL:', pageWidth - margin - 65, yPosition + 21);
  doc.text(
    formatCurrency(totales.total),
    pageWidth - margin - 5,
    yPosition + 21,
    { align: 'right' }
  );

  yPosition += 35;

  // Condiciones comerciales
  if (incluirCondiciones && presupuesto.condiciones_comerciales) {
    // Verificar si hay espacio, sino nueva página
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('CONDICIONES COMERCIALES', margin, yPosition);
    yPosition += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    const condiciones = presupuesto.condiciones_comerciales.split('\n');
    condiciones.forEach((linea) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(linea, margin, yPosition, {
        maxWidth: pageWidth - 2 * margin,
      });
      yPosition += 5;
    });

    yPosition += 5;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // gray-400
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );

    doc.text(
      `Presupuesto generado el ${new Date().toLocaleDateString('es-ES')}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  return doc.output('blob');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(value);
}

function calcularTotales(presupuesto: PresupuestoConRelaciones) {
  const subtotal = (presupuesto.items || []).reduce(
    (sum, item) => sum + Number(item.precio_total),
    0
  );
  const descuentos = 0; // TODO: Si hay descuentos en el futuro
  const total = subtotal - descuentos;

  return { subtotal, descuentos, total };
}

export async function descargarPresupuestoPDF(
  presupuesto: PresupuestoConRelaciones,
  companyData: any
) {
  const blob = await generarPresupuestoPDF(presupuesto, companyData);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Presupuesto_${presupuesto.numero_presupuesto}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
