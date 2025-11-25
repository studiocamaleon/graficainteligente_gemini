import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import { formatDateForFilename, addHeader, addFooter } from '../pdfHelpers';
import type { Client } from '../../types/database';
import type { EstadoCuentaMovimiento } from '../../types/database';

interface GenerateEstadoCuentaPDFParams {
  cliente: Client;
  movimientos: EstadoCuentaMovimiento[];
  saldoInicial: number;
  saldoFinal: number;
  fechaDesde: string;
  fechaHasta: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getTipoMovimientoLabel = (tipo: string): string => {
  const labels: { [key: string]: string } = {
    'cargo': 'Cargo',
    'pago': 'Pago',
    'ajuste': 'Ajuste',
  };
  return labels[tipo] || tipo;
};

export const generateEstadoCuentaPDF = async (params: GenerateEstadoCuentaPDFParams) => {
  const { cliente, movimientos, saldoInicial, saldoFinal, fechaDesde, fechaHasta } = params;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let currentY = 55;

  addHeader(doc, 'Estado de Cuenta', cliente.nombre_fantasia);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(10, currentY, pageWidth - 20, 25, 2, 2, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('Información del Cliente', 15, currentY + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  doc.text(`Razón Social: ${cliente.razon_social}`, 15, currentY + 13);
  doc.text(`Documento: ${cliente.numero_documento}`, 15, currentY + 18);
  doc.text(`Período: ${fechaDesde} - ${fechaHasta}`, 15, currentY + 23);

  currentY += 32;

  doc.setFillColor(243, 244, 246);
  doc.roundedRect(10, currentY, pageWidth - 20, 10, 1, 1, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Saldo Inicial:', 15, currentY + 6.5);

  const saldoInicialColor = saldoInicial >= 0 ? [34, 197, 94] : [239, 68, 68];
  doc.setTextColor(...saldoInicialColor);
  doc.text(formatCurrency(saldoInicial), pageWidth - 15, currentY + 6.5, { align: 'right' });

  currentY += 15;

  if (movimientos.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'italic');
    doc.text('No hay movimientos en el período seleccionado', pageWidth / 2, currentY + 20, {
      align: 'center',
    });
    currentY += 30;
  } else {
    const tableData = movimientos.map((mov) => [
      dayjs(mov.fecha).format('DD/MM/YYYY'),
      getTipoMovimientoLabel(mov.tipo_movimiento),
      mov.descripcion,
      mov.monto_debe > 0 ? formatCurrency(mov.monto_debe) : '-',
      mov.monto_haber > 0 ? formatCurrency(mov.monto_haber) : '-',
      formatCurrency(mov.saldo_acumulado),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Fecha', 'Tipo', 'Descripción', 'Debe', 'Haber', 'Saldo']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
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
        0: { halign: 'left', cellWidth: 22 },
        1: { halign: 'left', cellWidth: 20 },
        2: { halign: 'left', cellWidth: 60 },
        3: { halign: 'right', cellWidth: 25, textColor: [220, 38, 38] },
        4: { halign: 'right', cellWidth: 25, textColor: [22, 163, 74] },
        5: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: 10, right: 10 },
    });

    currentY = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  doc.setFillColor(243, 244, 246);
  doc.roundedRect(10, currentY, pageWidth - 20, 12, 1, 1, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(75, 85, 99);
  doc.text('Saldo Final:', 15, currentY + 8);

  const saldoFinalColor = saldoFinal >= 0 ? [34, 197, 94] : [239, 68, 68];
  doc.setFontSize(13);
  doc.setTextColor(...saldoFinalColor);
  doc.text(formatCurrency(saldoFinal), pageWidth - 15, currentY + 8, { align: 'right' });

  addFooter(doc, cliente.nombre_fantasia);

  const clienteNormalizado = cliente.nombre_fantasia
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '');
  const filename = `Estado_Cuenta_${clienteNormalizado}_${formatDateForFilename()}.pdf`;
  doc.save(filename);
};
