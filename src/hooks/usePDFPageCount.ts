import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function usePDFPageCount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectPages = async (file: File): Promise<number | null> => {
    // Solo procesar PDFs
    if (file.type !== 'application/pdf') {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Leer el archivo como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Cargar el documento PDF
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      // Obtener el número de páginas
      const pageCount = pdf.numPages;

      setLoading(false);
      return pageCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al detectar páginas del PDF';
      setError(errorMessage);
      setLoading(false);
      console.error('Error detecting PDF pages:', err);
      return null;
    }
  };

  return {
    detectPages,
    loading,
    error,
  };
}
