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
} from 'lucide-react';
import { Button } from '../ui/Button';

interface UploadedFileCardProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  itemGenerado?: boolean;
  selected?: boolean;
  onToggleSelection?: () => void;
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
  status,
  error,
  itemGenerado,
  selected,
  onToggleSelection,
  onDescargar,
  onEliminar,
}: UploadedFileCardProps) {
  const [showActions, setShowActions] = useState(false);
  const FileIcon = getFileIcon(fileType);

  const getStatusDisplay = () => {
    switch (status) {
      case 'uploading':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Subiendo...</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">
              {itemGenerado ? 'Item creado' : 'Listo'}
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
      className={`bg-white border rounded-lg p-4 transition-all ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:shadow-md'
      } ${itemGenerado ? 'opacity-60' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {status === 'completed' && !itemGenerado && onToggleSelection && (
          <div className="flex-shrink-0 pt-1">
            <input
              type="checkbox"
              checked={selected || false}
              onChange={onToggleSelection}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}

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
              {onDescargar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDescargar}
                  title="Descargar archivo"
                >
                  <Download className="w-3 h-3" />
                </Button>
              )}

              {onEliminar && !itemGenerado && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEliminar}
                  title="Eliminar archivo"
                >
                  <Trash2 className="w-3 h-3 text-red-600" />
                </Button>
              )}
            </div>
          )}

          {itemGenerado && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
              Item ya generado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
