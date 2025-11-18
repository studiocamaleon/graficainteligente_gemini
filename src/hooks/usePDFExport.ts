import { useRef, useCallback, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
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

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: filename.replace('.pdf', ''),
    onBeforePrint: async () => {
      setIsGenerating(true);
    },
    onAfterPrint: () => {
      setIsGenerating(false);
    },
    onPrintError: (errorLocation, error) => {
      setError(`Error al imprimir: ${error.message}`);
      setIsGenerating(false);
    },
  });

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
