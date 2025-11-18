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
  doc.rect(0, 0, pageWidth, 50, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 25, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageWidth / 2, 38, { align: 'center' });
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
  doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(companyName, 20, pageHeight - 12);

  doc.text(formatDate(), pageWidth - 20, pageHeight - 12, { align: 'right' });
};
