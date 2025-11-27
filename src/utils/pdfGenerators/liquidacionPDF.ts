import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { formatDateForFilename, addFooter } from '../pdfHelpers';
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

export const generateLiquidacionPDF = async (params: GenerateLiquidacionPDFParams) => {
  const { liquidacion, cliente, company, items } = params;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 10;

  if (company.logo_url) {
    try {
      const imageBase64 = await loadImageAsBase64(company.logo_url);
      doc.addImage(imageBase64, 'PNG', 15, currentY, 15, 15);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text(company.name, 35, currentY + 8);
    } catch (error) {
      console.warn('Error al cargar logo, usando fallback:', error);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text(company.name, pageWidth / 2, currentY + 8, { align: 'center' });
    }
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(company.name, pageWidth / 2, currentY + 8, { align: 'center' });
  }

  currentY += 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(`LIQUIDACIÓN N° ${liquidacion.numero_liquidacion}`, pageWidth / 2, currentY, {
    align: 'center',
  });

  currentY += 5;

  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.line(10, currentY, pageWidth - 10, currentY);

  currentY += 10;

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(10, currentY, pageWidth - 20, 35, 2, 2, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('Información del Cliente', 15, currentY + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(`Razón Social: ${cliente.razon_social}`, 15, currentY + 13);
  doc.text(`Documento: ${cliente.numero_documento}`, 15, currentY + 18);

  const periodoTexto = liquidacion.periodo_desde && liquidacion.periodo_hasta
    ? `${dayjs(liquidacion.periodo_desde).format('DD/MM/YYYY')} - ${dayjs(liquidacion.periodo_hasta).format('DD/MM/YYYY')}`
    : '-';
  doc.text(`Período Liquidado: ${periodoTexto}`, 15, currentY + 23);
  doc.text(`Fecha de Emisión: ${dayjs(liquidacion.fecha_emision).format('DD/MM/YYYY')}`, 15, currentY + 28);
  doc.text(
    `Fecha de Vencimiento: ${liquidacion.fecha_vencimiento ? dayjs(liquidacion.fecha_vencimiento).format('DD/MM/YYYY') : '-'}`,
    15,
    currentY + 33
  );

  currentY += 42;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('Órdenes de Trabajo Incluidas', 15, currentY);

  currentY += 3;

  if (items.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'italic');
    doc.text('No hay órdenes incluidas en esta liquidación', pageWidth / 2, currentY + 20, {
      align: 'center',
    });
    currentY += 30;
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
      margin: { left: 10, right: 10 },
    });

    currentY = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  doc.setFillColor(243, 244, 246);
  doc.roundedRect(10, currentY, pageWidth - 20, 10, 1, 1, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Subtotal Órdenes:', 15, currentY + 6.5);
  doc.setTextColor(55, 65, 81);
  doc.text(formatCurrency(liquidacion.subtotal_ordenes), pageWidth - 15, currentY + 6.5, {
    align: 'right',
  });

  currentY += 12;

  if (liquidacion.total_ajustes !== 0) {
    doc.setFillColor(255, 243, 224);
    doc.roundedRect(10, currentY, pageWidth - 20, 10, 1, 1, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('Ajustes:', 15, currentY + 6.5);
    const ajustesColor = liquidacion.total_ajustes >= 0 ? [34, 197, 94] : [239, 68, 68];
    doc.setTextColor(...ajustesColor);
    doc.text(formatCurrency(liquidacion.total_ajustes), pageWidth - 15, currentY + 6.5, {
      align: 'right',
    });

    currentY += 12;
  }

  doc.setFillColor(219, 234, 254);
  doc.roundedRect(10, currentY, pageWidth - 20, 12, 1, 1, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('TOTAL GENERAL:', 15, currentY + 8);
  doc.setFontSize(13);
  doc.text(formatCurrency(liquidacion.total_general), pageWidth - 15, currentY + 8, {
    align: 'right',
  });

  currentY += 15;

  if (liquidacion.total_pagado > 0) {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(10, currentY, pageWidth - 20, 10, 1, 1, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('Total Pagado:', 15, currentY + 6.5);
    doc.setTextColor(34, 197, 94);
    doc.text(formatCurrency(liquidacion.total_pagado), pageWidth - 15, currentY + 6.5, {
      align: 'right',
    });

    currentY += 12;
  }

  doc.setFillColor(254, 242, 242);
  doc.roundedRect(10, currentY, pageWidth - 20, 12, 1, 1, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('SALDO PENDIENTE:', 15, currentY + 8);
  doc.setFontSize(13);
  const saldoColor = liquidacion.saldo_pendiente > 0 ? [239, 68, 68] : [34, 197, 94];
  doc.setTextColor(...saldoColor);
  doc.text(formatCurrency(liquidacion.saldo_pendiente), pageWidth - 15, currentY + 8, {
    align: 'right',
  });

  currentY += 15;

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
    doc.roundedRect(10, currentY, pageWidth - 20, 10, 1, 1, 'FD');

    doc.setFontSize(10);
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

  if (liquidacion.notas && liquidacion.notas.trim()) {
    currentY += 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text('Notas:', 15, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);

    const notasLines = doc.splitTextToSize(liquidacion.notas, pageWidth - 30);
    doc.text(notasLines, 15, currentY);
  }

  addFooter(doc, cliente.nombre_fantasia);

  const clienteNormalizado = cliente.nombre_fantasia.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  const filename = `Liquidacion_${liquidacion.numero_liquidacion}_${clienteNormalizado}_${formatDateForFilename()}.pdf`;
  doc.save(filename);
};
