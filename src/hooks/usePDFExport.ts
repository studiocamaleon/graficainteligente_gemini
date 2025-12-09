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

      // New atom-based visibility toggle implementation starts here
      // 1. Create a Deep Clone for processing (Hidden but rendered)
      // We append it to body to ensure it has checking context, but absolute positioned off-screen
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      // Force exact A4 width context to ensure layouts match
      clone.style.width = '210mm';
      // Reset height to auto to let content flow
      clone.style.height = 'auto';
      clone.style.minHeight = 'auto';

      document.body.appendChild(clone);

      try {
        // 2. Identify "Atoms" (The smallest units we will toggle visibility for)
        // Traverser logic:
        // - If element is .avoid-break -> Atom.
        // - If element has no children (text) -> Atom.
        // - Else -> Container (recurse).

        const atoms: HTMLElement[] = [];

        const findAtoms = (el: HTMLElement) => {
          // If explicitly marked as atomic
          if (el.classList.contains('avoid-break') || el.tagName === 'TR' || el.tagName === 'IMG') {
            atoms.push(el);
            return;
          }

          // If no children, it's a leaf atom (text, etc)
          if (el.children.length === 0) {
            // Only add if it has visible height or content
            if (el.innerText.trim() !== '' || el.offsetHeight > 0) {
              atoms.push(el);
            }
            return;
          }

          // If it is a container, recurse children
          Array.from(el.children).forEach(child => findAtoms(child as HTMLElement));
        };

        findAtoms(clone);

        // 3. Simulate Pagination (Measure and Assign pages)
        const PAGE_LIMIT = 1080; // Increased to ~285mm to match 5mm margins (297-10 = 287mm)
        // Leaving room for margins.
        // 1mm ~ 3.78px. 10mm margin ~ 38px.
        // 1123 - (2 * 38) = 1047px.
        // Let's use 1000px to be super safe.

        // Reset visibility first (ensure everything is block/flex as intended)
        atoms.forEach(atom => {
          // We'll use a data attribute to store the assigned page
          atom.dataset.pdfPage = '';
        });

        // Wait, the "Simulate Pagination" must reference the STATIC layout of the full document.
        // If an element is at Y=1500px in the full document, it MUST go to Page 2 (approx).
        // Let's use strict offsetTop logic on the Full Clone.

        atoms.forEach(atom => {
          // Find accumulated top relative to the clone root.
          let top = 0;
          let el: HTMLElement | null = atom;
          while (el && el !== clone) {
            top += el.offsetTop;
            el = el.offsetParent as HTMLElement;
          }

          // Note: This 'top' is roughly the position in the continuous run.
          // Page 1 ends at 1000px.
          // Page 2 ends at 2000px.
          // Element strictly belongs to floor(top / 1000) + 1.

          // But wait, if an element is at 950px and height is 100px (Ends at 1050px).
          // It crosses the boundary. It should be pushed to Page 2.
          // The simple "floor" logic puts it on Page 1.

          const atomTop = top;
          const atomBottom = top + atom.offsetHeight;

          // Check boundary crossing
          const startPage = Math.floor(atomTop / PAGE_LIMIT) + 1;
          const endPage = Math.floor(atomBottom / PAGE_LIMIT) + 1;

          let assignedPage = startPage;

          if (endPage > startPage) {
            // It crosses a break.
            // We should push it to the next page to strictly avoid break.
            assignedPage = endPage;
          }

          atom.dataset.pdfPage = assignedPage.toString();
        });

        // 4. Generate PDF Pages
        const pdf = new jsPDF({
          orientation: pageOrientation === 'portrait' ? 'p' : 'l',
          unit: 'mm',
          format: pageFormat,
        });

        // Find max assigned page
        let maxPage = 1;
        atoms.forEach(a => {
          const p = parseInt(a.dataset.pdfPage || '1');
          if (p > maxPage) maxPage = p;
        });

        for (let p = 1; p <= maxPage; p++) {
          if (p > 1) pdf.addPage();

          // Toggle Visibility
          atoms.forEach(atom => {
            const assigned = parseInt(atom.dataset.pdfPage || '1');
            // Logic:
            // Show if assigned == p
            if (assigned === p) {
              atom.style.display = ''; // Restore default
              atom.style.visibility = 'visible';
            } else {
              atom.style.display = 'none';
            }
          });

          // Force reflow
          clone.offsetHeight;

          // Render
          const canvas = await html2canvas(clone, {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff' // White background
          });

          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

          // Add with 5mm margin top
          const MARGIN_MM = 5;
          pdf.addImage(imgData, 'PNG', 0, MARGIN_MM, pdfWidth, pdfHeight);

          // Optional: Add Page Number
          pdf.setFontSize(10);
          pdf.text(`Página ${p} de ${maxPage}`, pdfWidth - 10, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
        }

        pdf.save(filename);

      } finally {
        document.body.removeChild(clone);
      }

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
