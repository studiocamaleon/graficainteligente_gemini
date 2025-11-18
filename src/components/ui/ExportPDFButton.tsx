import { useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { Button } from './Button';

interface ExportPDFButtonProps {
  onExport: () => Promise<void> | void;
  label?: string;
  disabled?: boolean;
  showPrintOption?: boolean;
}

export function ExportPDFButton({
  onExport,
  label = 'Descargar PDF',
  disabled = false,
  showPrintOption = false,
}: ExportPDFButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await onExport();
    } catch (error) {
      console.error('Error al exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleExport}
        disabled={disabled || isExporting}
        variant="primary"
        className="flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generando...
          </>
        ) : (
          <>
            {showPrintOption ? <Printer className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {label}
          </>
        )}
      </Button>
    </div>
  );
}
