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

      const elementWidth = element.scrollWidth;
      const elementHeight = element.scrollHeight;

      if (elementWidth === 0 || elementHeight === 0) {
        throw new Error('El elemento a exportar no tiene dimensiones válidas. Asegúrate de que el contenido esté visible.');
      }

      console.log('[PDF Export] Iniciando captura de canvas:', {
        width: elementWidth,
        height: elementHeight
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: elementWidth,
        windowHeight: elementHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('[data-pdf-content]');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.display = 'block';
            (clonedElement as HTMLElement).style.position = 'relative';
            (clonedElement as HTMLElement).style.visibility = 'visible';
          }
        },
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('El canvas generado no tiene dimensiones válidas');
      }

      console.log('[PDF Export] Canvas generado:', {
        width: canvas.width,
        height: canvas.height
      });

      let imageData: string;
      try {
        imageData = canvas.toDataURL('image/png');
      } catch (canvasError) {
        console.error('[PDF Export] Error al convertir canvas a Data URL:', canvasError);
        throw new Error('Error al procesar la imagen del contenido. Intenta reducir el tamaño del contenido.');
      }

      if (!imageData || !imageData.startsWith('data:image/png;base64,')) {
        throw new Error('El formato de imagen generado no es válido');
      }

      const base64Length = imageData.split(',')[1]?.length || 0;
      if (base64Length < 100) {
        throw new Error('La imagen generada está vacía o corrupta');
      }

      console.log('[PDF Export] Data URL generado correctamente, tamaño base64:', base64Length);

      const margin = 5;
      const imgWidth = (pageFormat === 'a4' ? 210 : 215.9) - (margin * 2);
      const pageHeight = pageFormat === 'a4' ? 297 : 279.4;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: pageOrientation,
        unit: 'mm',
        format: pageFormat,
      });

      let heightLeft = imgHeight;
      let position = margin;

      try {
        pdf.addImage(
          imageData,
          'PNG',
          margin,
          position,
          imgWidth,
          imgHeight
        );
      } catch (addImageError) {
        console.error('[PDF Export] Error al agregar imagen al PDF:', addImageError);
        throw new Error('Error al agregar la imagen al PDF. El contenido puede ser demasiado grande.');
      }

      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(
          imageData,
          'PNG',
          margin,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      console.log('[PDF Export] PDF generado exitosamente');
      pdf.save(filename);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al generar PDF: ${errorMessage}`);
      console.error('[PDF Export] Error completo:', err);
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
