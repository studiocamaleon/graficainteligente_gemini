import { useCallback, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  espacioDisponibleMB?: number;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif',
];

const MAX_FILE_SIZE = 209715200; // 200 MB

export function FileUploadZone({
  onFilesSelected,
  accept = ACCEPTED_TYPES.join(','),
  maxSize = MAX_FILE_SIZE,
  disabled = false,
  espacioDisponibleMB = 200,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    // Validar tamaño
    if (file.size > maxSize) {
      return `El archivo "${file.name}" excede el tamaño máximo de 200 MB`;
    }

    // Validar tipo
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `El tipo de archivo "${file.name}" no está permitido`;
    }

    // Validar espacio disponible
    const fileSizeMB = file.size / 1048576;
    if (fileSizeMB > espacioDisponibleMB) {
      return `No hay suficiente espacio disponible. Espacio restante: ${espacioDisponibleMB.toFixed(2)} MB`;
    }

    return null;
  };

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      const validFiles: File[] = [];
      const errors: string[] = [];

      Array.from(files).forEach(file => {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(validationError);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        setError(errors.join('. '));
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [onFilesSelected, maxSize, espacioDisponibleMB]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-all duration-200
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div
            className={`
              p-4 rounded-full
              ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}
            `}
          >
            <Upload
              className={`
                w-8 h-8
                ${isDragging ? 'text-blue-600' : 'text-gray-600'}
              `}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900">
              {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí o haz click para seleccionar'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, DOCX, XLSX, JPG, PNG (máx. 200 MB por archivo)
            </p>
          </div>

          <div className="text-xs text-gray-500">
            <p>
              Espacio disponible: <span className="font-medium text-gray-700">{espacioDisponibleMB.toFixed(2)} MB</span>
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
