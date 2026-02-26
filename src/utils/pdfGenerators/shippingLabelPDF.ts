import jsPDF from 'jspdf';

export interface ShippingLabelCompanyData {
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ShippingLabelOrderData {
  numeroOrden: string;
  clienteNombre: string;
  domicilio: string;
  cantidadBultos: number;
}

export interface GenerateShippingLabelsPDFParams {
  company: ShippingLabelCompanyData;
  order: ShippingLabelOrderData;
}

interface LoadedLogo {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

const LABEL_WIDTH = 100;
const LABEL_HEIGHT = 150;

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });

const convertBlobToMonochromeDataUrl = async (blob: Blob): Promise<string | null> => {
  try {
    const objectUrl = URL.createObjectURL(blob);

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const monochrome = luminance >= 180 ? 255 : 0;
      data[i] = monochrome;
      data[i + 1] = monochrome;
      data[i + 2] = monochrome;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    const pngDataUrl = canvas.toDataURL('image/png');
    URL.revokeObjectURL(objectUrl);
    return pngDataUrl;
  } catch {
    return null;
  }
};

const loadImageAsDataUrl = async (url?: string | null): Promise<string | null> => {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    const monochromeLogo = await convertBlobToMonochromeDataUrl(blob);
    if (monochromeLogo) return monochromeLogo;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
};

const sanitizeFileToken = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');

const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' => {
  if (dataUrl.includes('image/png')) return 'PNG';
  return 'JPEG';
};

const getImageDimensions = async (dataUrl: string): Promise<{ width: number; height: number } | null> => {
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        resolve({ width, height });
      };
      img.onerror = () => reject(new Error('No se pudo leer el tamaño del logo'));
      img.src = dataUrl;
    });
  } catch {
    return null;
  }
};

const loadLogo = async (url?: string | null): Promise<LoadedLogo | null> => {
  const dataUrl = await loadImageAsDataUrl(url);
  if (!dataUrl) return null;

  const dimensions = await getImageDimensions(dataUrl);
  if (!dimensions || !dimensions.width || !dimensions.height) return null;

  return {
    dataUrl,
    format: getImageFormat(dataUrl),
    width: dimensions.width,
    height: dimensions.height,
  };
};

const drawLabelPage = (
  doc: jsPDF,
  logo: LoadedLogo | null,
  company: ShippingLabelCompanyData,
  order: ShippingLabelOrderData,
  bultoIndex: number,
  bultosTotal: number
) => {
  const now = new Date();
  const margin = 4;
  const contentWidth = LABEL_WIDTH - margin * 2;
  const contentHeight = LABEL_HEIGHT - margin * 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, margin, contentWidth, contentHeight, 1.5, 1.5);

  doc.setDrawColor(0, 0, 0);
  doc.line(margin + 1, 32, LABEL_WIDTH - margin - 1, 32);

  if (logo) {
    const logoBoxX = 6;
    const logoBoxY = 7;
    const logoBoxWidth = 20;
    const logoBoxHeight = 14;
    const scale = Math.min(logoBoxWidth / logo.width, logoBoxHeight / logo.height);
    const drawWidth = logo.width * scale;
    const drawHeight = logo.height * scale;
    const drawX = logoBoxX + (logoBoxWidth - drawWidth) / 2;
    const drawY = logoBoxY + (logoBoxHeight - drawHeight) / 2;

    doc.addImage(logo.dataUrl, logo.format, drawX, drawY, drawWidth, drawHeight, undefined, 'FAST');
  } else {
    doc.setDrawColor(0, 0, 0);
    doc.roundedRect(6, 7, 20, 14, 1.5, 1.5);
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.text('SIN LOGO', 16, 15, { align: 'center' });
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(company.name || 'Empresa', 29, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const companyLine = [company.address, company.phone, company.email]
    .filter(Boolean)
    .join(' | ');
  const companyLines = doc.splitTextToSize(companyLine || 'Sin datos de contacto', 66);
  doc.text(companyLines, 29, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ETIQUETA DE ENVIO', LABEL_WIDTH - 6, 25, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`Emision: ${now.toLocaleString('es-AR')}`, LABEL_WIDTH - 6, 29, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`OT: ${order.numeroOrden}`, 6, 38);
  doc.text('CLIENTE:', 6, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const clienteNombre = (order.clienteNombre || 'Cliente sin nombre').toUpperCase();
  const clienteLines = doc.splitTextToSize(clienteNombre, 64);
  doc.text(clienteLines, 24, 45);

  doc.setDrawColor(0, 0, 0);
  doc.roundedRect(6, 50, LABEL_WIDTH - 12, 56, 1.5, 1.5);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DOMICILIO DE ENTREGA', 8, 56);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const domicilioLines = doc.splitTextToSize(order.domicilio, LABEL_WIDTH - 18);
  doc.text(domicilioLines, 8, 63);

  doc.setDrawColor(0, 0, 0);
  doc.roundedRect(6, 111, LABEL_WIDTH - 12, 33, 1.5, 1.5);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BULTO', LABEL_WIDTH / 2, 121, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(24);
  doc.text(`${bultoIndex}/${bultosTotal}`, LABEL_WIDTH / 2, 136, { align: 'center' });
};

export const generateShippingLabelsPDF = async ({ company, order }: GenerateShippingLabelsPDFParams) => {
  const totalBultos = Math.max(1, Math.floor(Number(order.cantidadBultos) || 1));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [LABEL_WIDTH, LABEL_HEIGHT],
  });

  const logo = await loadLogo(company.logoUrl);

  for (let i = 1; i <= totalBultos; i += 1) {
    if (i > 1) doc.addPage([LABEL_WIDTH, LABEL_HEIGHT], 'portrait');
    drawLabelPage(doc, logo, company, order, i, totalBultos);
  }

  const dateToken = new Date().toISOString().split('T')[0];
  const orderToken = sanitizeFileToken(order.numeroOrden || 'OT');
  doc.save(`Etiqueta_Envio_${orderToken}_${dateToken}.pdf`);
};
