export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const formatDateForFilename = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const addPageNumber = (
  doc: any,
  pageNumber: number,
  totalPages: number
) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Página ${pageNumber} de ${totalPages}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
};

export const addHeader = (
  doc: any,
  title: string,
  subtitle?: string
) => {
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 22, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, 35, { align: 'center' });
  }

  doc.setTextColor(0, 0, 0);
};

export const addFooter = (
  doc: any,
  companyName: string = 'Sistema de Gestión'
) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.setFillColor(245, 245, 245);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(companyName, 15, pageHeight - 10);

  doc.text(formatDate(), pageWidth - 15, pageHeight - 10, { align: 'right' });
};

export const sortTintas = (tintas: string[]): string[] => {
  return [...tintas].sort((a, b) => {
    const order: { [key: string]: number } = {
      'CMYK': 1,
      'CMYK+W': 2,
      'CMYK+V': 3,
      'CMYK+W+V': 4,
      'K': 5,
    };

    const orderA = order[a] || 999;
    const orderB = order[b] || 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.localeCompare(b);
  });
};

export interface InkColorCircle {
  color: string;
  isVarnish: boolean;
}

export const getInkColorCircles = (tinta: string): InkColorCircle[] => {
  switch (tinta) {
    case 'K':
      return [{ color: '#374151', isVarnish: false }];
    case 'CMYK':
      return [
        { color: '#06b6d4', isVarnish: false },
        { color: '#ec4899', isVarnish: false },
        { color: '#fbbf24', isVarnish: false },
        { color: '#374151', isVarnish: false },
      ];
    case 'CMYK+W':
      return [
        { color: '#06b6d4', isVarnish: false },
        { color: '#ec4899', isVarnish: false },
        { color: '#fbbf24', isVarnish: false },
        { color: '#374151', isVarnish: false },
        { color: '#ffffff', isVarnish: false },
      ];
    case 'CMYK+V':
      return [
        { color: '#06b6d4', isVarnish: false },
        { color: '#ec4899', isVarnish: false },
        { color: '#fbbf24', isVarnish: false },
        { color: '#374151', isVarnish: false },
        { color: '#9E9E9E', isVarnish: true },
      ];
    case 'CMYK+W+V':
      return [
        { color: '#06b6d4', isVarnish: false },
        { color: '#ec4899', isVarnish: false },
        { color: '#fbbf24', isVarnish: false },
        { color: '#374151', isVarnish: false },
        { color: '#ffffff', isVarnish: false },
        { color: '#9E9E9E', isVarnish: true },
      ];
    default:
      return [{ color: '#6b7280', isVarnish: false }];
  }
};

export const estimateTableHeight = (
  rowCount: number,
  cellPadding: number = 3,
  fontSize: number = 8,
  headerHeight: number = 10
): number => {
  const lineHeight = fontSize * 0.35;
  const rowHeight = lineHeight + (cellPadding * 2);
  const bodyHeight = rowCount * rowHeight;
  return headerHeight + bodyHeight + 2;
};

export const hasEnoughSpaceForTable = (
  currentY: number,
  pageHeight: number,
  bottomMargin: number,
  estimatedTableHeight: number,
  minRowsToShow: number = 3
): boolean => {
  const availableSpace = pageHeight - currentY - bottomMargin;
  const minSpaceNeeded = estimatedTableHeight > 0
    ? Math.min(estimatedTableHeight, 10 + (minRowsToShow * 8))
    : 30;

  return availableSpace >= minSpaceNeeded;
};
