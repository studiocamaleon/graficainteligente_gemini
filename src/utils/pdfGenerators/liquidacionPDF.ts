import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { formatDateForFilename } from '../pdfHelpers';
import type { Client, Company, Liquidacion, LiquidacionItem } from '../../types/database';

interface GenerateLiquidacionPDFParams {
  liquidacion: Liquidacion;
  cliente: Client;
  company: Company;
  items: LiquidacionItem[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const loadImageAsBase64 = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo obtener el contexto del canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/png');
      resolve(base64);
    };

    img.onerror = () => {
      reject(new Error('Error al cargar la imagen'));
    };

    img.src = url;
  });
};

const addCompanyFooter = (doc: jsPDF, company: Company) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const footerY = pageHeight - 25;

  // Línea divisoria superior
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.line(15, footerY, pageWidth - 15, footerY);

  // Preparar información de la compañía
  const footerLines: string[] = [];

  // Nombre legal o nombre de la compañía
  const companyName = company.legal_name || company.name;
  if (companyName) {
    footerLines.push(companyName);
  }

  // Construir dirección completa si hay datos disponibles
  const addressParts: string[] = [];
  if (company.address) addressParts.push(company.address);
  if (company.postal_code) addressParts.push(`CP ${company.postal_code}`);

  if (addressParts.length > 0) {
    footerLines.push(addressParts.join(' - '));
  }

  // Línea de contacto
  const contactParts: string[] = [];
  if (company.contact_phone) contactParts.push(`Tel: ${company.contact_phone}`);
  if (company.contact_email) contactParts.push(`Email: ${company.contact_email}`);

  if (contactParts.length > 0) {
    footerLines.push(contactParts.join(' | '));
  }

  // Línea de datos fiscales y web
  const fiscalParts: string[] = [];
  if (company.tax_id_type && company.tax_id_number) {
    const taxLabel = company.tax_id_type === 'CUIT' ? 'CUIT' :
                     company.tax_id_type === 'DNI' ? 'DNI' :
                     company.tax_id_type;
    fiscalParts.push(`${taxLabel}: ${company.tax_id_number}`);
  }
  if (company.website) fiscalParts.push(`Web: ${company.website}`);

  if (fiscalParts.length > 0) {
    footerLines.push(fiscalParts.join(' | '));
  }

  // Renderizar footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);

  let currentFooterY = footerY + 4;
  footerLines.forEach((line) => {
    doc.text(line, pageWidth / 2, currentFooterY, { align: 'center' });
    currentFooterY += 3;
  });
};

