import { useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

// Configurar el worker usando la ruta del paquete
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export function usePDFPageCount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectPages = async (file: File): Promise<number | null> => {
    if (file.type !== 'application/pdf') {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const pageCount = pdf.numPages;

      setLoading(false);
      return pageCount;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al detectar páginas del PDF';
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
