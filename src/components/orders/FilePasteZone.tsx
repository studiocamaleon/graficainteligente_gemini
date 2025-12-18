import { useCallback, useState, useEffect } from 'react';
import { Upload, AlertCircle, Clipboard, Loader2 } from 'lucide-react';

interface FilePasteZoneProps {
    onFilesSelected: (files: File[]) => void;
    accept?: string;
    maxSize?: number;
    disabled?: boolean;
    isLoading?: boolean;
}

const ACCEPTED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
];

const MAX_FILE_SIZE = 209715200; // 200 MB

export function FilePasteZone({
    onFilesSelected,
    accept = ACCEPTED_TYPES.join(','),
    maxSize = MAX_FILE_SIZE,
    disabled = false,
    isLoading = false,
}: FilePasteZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFile = (file: File): string | null => {
        if (file.size > maxSize) {
            return `El archivo "${file.name}" excede el tamaño máximo de 200 MB`;
        }

        // Si no es imagen pero permitimos otros tipos, validar contra la lista
        if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
            return `El tipo de archivo "${file.name}" no está permitido`;
        }

        return null;
    };

    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            if (!files || (files instanceof FileList ? files.length === 0 : files.length === 0)) return;

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
        [onFilesSelected, maxSize]
    );

    // Manejar pegado de portapapeles
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled || isLoading) return;

            console.log('[FilePasteZone] Evento paste detectado');
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            const filesToProcess: File[] = [];

            // 1. Revisar items
            if (clipboardData.items) {
                for (let i = 0; i < clipboardData.items.length; i++) {
                    const item = clipboardData.items[i];
                    console.log(`[FilePasteZone] Item ${i}: kind=${item.kind}, type=${item.type}`);

                    if (item.kind === 'file') {
                        const blob = item.getAsFile();
                        if (blob) {
                            const fileName = blob.name && blob.name !== 'image.png'
                                ? blob.name
                                : `captura-${new Date().getTime()}.png`;
                            filesToProcess.push(new File([blob], fileName, { type: blob.type }));
                        }
                    }
                }
            }

            // 2. Fallback a .files
            if (filesToProcess.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
                console.log('[FilePasteZone] Usando clipboardData.files');
                Array.from(clipboardData.files).forEach(file => {
                    filesToProcess.push(file);
                });
            }

            if (filesToProcess.length > 0) {
                e.preventDefault();
                console.log('[FilePasteZone] Procesando:', filesToProcess.map(f => f.name));
                handleFiles(filesToProcess);
            } else {
                console.log('[FilePasteZone] No se encontraron archivos binarios. Nota: En Mac, copiar un archivo desde Finder suele no exponer el binario al navegador por seguridad. Prueba con una captura de pantalla o arrastrando el archivo.');
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled, handleFiles, isLoading]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && !isLoading) {
            setIsDragging(true);
        }
    }, [disabled, isLoading]);

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

            if (disabled || isLoading) return;

            handleFiles(e.dataTransfer.files);
        },
        [disabled, handleFiles, isLoading]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) {
                handleFiles(e.target.files);
            }
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
          ${isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 hover:border-slate-400'
                    }
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isLoading ? 'bg-slate-50' : ''}
        `}
            >
                {!isLoading && (
                    <input
                        type="file"
                        multiple
                        accept={accept}
                        onChange={handleFileInput}
                        disabled={disabled}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                )}

                <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <div
                        className={`
              p-4 rounded-full
              ${isDragging || isLoading ? 'bg-blue-100' : 'bg-slate-100'}
            `}
                    >
                        {isLoading ? (
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        ) : (
                            <Upload
                                className={`
                    w-8 h-8
                    ${isDragging ? 'text-blue-600' : 'text-slate-600'}
                  `}
                            />
                        )}
                    </div>

                    <div>
                        <p className="text-sm font-medium text-slate-900">
                            {isLoading
                                ? 'Subiendo archivos...'
                                : (isDragging ? 'Suelta los archivos aquí' : 'Arrastra o haz click para subir')}
                        </p>
                        {!isLoading && (
                            <>
                                <p className="text-[11px] text-blue-600 mt-1 flex items-center justify-center gap-1 font-semibold bg-blue-50 py-1 px-3 rounded-full">
                                    <Clipboard className="w-3 h-3" />
                                    ¡También puedes pegar (Ctrl+V) una captura de pantalla!
                                </p>
                                <p className="text-xs text-slate-500 mt-2">
                                    PDF, JPG, WebP o PNG (máx. 200 MB por archivo)
                                </p>
                            </>
                        )}
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
