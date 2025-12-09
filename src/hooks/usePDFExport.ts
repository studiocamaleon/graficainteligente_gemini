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
            const el = clonedElement as HTMLElement;
            el.style.display = 'block';
            el.style.position = 'relative';
            el.style.visibility = 'visible';

            // Smart Page Break Logic
            const MARGIN_MM = 10;
            const PAGE_HEIGHT_MM = 297;
            // Aggressive safety margin: 260mm to ensure we clear the cut line comfortably
            const SAFE_PRINTABLE_HEIGHT_MM = 260;

            // Calculate pixels per mm based on the Render Width (which will be scaled to Printable Width)
            const printableWidthMm = 210 - (2 * MARGIN_MM);
            const pxPerMm = el.scrollWidth / printableWidthMm;
            const pageHeightPx = SAFE_PRINTABLE_HEIGHT_MM * pxPerMm;

            const avoidBreakElements = Array.from(el.querySelectorAll('.avoid-break'));

            avoidBreakElements.forEach((child) => {
              const childEl = child as HTMLElement;

              // Use LIVE offsetTop
              const currentTop = childEl.offsetTop;
              const height = childEl.offsetHeight;

              const pageIndex = Math.floor((currentTop + 1) / pageHeightPx);
              const pageBoundary = (pageIndex + 1) * pageHeightPx;

              // Check if element crosses page boundary or is dangerously close to the bottom
              // (Using strict > comparison against pageBoundary)
              if (currentTop + height > pageBoundary) {
                // Calculate distance to next page start
                let spacer = pageBoundary - currentTop;
                spacer += 10; // +10px buffer

                let targetElement = childEl;

                // Orphan Detection
                let prev = childEl.previousElementSibling as HTMLElement;

                // Uncle check
                if (!prev && childEl.parentElement) {
                  const parentPrev = childEl.parentElement.previousElementSibling as HTMLElement;
                  if (parentPrev) {
                    prev = parentPrev;
                  }
                }

                if (prev && (prev.classList.contains('pdf-section-header') || /^H[1-6]$/.test(prev.tagName))) {
                  const headerTop = prev.offsetTop;
                  spacer = pageBoundary - headerTop + 10;
                  targetElement = prev;
                }

                // Additive Margin Logic
                const style = window.getComputedStyle(targetElement);
                const currentMargin = parseFloat(style.marginTop) || 0;
                targetElement.style.marginTop = `${currentMargin + spacer}px`;
              }
            });
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

      const MARGIN_MM = 10;
      const PAGE_HEIGHT_MM = 297;
      const PRINTABLE_HEIGHT_MM = PAGE_HEIGHT_MM - (2 * MARGIN_MM); // 277mm

      const pdf = new jsPDF({
        orientation: pageOrientation,
        unit: 'mm',
        format: pageFormat,
      });

      // Calculate dimensions to fit width within margins
      const pageWidth = pageFormat === 'a4' ? 210 : 215.9;
      const imgWidth = pageWidth - (2 * MARGIN_MM); // 190mm for A4

      // Calculate total height of the image in mm
      const totalImgHeightMM = (canvas.height * imgWidth) / canvas.width;

      let remainingHeight = totalImgHeightMM;
      let sourceYOffset = 0; // Where we are in the source image (in mm scale relative to print)

      while (remainingHeight > 0) {
        if (sourceYOffset > 0) {
          pdf.addPage();
        }

        // We place the FULL image, but shifted UP so that the desired chunk falls into the printable area.
        // The printable area starts at Y = MARGIN_MM.
        // We want sourceYOffset to align with MARGIN_MM.
        // So ImageY = MARGIN_MM - sourceYOffset.
        const positionY = MARGIN_MM - sourceYOffset;

        pdf.addImage(
          imageData,
          'PNG',
          MARGIN_MM,
          positionY,
          imgWidth,
          totalImgHeightMM
        );

        // WHITE MASKS to hide content overflow in margins (Prevents duplication/overlap)
        pdf.setFillColor(255, 255, 255);
        // Top Margin Mask
        pdf.rect(0, 0, pageWidth, MARGIN_MM, 'F');
        // Bottom Margin Mask (Start at Margin + PrintableHeight)
        pdf.rect(0, MARGIN_MM + PRINTABLE_HEIGHT_MM, pageWidth, MARGIN_MM, 'F');

        sourceYOffset += PRINTABLE_HEIGHT_MM;
        remainingHeight -= PRINTABLE_HEIGHT_MM;
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