export const generateLiquidacionPDF = async (params: GenerateLiquidacionPDFParams) => {
  const { liquidacion, cliente, company, items } = params;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 15;

  // === HEADER: Logo + Nombre de la Compañía ===
  if (company.logo_url) {
    try {
      const imageBase64 = await loadImageAsBase64(company.logo_url);
      doc.addImage(imageBase64, 'PNG', 15, currentY, 20, 20);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(company.name, 40, currentY + 12);
    } catch (error) {
      console.warn('Error al cargar logo, usando fallback:', error);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(company.name, 15, currentY + 5);
    }
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(company.name, 15, currentY + 5);
  }

  currentY += 25;

  // === Línea divisoria ===
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(15, currentY, pageWidth - 15, currentY);

  currentY += 8;

  // === Número de Liquidación (justificado a la izquierda) ===
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text(`Liquidación N° ${liquidacion.numero_liquidacion}`, 15, currentY);

  currentY += 10;

  // === Información del Cliente (dos columnas) ===
  const leftColX = 15;
  const rightColX = pageWidth / 2 + 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Información del Cliente', leftColX, currentY);

  currentY += 6;

  // Columna izquierda: Cliente
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Razón Social:', leftColX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(cliente.razon_social, leftColX + 25, currentY);

  currentY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Documento:', leftColX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(cliente.numero_documento, leftColX + 25, currentY);

  // Columna derecha: Fechas
  const rightCurrentY = currentY - 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Período Liquidado:', rightColX, rightCurrentY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const periodoTexto = liquidacion.periodo_desde && liquidacion.periodo_hasta
    ? `${dayjs(liquidacion.periodo_desde).format('DD/MM/YYYY')} - ${dayjs(liquidacion.periodo_hasta).format('DD/MM/YYYY')}`
    : '-';
  doc.text(periodoTexto, rightColX + 35, rightCurrentY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Fecha de Emisión:', rightColX, rightCurrentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(dayjs(liquidacion.fecha_emision).format('DD/MM/YYYY'), rightColX + 35, rightCurrentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Fecha de Vencimiento:', rightColX, rightCurrentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(
    liquidacion.fecha_vencimiento ? dayjs(liquidacion.fecha_vencimiento).format('DD/MM/YYYY') : '-',
    rightColX + 35,
    rightCurrentY + 10
  );

  currentY += 8;

  // Línea separadora
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(15, currentY, pageWidth - 15, currentY);

  currentY += 8;

  // === Tabla de Órdenes ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Órdenes de Trabajo Incluidas', 15, currentY);

  currentY += 3;

  if (items.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'italic');
    doc.text('No hay órdenes incluidas en esta liquidación', pageWidth / 2, currentY + 15, {
      align: 'center',
    });
    currentY += 25;
  } else {
    const tableData = items.map((item) => [
      item.numero_orden,
      dayjs(item.fecha_orden).format('DD/MM/YYYY'),
      item.descripcion,
      formatCurrency(item.monto),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['N° Orden', 'Fecha', 'Descripción', 'Monto']],
      body: tableData,
      theme: 'grid',
      tableWidth: 'auto',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [55, 65, 81],
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 30 },
        1: { halign: 'left', cellWidth: 25 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: 15, right: 15 },
    });

    currentY = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // === Sección de Totales (sin fondos de colores, justificados a la derecha) ===
  const totalsStartX = pageWidth - 70;
  const totalsEndX = pageWidth - 15;

  // Subtotal
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Subtotal:', totalsStartX, currentY, { align: 'left' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text(formatCurrency(liquidacion.subtotal_ordenes), totalsEndX, currentY, { align: 'right' });

  currentY += 6;

  // Ajustes (si existen)
  if (liquidacion.total_ajustes !== 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text('Ajustes:', totalsStartX, currentY, { align: 'left' });

    const ajustesColor = liquidacion.total_ajustes >= 0 ? [34, 197, 94] : [239, 68, 68];
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ajustesColor);
    doc.text(formatCurrency(liquidacion.total_ajustes), totalsEndX, currentY, { align: 'right' });

    currentY += 6;
  }

  // IVA (placeholder para futura implementación cuando se agregue campo requiere_factura)
  // Descomentar cuando el campo esté disponible en la BD:
  /*
  if (cliente.requiere_factura) {
    const IVA_PORCENTAJE = 0.21;
    const montoIVA = liquidacion.subtotal_ordenes * IVA_PORCENTAJE;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text('IVA (21%):', totalsStartX, currentY, { align: 'left' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(formatCurrency(montoIVA), totalsEndX, currentY, { align: 'right' });

    currentY += 6;
  }
  */

  // Línea separadora antes del total
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(totalsStartX, currentY, totalsEndX, currentY);

  currentY += 5;

  // Total General
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('TOTAL GENERAL:', totalsStartX, currentY, { align: 'left' });
  doc.setFontSize(13);
  doc.setTextColor(30, 58, 138);
  doc.text(formatCurrency(liquidacion.total_general), totalsEndX, currentY, { align: 'right' });

  currentY += 8;

  // Total Pagado (si existe)
  if (liquidacion.total_pagado > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text('Total Pagado:', totalsStartX, currentY, { align: 'left' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text(formatCurrency(liquidacion.total_pagado), totalsEndX, currentY, { align: 'right' });

    currentY += 6;
  }

  // Saldo Pendiente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('SALDO PENDIENTE:', totalsStartX, currentY, { align: 'left' });
  doc.setFontSize(13);
  const saldoColor = liquidacion.saldo_pendiente > 0 ? [239, 68, 68] : [34, 197, 94];
  doc.setTextColor(...saldoColor);
  doc.text(formatCurrency(liquidacion.saldo_pendiente), totalsEndX, currentY, { align: 'right' });

  currentY += 10;

  // === Aviso de Vencimiento (si aplica) ===
  if (liquidacion.fecha_vencimiento) {
    const vencimiento = dayjs(liquidacion.fecha_vencimiento);
    const hoy = dayjs();
    const estaVencida = vencimiento.isBefore(hoy, 'day');

    const bgColor = estaVencida ? [254, 226, 226] : [254, 243, 199];
    const borderColor = estaVencida ? [239, 68, 68] : [245, 158, 11];
    const textColor = estaVencida ? [153, 27, 27] : [146, 64, 14];

    doc.setFillColor(...bgColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, currentY, pageWidth - 30, 10, 1, 1, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    const estadoTexto = estaVencida ? '⚠️ VENCIDA' : 'Vence el';
    doc.text(
      `${estadoTexto}: ${vencimiento.format('DD/MM/YYYY')}`,
      pageWidth / 2,
      currentY + 6.5,
      { align: 'center' }
    );

    currentY += 12;
  }

  // === Notas (si existen) ===
  if (liquidacion.notas && liquidacion.notas.trim()) {
    currentY += 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('Notas:', 15, currentY);
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    const notasLines = doc.splitTextToSize(liquidacion.notas, pageWidth - 30);
    doc.text(notasLines, 15, currentY);
  }

  // === Footer con datos de la compañía ===
  addCompanyFooter(doc, company);

  // === Guardar PDF ===
  const clienteNormalizado = cliente.nombre_fantasia.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  const filename = `Liquidacion_${liquidacion.numero_liquidacion}_${clienteNormalizado}_${formatDateForFilename()}.pdf`;
  doc.save(filename);
};
