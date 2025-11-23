import { useState, useRef, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useOrdenArchivos } from '../../hooks/useOrdenArchivos';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import dayjs from 'dayjs';

interface OrdenArchivosTabProps {
  ordenId: string;
  fechaEntrega?: string;
  estado: string;
  fechaCompletado?: string;
}

export function OrdenArchivosTab({
  ordenId,
  fechaEntrega,
  estado,
  fechaCompletado
}: OrdenArchivosTabProps) {
  const {
    archivos,
    loading,
    uploading,
    uploadProgress,
    error,
    totalSize,
    availableSpace,
    usagePercentage,
    maxTotalSize,
    uploadArchivo,
    downloadArchivo,
    deleteArchivo,
    downloadAll,
    formatSize
  } = useOrdenArchivos(ordenId);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { showConfirm } = useConfirmDialog();

  // Verificar si mostrar el warning la primera vez
  useEffect(() => {
    const warningDismissed = localStorage.getItem(`archivo_warning_dismissed_${ordenId}`);
    if (!warningDismissed && archivos.length === 0 && selectedFile) {
      setShowWarningModal(true);
    }
  }, [selectedFile, archivos.length, ordenId]);

  // Calcular fecha de eliminación
  const getFechaEliminacion = () => {
    if (fechaCompletado) {
      return dayjs(fechaCompletado).add(5, 'days');
    }
    if (fechaEntrega) {
      return dayjs(fechaEntrega).add(5, 'days');
    }
    return null;
  };

  const fechaEliminacion = getFechaEliminacion();
  const diasRestantes = fechaEliminacion ? fechaEliminacion.diff(dayjs(), 'days') : null;

  // Manejar drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setShowUploadModal(true);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setShowUploadModal(true);
    }
  };

  // Subir archivo
  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      await uploadArchivo({
        file: selectedFile,
        descripcion: descripcion.trim() || undefined
      });

      showToast('Archivo subido correctamente', 'success');
      setShowUploadModal(false);
      setSelectedFile(null);
      setDescripcion('');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Eliminar archivo
  const handleDelete = async (archivoId: string, nombreArchivo: string) => {
    const confirmed = await showConfirm(
      'Eliminar archivo',
      `¿Está seguro de eliminar "${nombreArchivo}"?`,
      'Eliminar'
    );

    if (confirmed) {
      try {
        await deleteArchivo(archivoId);
        showToast('Archivo eliminado correctamente', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  // Descargar archivo
  const handleDownload = async (archivoId: string) => {
    try {
      await downloadArchivo(archivoId);
      showToast('Descarga iniciada', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Descargar todos
  const handleDownloadAll = async () => {
    try {
      await downloadAll();
      showToast('Descargando todos los archivos...', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Color de la barra de progreso según uso
  const getProgressBarColor = () => {
    if (usagePercentage < 60) return 'bg-green-600';
    if (usagePercentage < 85) return 'bg-yellow-600';
    if (usagePercentage < 95) return 'bg-orange-600';
    return 'bg-red-600';
  };

  // Color de la advertencia según días restantes
  const getWarningColor = () => {
    if (!diasRestantes) return 'bg-yellow-50 border-yellow-300';
    if (diasRestantes <= 3) return 'bg-red-50 border-red-300';
    return 'bg-yellow-50 border-yellow-300';
  };

  const getWarningIcon = () => {
    if (!diasRestantes) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    if (diasRestantes <= 3) return <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Advertencia de Política de Almacenamiento */}
      <Card className={`border-2 ${getWarningColor()}`}>
        <div className="flex items-start gap-3">
          {getWarningIcon()}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              IMPORTANTE: Política de Almacenamiento
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                Los archivos adjuntos se eliminarán <strong>AUTOMÁTICAMENTE e IRREVERSIBLEMENTE</strong>{' '}
                5 días después de la fecha de entrega de esta orden.
              </p>

              {fechaEliminacion && (
                <div className="mt-2 space-y-1">
                  <p>
                    • Fecha de {fechaCompletado ? 'entrega' : 'entrega estimada'}:{' '}
                    <strong>{dayjs(fechaCompletado || fechaEntrega).format('DD/MM/YYYY')}</strong>
                  </p>
                  <p>
                    • Eliminación programada:{' '}
                    <strong className={diasRestantes && diasRestantes <= 3 ? 'text-red-600' : ''}>
                      {fechaEliminacion.format('DD/MM/YYYY')}
                      {diasRestantes !== null && ` (${diasRestantes} días restantes)`}
                    </strong>
                  </p>
                </div>
              )}

              {!fechaEntrega && !fechaCompletado && (
                <p className="mt-2">
                  • Los archivos se eliminarán 5 días después de marcar esta orden como completada
                </p>
              )}

              <p className="mt-2 font-medium">
                Le recomendamos descargar y guardar una copia de estos archivos en su equipo o sistema
                de respaldo antes de la fecha de eliminación.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Indicador de espacio usado */}
      <Card>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Espacio utilizado</span>
            <span className="font-semibold text-gray-900">
              {formatSize(totalSize)} / {formatSize(maxTotalSize)}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            Límite de almacenamiento: 1 GB por orden | Tamaño máximo por archivo: 500 MB
          </p>
        </div>
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || availableSpace <= 0}
        >
          <Upload className="w-4 h-4 mr-2" />
          Subir Archivo
        </Button>

        {archivos.length > 0 && (
          <Button
            variant="outline"
            onClick={handleDownloadAll}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Todos
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ai,.cdr,.eps,.psd,.svg,.indd,.jpg,.jpeg,.png,.tiff,.tif,.zip,.rar,.7z"
        />
      </div>

      {/* Zona de drag & drop */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50'
        } ${availableSpace <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => availableSpace > 0 && fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium mb-1">
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-sm text-gray-500">
          PDF, Word, Excel, archivos de diseño (AI, PSD, CDR, EPS), imágenes, archivos comprimidos
        </p>
        {availableSpace <= 0 && (
          <p className="text-sm text-red-600 mt-2">
            Has alcanzado el límite de almacenamiento
          </p>
        )}
      </div>

      {/* Lista de archivos */}
      {archivos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay archivos"
          description="Sube archivos del cliente para esta orden"
        />
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {archivos.map((archivo) => {
              const archivoReciente = dayjs().diff(dayjs(archivo.created_at), 'hours') < 24;

              return (
                <div key={archivo.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {archivo.nombre_archivo}
                        </h4>
                        {archivoReciente && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Nuevo
                          </span>
                        )}
                        {diasRestantes !== null && diasRestantes <= 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                            <Clock className="w-3 h-3 mr-1" />
                            Eliminar en {diasRestantes}d
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatSize(archivo.tamano_bytes)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {dayjs(archivo.created_at).format('DD/MM/YYYY HH:mm')}
                        </span>
                        {archivo.uploader?.full_name && (
                          <span className="text-xs text-gray-500">
                            Por: {archivo.uploader.full_name}
                          </span>
                        )}
                      </div>

                      {archivo.descripcion && (
                        <p className="text-xs text-gray-600 mt-1">{archivo.descripcion}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(archivo.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(archivo.id, archivo.nombre_archivo)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal de subida */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedFile(null);
          setDescripcion('');
        }}
        title="Subir Archivo"
      >
        <div className="space-y-4">
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatSize(selectedFile.size)}</p>
                </div>
              </div>
            </div>
          )}

          <Input
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Archivos enviados por el cliente"
          />

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subiendo...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setDescripcion('');
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Subiendo...' : 'Subir Archivo'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de advertencia primera vez */}
      <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Política de Almacenamiento de Archivos"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Antes de continuar, por favor lea lo siguiente:
          </p>

          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Los archivos adjuntos son temporales</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Se eliminarán automáticamente 5 días después de la entrega</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>La eliminación es irreversible y no se puede recuperar</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Es su responsabilidad guardar copias locales</span>
            </li>
          </ul>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ¿Desea continuar con la subida del archivo?
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="no-mostrar"
              className="rounded border-gray-300"
              onChange={(e) => {
                if (e.target.checked) {
                  localStorage.setItem(`archivo_warning_dismissed_${ordenId}`, 'true');
                }
              }}
            />
            <label htmlFor="no-mostrar" className="text-sm text-gray-700">
              No volver a mostrar este mensaje
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowWarningModal(false);
                setShowUploadModal(false);
                setSelectedFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setShowWarningModal(false);
              }}
            >
              Entiendo y acepto
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
