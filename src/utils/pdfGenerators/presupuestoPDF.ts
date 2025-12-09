import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PDFOptions {
  incluirLogo?: boolean;
  incluirCondiciones?: boolean;
}

// ============================================================================
// DESIGN CONSTANTS - PREMIUM MINIMALIST
// ============================================================================

const COLORS = {
  text: [17, 24, 39] as [number, number, number], // Gray 900
  secondaryText: [107, 114, 128] as [number, number, number], // Gray 500
  accent: [31, 41, 55] as [number, number, number], // Gray 800 (Header bg, strong elements)
  border: [229, 231, 235] as [number, number, number], // Gray 200
  lightBg: [249, 250, 251] as [number, number, number], // Gray 50
  white: [255, 255, 255] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number], // Red 600
};

export async function generarPresupuestoPDF(
  presupuesto: PresupuestoConRelaciones,
  companyData: any,
  options: PDFOptions = {}
): Promise<Blob> {
  const { incluirLogo = true, incluirCondiciones = true } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20; // More ample margin for "document" feel
  let yPosition = 20;

  // ============================================================================
  // HEADER SECTION
  // ============================================================================

  // --- Left Side: Company Info ---
  const headerLeftX = margin;
  let headerLeftY = yPosition;

  if (incluirLogo && companyData?.logo_url) {
    try {
      const dimensions = await loadImageDimensions(companyData.logo_url);
      if (dimensions) {
        const maxWidth = 45;
        const maxHeight = 25;
        let w = maxWidth;
        let h = (dimensions.height / dimensions.width) * w;

        if (h > maxHeight) {
          h = maxHeight;
          w = (dimensions.width / dimensions.height) * h;
        }

        const logoFormat = companyData.logo_url.toLowerCase().split('.').pop()?.toUpperCase() === 'JPG' ? 'JPEG' : 'PNG';
        doc.addImage(companyData.logo_url, logoFormat, headerLeftX, headerLeftY, w, h);
        headerLeftY += h + 8;
      }
    } catch (e) {
      console.error("Logo load error", e);
    }
  } else {
    // Fallback text logo if no image
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.text);
    doc.text(companyData?.name || companyData?.legal_name || 'EMPRESA', headerLeftX, headerLeftY + 8);
    headerLeftY += 15;
  }

  // Company Name & Details
  if (companyData?.logo_url) { // Only show name text if it wasn't the "fallback"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.text);
    doc.text(companyData?.name || companyData?.legal_name || '', headerLeftX, headerLeftY);
    headerLeftY += 6;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondaryText);

  const companyLines = [
    companyData?.address,
    companyData?.contact_phone,
    companyData?.contact_email || companyData?.email
  ].filter(Boolean);

  companyLines.forEach(line => {
    doc.text(line, headerLeftX, headerLeftY);
    headerLeftY += 5;
  });

  // --- Right Side: Document Meta ---
  const headerRightX = pageWidth - margin;
  let headerRightY = yPosition + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondaryText);
  doc.text('PRESUPUESTO', headerRightX, headerRightY, { align: 'right' });

  headerRightY += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.text);
  doc.text(`#${presupuesto.numero_presupuesto}`, headerRightX, headerRightY, { align: 'right' });

  headerRightY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondaryText);
  doc.text(`Fecha: ${new Date(presupuesto.fecha_creacion).toLocaleDateString('es-ES')}`, headerRightX, headerRightY, { align: 'right' });

  if (presupuesto.fecha_validez) {
    headerRightY += 5;
    doc.setTextColor(...COLORS.danger);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Válido hasta: ${new Date(presupuesto.fecha_validez).toLocaleDateString('es-ES')}`, headerRightX, headerRightY, { align: 'right' });
  }

  yPosition = Math.max(headerLeftY, headerRightY) + 15;

  // ============================================================================
  // SEPARATOR 
  // ============================================================================
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.1); // Ultra thin line
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // ============================================================================
  // CLIENT SECTION
  // ============================================================================

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondaryText);
  doc.text('PREPARADO PARA', margin, yPosition);

  yPosition += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text(presupuesto.cliente?.razon_social || 'Cliente Final', margin, yPosition);

  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondaryText);

  const clientInfo = [
    presupuesto.cliente?.email,
    presupuesto.cliente?.telefono || presupuesto.cliente?.whatsapp,
    presupuesto.cliente?.domicilio
  ].filter(Boolean);

  clientInfo.forEach(info => {
    doc.text(info as string, margin, yPosition);
    yPosition += 5;
  });

  yPosition += 10;

  // ============================================================================
  // ITEMS TABLE
  // ============================================================================

  const items = presupuesto.items || [];

  if (items.length > 0) {
    const tableBody = items.map(item => [
      item.producto_nombre + (item.descripcion ? `\n${item.descripcion}` : ''),
      item.cantidad.toString(),
      formatCurrency(item.precio_unitario_final),
      formatCurrency(item.precio_total)
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['ITEM', 'CANT', 'PRECIO', 'TOTAL']],
      body: tableBody,
      theme: 'plain', // Minimalist clean theme
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: COLORS.text,
        cellPadding: 6,
        lineColor: COLORS.lightBg, // Very subtle borders
        lineWidth: 0,
      },
      headStyles: {
        fillColor: COLORS.white,
        textColor: COLORS.secondaryText,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        // Border bottom for header
        // We simulate this with 'didDrawCell' or just rely on structure
      },
      columnStyles: {
        0: { cellWidth: 'auto' }, // Item name
        1: { cellWidth: 20, halign: 'right' }, // Qty
        2: { cellWidth: 35, halign: 'right' }, // Price
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } // Total
      },
      didDrawPage: (data) => {
        // Header bottom border
        if (data.cursor) {
          const headerY = data.settings.startY + 8; // approx header height
          doc.setDrawColor(...COLORS.border);
          doc.setLineWidth(0.1);
          // doc.line(margin, headerY, pageWidth - margin, headerY);
        }
      },
      didParseCell: (data) => {
        // Apply borders only to bottom of rows?
        if (data.section === 'head') {
          // Clean header
        }
      },
      willDrawCell: (data) => {
        // Custom border logic if needed
        if (data.section === 'head') {
          doc.setDrawColor(...COLORS.border);
          doc.setLineWidth(0.1);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
        if (data.section === 'body') {
          doc.setDrawColor(...COLORS.lightBg);
          doc.setLineWidth(0.1);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      }
    });

    // Update yPosition to end of table
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============================================================================
  // TOTALS SECTION
  // ============================================================================

  const totales = calcularTotales(presupuesto);
  const totalsWidth = 80;
  const totalsX = pageWidth - margin - totalsWidth;

  // Ensure we don't break page inside totals roughly
  if (yPosition + 40 > pageHeight) {
    doc.addPage();
    yPosition = 20;
  }

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.secondaryText);
  doc.text('Subtotal', totalsX, yPosition);
  doc.text(formatCurrency(totales.subtotal), pageWidth - margin, yPosition, { align: 'right' });

  yPosition += 7;

  // Discounts
  if (totales.descuentos > 0) {
    doc.setTextColor(...COLORS.danger);
    doc.text('Descuentos', totalsX, yPosition);
    doc.text(`-${formatCurrency(totales.descuentos)}`, pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 7;
  }

  // Line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.1);
  doc.line(totalsX, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text('Total', totalsX, yPosition + 2); // adjustment
  doc.text(formatCurrency(totales.total), pageWidth - margin, yPosition + 2, { align: 'right' });

  yPosition += 20;

  // ============================================================================
  // CONDITIONS
  // ============================================================================

  if (incluirCondiciones && presupuesto.condiciones_comerciales) {
    if (yPosition + 30 > pageHeight) {
      doc.addPage();
      yPosition = 20;
    }

    // Box style background
    const boxPadding = 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text('CONDICIONES COMERCIALES', margin, yPosition);
    yPosition += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondaryText);

    const condiciones = doc.splitTextToSize(presupuesto.condiciones_comerciales, pageWidth - (margin * 2));
    doc.text(condiciones, margin, yPosition);

    yPosition += (condiciones.length * 4) + 10;
  }

  // ============================================================================
  // FOOTER
  // ============================================================================

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;

    // Thin line
    doc.setDrawColor(...COLORS.lightBg);
    doc.setLineWidth(0.1);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150); // Light gray

    doc.text(`Presupuesto generado el ${new Date().toLocaleDateString('es-ES')}`, margin, footerY);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
  }

  return doc.output('blob');
}

// =======================
// HELPERS
// =======================

function loadImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
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
  // Assuming discounts logic might be added later, simplified here
  const descuentos = 0;
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
