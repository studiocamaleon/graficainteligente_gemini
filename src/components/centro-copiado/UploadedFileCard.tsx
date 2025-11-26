import { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from '../ui/Button';

interface UploadedFileCardProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  paginasDetectadas?: number | null;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  itemGenerado?: boolean;
  onGenerarItem?: () => void;
  onDescargar?: () => void;
  onEliminar?: () => void;
}

function getFileIcon(type: string) {
  if (type === 'application/pdf') return FileText;
  if (type.startsWith('image/')) return FileImage;
  if (
    type.includes('spreadsheet') ||
    type.includes('excel')
  ) return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function UploadedFileCard({
  fileName,
  fileSize,
  fileType,
  paginasDetectadas,
  status,
  error,
  itemGenerado,
  onGenerarItem,
  onDescargar,
  onEliminar,
}: UploadedFileCardProps) {
  const [showActions, setShowActions] = useState(false);
  const FileIcon = getFileIcon(fileType);
  const isPDF = fileType === 'application/pdf';

  const getStatusDisplay = () => {
    switch (status) {
      case 'uploading':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Subiendo...</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Procesando PDF...</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">
              {itemGenerado ? 'Item generado' : 'Listo'}
            </span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
        );
    }
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <FileIcon className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {fileName}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-gray-500">
                  {formatFileSize(fileSize)}
                </p>
                {isPDF && paginasDetectadas !== null && paginasDetectadas !== undefined && (
                  <p className="text-xs font-medium text-blue-600">
                    {paginasDetectadas} {paginasDetectadas === 1 ? 'página' : 'páginas'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-shrink-0">
              {getStatusDisplay()}
            </div>
          </div>

          {error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              {error}
            </div>
          )}

          {status === 'completed' && showActions && (
            <div className="flex items-center gap-2 mt-3">
              {!itemGenerado && isPDF && paginasDetectadas && onGenerarItem && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onGenerarItem}
                >
                  <Plus className="w-3 h-3" />
                  Generar Item
                </Button>
              )}

              {!itemGenerado && !isPDF && onGenerarItem && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onGenerarItem}
                >
                  <Plus className="w-3 h-3" />
                  Crear Item
                </Button>
              )}

              {onDescargar && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onDescargar}
                >
                  <Download className="w-3 h-3" />
                </Button>
              )}

              {onEliminar && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onEliminar}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {itemGenerado && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
              Vinculado a item de la orden
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
