import { useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';

interface UsePrintDocumentOptions {
  documentTitle?: string;
  onBeforePrint?: () => void | Promise<void>;
  onAfterPrint?: () => void;
  removeAfterPrint?: boolean;
}

export function usePrintDocument(options: UsePrintDocumentOptions = {}) {
  const {
    documentTitle = 'documento',
    onBeforePrint,
    onAfterPrint,
    removeAfterPrint = false,
  } = options;

  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => contentRef.current,
    documentTitle,
    onBeforePrint,
    onAfterPrint,
    removeAfterPrint,
    pageStyle: `
      @page {
        size: A4;
        margin: 1.5cm 1cm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
  });

  const print = useCallback(async () => {
    if (!contentRef.current) {
      console.error('No hay contenido para imprimir');
      return;
    }

    try {
      await handlePrint();
    } catch (error) {
      console.error('Error al imprimir:', error);
      throw error;
    }
  }, [handlePrint]);

  return {
    contentRef,
    print,
  };
}
