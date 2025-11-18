import { useRef, useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface UsePDFExportOptions {
  filename?: string;
  pageFormat?: 'a4' | 'letter';
  pageOrientation?: 'portrait' | 'landscape';
}

export function usePDFExport(options: UsePDFExportOptions = {}) {
  const {
    filename = 'document.pdf',
    pageFormat = 'a4',
    pageOrientation = 'portrait',
  } = options;

  const componentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = useCallback(() => {
    if (!componentRef.current) {
      setError('No se encontró el contenido para exportar');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('No se pudo abrir la ventana de impresión. Verifica que los popups estén permitidos.');
      setIsGenerating(false);
      return;
    }

    const content = componentRef.current.innerHTML;
    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename.replace('.pdf', '')}</title>
          <style>${styles}</style>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .hidden { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setIsGenerating(false);
    }, 500);
  }, [filename]);

  const handleDownloadPDF = useCallback(async () => {
    if (!componentRef.current) {
      setError('No se encontró el contenido para exportar');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const element = componentRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgWidth = pageFormat === 'a4' ? 210 : 215.9;
      const pageHeight = pageFormat === 'a4' ? 297 : 279.4;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: pageOrientation,
        unit: 'mm',
        format: pageFormat,
      });

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        position,
        imgWidth,
        imgHeight
      );

      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al generar PDF: ${errorMessage}`);
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [filename, pageFormat, pageOrientation]);

  return {
    componentRef,
    isGenerating,
    error,
    handlePrint,
    handleDownloadPDF,
  };
}
