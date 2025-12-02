import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PDFOptions {
  incluirLogo?: boolean;
  incluirCondiciones?: boolean;
}

// Paleta de colores fintech ultramoderna
const COLORS = {
  // Gradiente principal (azul a violeta)
  primary: [79, 70, 229] as [number, number, number], // indigo-600
  primaryLight: [129, 140, 248] as [number, number, number], // indigo-400
  accent: [139, 92, 246] as [number, number, number], // violet-500

  // Textos
  dark: [15, 23, 42] as [number, number, number], // slate-900
  text: [51, 65, 85] as [number, number, number], // slate-700
  textLight: [100, 116, 139] as [number, number, number], // slate-500

  // Fondos
  bgLight: [248, 250, 252] as [number, number, number], // slate-50
  bgCard: [241, 245, 249] as [number, number, number], // slate-100
  white: [255, 255, 255] as [number, number, number],

  // Estados
  success: [34, 197, 94] as [number, number, number], // green-500
  warning: [234, 179, 8] as [number, number, number], // yellow-500
  danger: [239, 68, 68] as [number, number, number], // red-500
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
  const margin = 15;
  let yPosition = 15;

  // ============================================================================
  // HEADER ULTRAMODERNO CON GRADIENTE
  // ============================================================================

  // Fondo gradiente sutil en header (simulado con degradado de grises)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Línea decorativa superior (gradiente simulado)
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 2, 'F');

  // Logo (izquierda)
  if (incluirLogo && companyData?.logo_url) {
    try {
      const logoFormat = companyData.logo_url.toLowerCase().includes('.png') ? 'PNG' :
                        companyData.logo_url.toLowerCase().includes('.jpg') ||
                        companyData.logo_url.toLowerCase().includes('.jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(companyData.logo_url, logoFormat, margin, yPosition + 5, 35, 17);
    } catch (error) {
      console.error('Error cargando logo:', error);
    }
  }

  // Nombre empresa (estilo moderno)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.dark);
  doc.text(
    companyData?.legal_name || companyData?.name || 'Tu Empresa',
    pageWidth - margin,
    yPosition + 10,
    { align: 'right' }
  );

  // Datos empresa (minimalista)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);

  const companyDetails = [
    companyData?.address || '',
    companyData?.contact_phone || '',
    companyData?.contact_email || companyData?.email || '',
  ].filter(Boolean);

  companyDetails.forEach((detail, index) => {
    doc.text(detail, pageWidth - margin, yPosition + 16 + (index * 4), { align: 'right' });
  });

  yPosition = 60;

  // ============================================================================
  // TÍTULO Y NÚMERO (DISEÑO HERO)
  // ============================================================================

  // Badge "PRESUPUESTO" moderno
  doc.setFillColor(...COLORS.primary);
  const badgeWidth = 60;
  const badgeHeight = 8;
  const badgeX = (pageWidth - badgeWidth) / 2;
  doc.roundedRect(badgeX, yPosition, badgeWidth, badgeHeight, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text('PRESUPUESTO', pageWidth / 2, yPosition + 5.5, { align: 'center' });

  yPosition += 15;

  // Número grande y destacado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.primary);
  doc.text(presupuesto.numero_presupuesto, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 8;

  // Fecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(
    `Fecha: ${new Date(presupuesto.fecha_creacion).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  yPosition += 15;

  // ============================================================================
  // CARDS MODERNOS (CLIENTE Y VALIDEZ)
  // ============================================================================

  const cardWidth = (pageWidth - 3 * margin) / 2;
  const cardHeight = 35;

  // Card Cliente (izquierda)
  drawModernCard(doc, margin, yPosition, cardWidth, cardHeight, {
    title: 'CLIENTE',
    lines: [
      presupuesto.cliente?.razon_social || 'Sin cliente',
      presupuesto.cliente?.email || '',
      presupuesto.cliente?.whatsapp ? `Tel: ${presupuesto.cliente.whatsapp}` : '',
      presupuesto.cliente?.domicilio || '',
    ].filter(Boolean),
  });

  // Card Validez (derecha)
  const diasValidez = presupuesto.fecha_validez
    ? Math.ceil(
        (new Date(presupuesto.fecha_validez).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const validezColor = diasValidez > 7 ? COLORS.success : diasValidez > 0 ? COLORS.warning : COLORS.danger;

  drawModernCard(doc, pageWidth - margin - cardWidth, yPosition, cardWidth, cardHeight, {
    title: 'VALIDEZ',
    lines: [
      presupuesto.fecha_validez
        ? new Date(presupuesto.fecha_validez).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })
        : 'No especificada',
      diasValidez > 0
        ? `${diasValidez} dias restantes`
        : diasValidez === 0
        ? 'Vence hoy'
        : 'Vencido',
    ],
    accent: validezColor,
  });

  yPosition += cardHeight + 10;

  // ============================================================================
  // TABLA DE ITEMS (DISEÑO MODERNO)
  // ============================================================================

  const items = presupuesto.items || [];

  if (items.length > 0) {
    const tableData = items.map((item, index) => [
      (index + 1).toString(),
      item.producto_nombre,
      item.descripcion || '-',
      item.cantidad.toString(),
      formatCurrency(item.precio_unitario_final),
      formatCurrency(item.precio_total),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Producto', 'Descripción', 'Cant.', 'Precio Unit.', 'Total']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      },
      bodyStyles: {
        fontSize: 9,
        textColor: COLORS.text,
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      },
      alternateRowStyles: {
        fillColor: COLORS.bgLight,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: COLORS.textLight },
        1: { cellWidth: 50 },
        2: { cellWidth: 55 },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Línea decorativa después de la tabla
        if (data.cursor) {
          doc.setDrawColor(...COLORS.bgCard);
          doc.setLineWidth(0.5);
          doc.line(margin, data.cursor.y, pageWidth - margin, data.cursor.y);
        }
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textLight);
    doc.text('No hay items en este presupuesto', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }

  // ============================================================================
  // TOTALES (CARD DESTACADO)
  // ============================================================================

  const totales = calcularTotales(presupuesto);
  const totalesCardWidth = 75;
  const totalesCardHeight = totales.descuentos > 0 ? 28 : 22;
  const totalesX = pageWidth - margin - totalesCardWidth;

  // Card con sombra simulada
  doc.setFillColor(...COLORS.bgCard);
  doc.roundedRect(totalesX - 1, yPosition + 1, totalesCardWidth, totalesCardHeight, 3, 3, 'F');

  doc.setFillColor(...COLORS.white);
  doc.roundedRect(totalesX, yPosition, totalesCardWidth, totalesCardHeight, 3, 3, 'F');

  doc.setDrawColor(...COLORS.bgCard);
  doc.setLineWidth(0.5);
  doc.roundedRect(totalesX, yPosition, totalesCardWidth, totalesCardHeight, 3, 3, 'S');

  let totalYPos = yPosition + 8;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text('Subtotal', totalesX + 5, totalYPos);
  doc.text(formatCurrency(totales.subtotal), totalesX + totalesCardWidth - 5, totalYPos, {
    align: 'right',
  });

  totalYPos += 6;

  // Descuentos (si hay)
  if (totales.descuentos > 0) {
    doc.setTextColor(...COLORS.danger);
    doc.text('Descuentos', totalesX + 5, totalYPos);
    doc.text(`-${formatCurrency(totales.descuentos)}`, totalesX + totalesCardWidth - 5, totalYPos, {
      align: 'right',
    });
    totalYPos += 6;
  }

  // Línea separadora
  doc.setDrawColor(...COLORS.bgCard);
  doc.setLineWidth(0.5);
  doc.line(totalesX + 5, totalYPos - 2, totalesX + totalesCardWidth - 5, totalYPos - 2);

  totalYPos += 4;

  // Total (destacado)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.text('TOTAL', totalesX + 5, totalYPos);
  doc.text(formatCurrency(totales.total), totalesX + totalesCardWidth - 5, totalYPos, {
    align: 'right',
  });

  yPosition += totalesCardHeight + 15;

  // ============================================================================
  // CONDICIONES COMERCIALES (SI EXISTEN)
  // ============================================================================

  if (incluirCondiciones && presupuesto.condiciones_comerciales) {
    // Verificar espacio disponible
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    // Título con badge
    doc.setFillColor(...COLORS.bgCard);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text('CONDICIONES COMERCIALES', margin + 5, yPosition + 6.5);

    yPosition += 15;

    // Contenido
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);

    const condiciones = presupuesto.condiciones_comerciales.split('\n');
    condiciones.forEach((linea) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      // Bullet point con guion
      if (linea.trim()) {
        doc.text(`- ${linea.trim()}`, margin + 3, yPosition, {
          maxWidth: pageWidth - 2 * margin - 10,
        });
        yPosition += 5;
      } else {
        yPosition += 3;
      }
    });
  }

  // ============================================================================
  // FOOTER MODERNO (TODAS LAS PÁGINAS)
  // ============================================================================

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 12;

    // Línea decorativa superior del footer
    doc.setDrawColor(...COLORS.bgCard);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    // Texto del footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);

    doc.text(
      `Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
      margin,
      footerY
    );

    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });

    // Mini badge fintech
    doc.setFillColor(...COLORS.primary);
    const badgeMiniWidth = 25;
    doc.roundedRect(
      (pageWidth - badgeMiniWidth) / 2,
      footerY - 1.5,
      badgeMiniWidth,
      3,
      1,
      1,
      'F'
    );
  }

  return doc.output('blob');
}

// ============================================================================
// FUNCIÓN AUXILIAR: CARD MODERNO
// ============================================================================

function drawModernCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  config: {
    title: string;
    lines: string[];
    accent?: [number, number, number];
  }
) {
  const { title, lines, accent } = config;

  // Sombra simulada (offset)
  doc.setFillColor(COLORS.bgCard[0], COLORS.bgCard[1], COLORS.bgCard[2]);
  doc.roundedRect(x + 1, y + 1, width, height, 3, 3, 'F');

  // Card principal
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(x, y, width, height, 3, 3, 'F');

  // Borde
  doc.setDrawColor(...COLORS.bgCard);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, height, 3, 3, 'S');

  // Accent bar (si se proporciona)
  if (accent) {
    doc.setFillColor(...accent);
    doc.roundedRect(x, y, width, 3, 3, 3, 'F');
  } else {
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(x, y, width, 3, 3, 3, 'F');
  }

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textLight);
  doc.text(title, x + 5, y + 10);

  // Líneas de contenido
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);

  lines.forEach((line, index) => {
    if (index === 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    const lineY = y + 16 + index * 5;
    doc.text(line, x + 5, lineY, { maxWidth: width - 10 });
  });
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

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
