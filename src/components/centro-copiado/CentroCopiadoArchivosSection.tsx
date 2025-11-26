import { useState, useEffect } from 'react';
import { FileText, AlertCircle, CheckSquare, ListChecks } from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { UploadedFileCard } from './UploadedFileCard';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useCentroCopiadoArchivos } from '../../hooks/useCentroCopiadoArchivos';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

interface FileWithMetadata {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  archivoId?: string;
  error?: string;
  selected?: boolean;
  itemGenerado?: boolean;
}

interface CentroCopiadoArchivosSectionProps {
  ordenId?: string;
  ordenTemporalId?: string;
  onArchivoGenerado?: (archivoId: string, nombreArchivo: string) => void;
  disabled?: boolean;
}

export function CentroCopiadoArchivosSection({
  ordenId,
  ordenTemporalId,
  onArchivoGenerado,
  disabled = false,
}: CentroCopiadoArchivosSectionProps) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const { uploadFile, downloadFile, deleteFile } = useFileUpload();
  const { createArchivo, deleteArchivo, espacioUsado, refetch } = useCentroCopiadoArchivos({ ordenId, ordenTemporalId });
  const modoTemporal = !!ordenTemporalId && !ordenId;

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (ordenId) {
      refetch();
    }
  }, [ordenId, refetch]);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    const newFiles: FileWithMetadata[] = selectedFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Procesar cada archivo
    for (const fileMetadata of newFiles) {
      await processFile(fileMetadata);
    }
  };

  const processFile = async (fileMetadata: FileWithMetadata) => {
    if (!profile?.company_id || (!ordenId && !ordenTemporalId)) return;

    setIsProcessing(true);

    try {
      // 1. Subir archivo a Storage
      setFiles(prev =>
        prev.map(f =>
          f.id === fileMetadata.id ? { ...f, status: 'uploading' as const } : f
        )
      );

      const targetId = modoTemporal ? ordenTemporalId! : ordenId!;
      const uploadResult = await uploadFile(
        fileMetadata.file,
        profile.company_id,
        targetId,
        fileMetadata.id
      );

      if (!uploadResult) {
        throw new Error('Error al subir archivo');
      }

      // 2. Crear registro en base de datos (sin páginas detectadas)
      const archivo = await createArchivo({
        [modoTemporal ? 'orden_temporal_id' : 'orden_copiado_id']: targetId,
        nombre_archivo: fileMetadata.file.name,
        nombre_storage: uploadResult.nombreStorage,
        tipo_mime: fileMetadata.file.type,
        tamano_bytes: fileMetadata.file.size,
        storage_path: uploadResult.storagePath,
        paginas_detectadas: null,
      });

      if (!archivo) {
        throw new Error('Error al guardar archivo en base de datos');
      }

      // 3. Actualizar estado
      setFiles(prev =>
        prev.map(f =>
          f.id === fileMetadata.id
            ? {
                ...f,
                status: 'completed' as const,
                archivoId: archivo.id,
              }
            : f
        )
      );

      // Archivo subido correctamente - NO crear item automáticamente
    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al procesar archivo';

      setFiles(prev =>
        prev.map(f =>
          f.id === fileMetadata.id
            ? { ...f, status: 'error' as const, error: errorMessage }
            : f
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSelection = (fileId: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId ? { ...f, selected: !f.selected } : f
      )
    );
  };


  const handleGenerarItemsSeleccionados = () => {
    const archivosSeleccionados = files.filter(f => f.selected && f.status === 'completed' && !f.itemGenerado);

    archivosSeleccionados.forEach(file => {
      if (file.archivoId && onArchivoGenerado) {
        onArchivoGenerado(file.archivoId, file.file.name);
      }
    });

    setFiles(prev =>
      prev.map(f =>
        f.selected && f.status === 'completed' ? { ...f, itemGenerado: true, selected: false } : f
      )
    );
  };

  const handleGenerarItemsTodos = () => {
    const archivosSinItem = files.filter(f => f.status === 'completed' && !f.itemGenerado);

    archivosSinItem.forEach(file => {
      if (file.archivoId && onArchivoGenerado) {
        onArchivoGenerado(file.archivoId, file.file.name);
      }
    });

    setFiles(prev =>
      prev.map(f =>
        f.status === 'completed' ? { ...f, itemGenerado: true, selected: false } : f
      )
    );
  };

  const handleDescargar = async (fileMetadata: FileWithMetadata) => {
    if (!fileMetadata.archivoId) return;

    const archivo = (await refetch()).archivos?.find(a => a.id === fileMetadata.archivoId);
    if (!archivo) return;

    await downloadFile(archivo.storage_path, archivo.nombre_archivo);
  };

  const handleEliminar = async (fileMetadata: FileWithMetadata) => {
    if (!fileMetadata.archivoId) return;

    const archivo = (await refetch()).archivos?.find(a => a.id === fileMetadata.archivoId);
    if (!archivo) return;

    const confirmacion = window.confirm(
      `¿Estás seguro de eliminar el archivo "${archivo.nombre_archivo}"?`
    );

    if (!confirmacion) return;

    // Eliminar del storage
    await deleteFile(archivo.storage_path);

    // Eliminar de la base de datos
    const success = await deleteArchivo(archivo.id);

    if (success) {
      setFiles(prev => prev.filter(f => f.id !== fileMetadata.id));
    }
  };

  const espacioDisponibleMB = espacioUsado
    ? espacioUsado.espacio_disponible_mb
    : 200;

  const porcentajeUsado = espacioUsado ? espacioUsado.porcentaje_usado : 0;

  const archivosCompletados = files.filter(f => f.status === 'completed');
  const archivosSinItem = archivosCompletados.filter(f => !f.itemGenerado);
  const archivosSeleccionados = archivosSinItem.filter(f => f.selected);
  const haySeleccionados = archivosSeleccionados.length > 0;
  const hayArchivosSinItem = archivosSinItem.length > 0;

  return (
    <Card>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-bold text-gray-900">Archivos para Imprimir</h3>
          </div>

          {espacioUsado && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">{espacioUsado.espacio_usado_mb.toFixed(2)} MB</span>
              {' / '}
              <span>{(espacioUsado.limite_total_bytes / 1048576).toFixed(0)} MB</span>
            </div>
          )}
        </div>

        {espacioUsado && espacioUsado.espacio_usado_mb > 0 && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  porcentajeUsado >= 90
                    ? 'bg-red-600'
                    : porcentajeUsado >= 70
                    ? 'bg-yellow-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">
              {porcentajeUsado.toFixed(1)}% usado
            </p>
          </div>
        )}

        {porcentajeUsado >= 100 && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Límite de almacenamiento alcanzado</p>
              <p className="mt-1">Elimina archivos para poder subir más.</p>
            </div>
          </div>
        )}

        {!disabled && porcentajeUsado < 100 && (
          <FileUploadZone
            onFilesSelected={handleFilesSelected}
            disabled={disabled || isProcessing}
            espacioDisponibleMB={espacioDisponibleMB}
          />
        )}

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">
                Archivos cargados ({archivosCompletados.length})
              </h4>
              {hayArchivosSinItem && (
                <div className="flex items-center gap-2">
                  {haySeleccionados && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleGenerarItemsSeleccionados}
                    >
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Generar Items Seleccionados ({archivosSeleccionados.length})
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerarItemsTodos}
                  >
                    <ListChecks className="w-4 h-4 mr-1" />
                    Generar Items para Todos ({archivosSinItem.length})
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {files.map(fileMetadata => (
                <UploadedFileCard
                  key={fileMetadata.id}
                  fileName={fileMetadata.file.name}
                  fileSize={fileMetadata.file.size}
                  fileType={fileMetadata.file.type}
                  status={fileMetadata.status}
                  error={fileMetadata.error}
                  itemGenerado={fileMetadata.itemGenerado}
                  selected={fileMetadata.selected}
                  onToggleSelection={() => handleToggleSelection(fileMetadata.id)}
                  onDescargar={() => handleDescargar(fileMetadata)}
                  onEliminar={() => handleEliminar(fileMetadata)}
                />
              ))}
            </div>
          </div>
        )}

        {files.length === 0 && !disabled && (
          <p className="text-sm text-gray-500 text-center py-4">
            No hay archivos cargados aún. Arrastra archivos arriba para comenzar.
          </p>
        )}
      </div>
    </Card>
  );
}
