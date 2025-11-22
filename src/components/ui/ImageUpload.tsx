import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  isUploading?: boolean;
  isDeleting?: boolean;
  disabled?: boolean;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  label?: string;
  helperText?: string;
}

export function ImageUpload({
  currentImageUrl,
  onUpload,
  onDelete,
  isUploading = false,
  isDeleting = false,
  disabled = false,
  maxSizeMB = 2,
  acceptedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon'],
  label = 'Logo de la Empresa',
  helperText = `Arrastra y suelta una imagen aquí, o haz click para seleccionar. Máximo ${maxSizeMB}MB.`,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = isUploading || isDeleting;

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Formato no permitido. Solo se aceptan: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      return `El archivo es demasiado grande. El tamaño máximo es ${maxSizeMB}MB.`;
    }

    return null;
  };

  const handleFileSelect = async (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen');
      setPreviewUrl(null);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isLoading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      setError(null);
      setPreviewUrl(null);
      try {
        await onDelete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar la imagen');
      }
    }
  };

  const handleClick = () => {
    if (!disabled && !isLoading) {
      fileInputRef.current?.click();
    }
  };

  const displayImage = previewUrl || currentImageUrl;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="flex items-start gap-4">
        <motion.div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
          className={`
            relative flex-1 border-2 border-dashed rounded-lg transition-all cursor-pointer
            ${isDragging && !disabled && !isLoading
              ? 'border-blue-500 bg-blue-50'
              : displayImage
                ? 'border-gray-200 bg-gray-50'
                : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
            }
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleFileInputChange}
            disabled={disabled || isLoading}
            className="hidden"
          />

          {displayImage ? (
            <div className="relative w-full h-48 flex items-center justify-center p-4">
              <img
                src={displayImage}
                alt="Preview"
                className="max-h-full max-w-full object-contain rounded"
              />
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full p-8 flex flex-col items-center justify-center text-center">
              {isLoading ? (
                <>
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3" />
                  <p className="text-sm text-gray-600">
                    {isUploading ? 'Subiendo imagen...' : 'Eliminando imagen...'}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Subir imagen
                  </p>
                  <p className="text-xs text-gray-500">
                    {helperText}
                  </p>
                </>
              )}
            </div>
          )}
        </motion.div>

        {displayImage && onDelete && (
          <div className="flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={disabled || isLoading}
              className="h-48"
            >
              <div className="flex flex-col items-center gap-2">
                <X className="w-5 h-5" />
                <span className="text-xs">Eliminar</span>
              </div>
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-red-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {helperText && !error && (
        <p className="text-xs text-gray-500">
          Formatos aceptados: {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}
        </p>
      )}
    </div>
  );
}
