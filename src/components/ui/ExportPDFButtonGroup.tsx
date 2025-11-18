import { Printer, Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { useState, useRef, useEffect } from 'react';

interface ExportPDFButtonGroupProps {
  onPrint: () => void;
  onDownload: () => Promise<void> | void;
  isGenerating?: boolean;
  disabled?: boolean;
  label?: string;
}

export function ExportPDFButtonGroup({
  onPrint,
  onDownload,
  isGenerating = false,
  disabled = false,
  label = 'Exportar PDF',
}: ExportPDFButtonGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await onDownload();
      setIsOpen(false);
    } catch (error) {
      console.error('Error al descargar PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    onPrint();
    setIsOpen(false);
  };

  const isLoading = isGenerating || isDownloading;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div className="flex">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          variant="primary"
          className="flex items-center gap-2 rounded-r-none border-r border-blue-500"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {label}
            </>
          )}
        </Button>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          variant="primary"
          className="px-2 rounded-l-none"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <div>
              <div className="font-medium">Descargar PDF</div>
              <div className="text-xs text-gray-500">Guardar en tu dispositivo</div>
            </div>
          </button>

          <button
            onClick={handlePrint}
            disabled={isLoading}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            <div>
              <div className="font-medium">Imprimir / Ver</div>
              <div className="text-xs text-gray-500">Abrir vista previa</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
