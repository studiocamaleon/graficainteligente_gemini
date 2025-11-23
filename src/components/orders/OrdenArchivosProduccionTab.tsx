import { useState, useRef } from 'react';
import { Upload, Download, Trash2, Settings, AlertTriangle, CheckCircle2, Clock, History } from 'lucide-react';
import { useOrdenArchivosProduccion } from '../../hooks/useOrdenArchivosProduccion';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { MultiSelect } from '../ui/MultiSelect';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import dayjs from 'dayjs';

interface OrdenArchivosProduccionTabProps {
  ordenId: string;
  fechaEntrega?: string;
  estado: string;
  fechaCompletado?: string;
}

const ETIQUETAS_DISPONIBLES = [
  { value: 'final', label: 'Final' },
  { value: 'revision', label: 'Revisión' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'backup', label: 'Backup' },
  { value: 'prueba', label: 'Prueba' }
];

export function OrdenArchivosProduccionTab({
  ordenId,
  fechaEntrega,
  estado,
  fechaCompletado
}: OrdenArchivosProduccionTabProps) {
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
    canUpload,
    uploadArchivo,
    downloadArchivo,
    deleteArchivo,
    downloadAll,
    getVersionHistory,
    formatSize,
    getEtiquetaColor
  } = useOrdenArchivosProduccion(ordenId);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    etiquetas: [] as string[],
    notas: '',
    reemplaza_a: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { showConfirm } = useConfirmDialog();

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

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      etiquetas: [],
      notas: '',
      reemplaza_a: ''
    });
    setSelectedFile(null);
  };

  // Manejar drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canUpload) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!canUpload) {
      showToast('No tiene permisos para subir archivos de producción', 'error');
      return;
    }

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
        etiquetas: formData.etiquetas.length > 0 ? formData.etiquetas : undefined,
        notas: formData.notas.trim() || undefined,
        reemplaza_a: formData.reemplaza_a || undefined
      });

      showToast('Archivo de producción subido correctamente', 'success');
      setShowUploadModal(false);
      resetForm();

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

  // Ver historial de versiones
  const handleViewHistory = (archivoId: string) => {
    setShowVersionHistory(archivoId);
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
      {/* Card informativo */}
      <Card className="border-2 bg-blue-50 border-blue-300">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              Archivos de Producción
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                Este espacio es para subir archivos procesados y listos para producción.
                Solo el personal autorizado puede subir archivos aquí.
              </p>
              <p className="text-xs text-gray-600 mt-2">
                <strong>Ejemplos:</strong> PDFs listos para imprenta, archivos con marcas de corte,
                archivos calibrados, diseños aprobados por el cliente.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Advertencia de Política de Eliminación */}
      <Card className={`border-2 ${getWarningColor()}`}>
        <div className="flex items-start gap-3">
          {getWarningIcon()}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">
              IMPORTANTE: Política de Almacenamiento
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                Los archivos de producción se eliminarán <strong>AUTOMÁTICAMENTE e IRREVERSIBLEMENTE</strong>{' '}
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
            </div>
          </div>
        </div>
      </Card>

      {/* Indicador de espacio usado */}
      <Card>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Espacio utilizado (Producción)</span>
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
            Límite de almacenamiento: 1 GB por orden (separado de archivos de cliente)
          </p>
        </div>
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-3">
        {canUpload ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || availableSpace <= 0}
          >
            <Upload className="w-4 h-4 mr-2" />
            Subir Archivo de Producción
          </Button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
            Solo personal autorizado puede subir archivos de producción
          </div>
        )}

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
          accept=".pdf,.ai,.eps,.psd,.cdr,.svg,.tiff,.tif,.plt,.dxf,.indd,.zip,.rar"
        />
      </div>

      {/* Zona de drag & drop */}
      {canUpload && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-green-500 bg-green-50'
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
            PDF, AI, EPS, PSD, CDR, SVG, TIFF, PLT, DXF, INDD
          </p>
          {availableSpace <= 0 && (
            <p className="text-sm text-red-600 mt-2">
              Has alcanzado el límite de almacenamiento
            </p>
          )}
        </div>
      )}

      {/* Lista de archivos */}
      {archivos.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="No hay archivos de producción"
          description={
            canUpload
              ? "Sube archivos procesados y listos para producción"
              : "Los archivos de producción aparecerán aquí"
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {archivos.map((archivo) => {
              const archivoReciente = dayjs().diff(dayjs(archivo.created_at), 'hours') < 24;
              const tieneVersiones = archivos.some(a => a.reemplaza_a === archivo.id);

              return (
                <div key={archivo.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Settings className="w-6 h-6 text-green-600" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {archivo.nombre_archivo}
                        </h4>
                        {archivo.version > 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            v{archivo.version}
                          </span>
                        )}
                        {archivoReciente && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Nuevo
                          </span>
                        )}
                        {archivo.etiquetas?.map((etiqueta) => (
                          <span
                            key={etiqueta}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getEtiquetaColor(etiqueta)}`}
                          >
                            {etiqueta.toUpperCase()}
                          </span>
                        ))}
                        {diasRestantes !== null && diasRestantes <= 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                            <Clock className="w-3 h-3 mr-1" />
                            Eliminar en {diasRestantes}d
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 flex-wrap">
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
                        {tieneVersiones && (
                          <button
                            onClick={() => handleViewHistory(archivo.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <History className="w-3 h-3" />
                            Ver historial
                          </button>
                        )}
                      </div>

                      {archivo.notas && (
                        <p className="text-xs text-gray-600 mt-2 italic">
                          Notas: {archivo.notas}
                        </p>
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
          resetForm();
        }}
        title="Subir Archivo de Producción"
      >
        <div className="space-y-4">
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatSize(selectedFile.size)}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Etiquetas (opcional)
            </label>
            <MultiSelect
              options={ETIQUETAS_DISPONIBLES}
              value={formData.etiquetas}
              onChange={(etiquetas) => setFormData({ ...formData, etiquetas })}
              placeholder="Seleccionar etiquetas..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Usa etiquetas para organizar y identificar rápidamente los archivos
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Reemplaza archivo anterior? (opcional)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.reemplaza_a}
              onChange={(e) => setFormData({ ...formData, reemplaza_a: e.target.value })}
            >
              <option value="">No reemplaza ningún archivo</option>
              {archivos.map((archivo) => (
                <option key={archivo.id} value={archivo.id}>
                  {archivo.nombre_archivo} (v{archivo.version})
                </option>
              ))}
            </select>
            {formData.reemplaza_a && (
              <p className="text-xs text-blue-600 mt-1">
                Se creará como versión nueva del archivo seleccionado
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (opcional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Ej: Ajustes de color aplicados, márgenes corregidos..."
            />
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subiendo...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-300"
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
                resetForm();
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

      {/* Modal de historial de versiones */}
      <Modal
        isOpen={showVersionHistory !== null}
        onClose={() => setShowVersionHistory(null)}
        title="Historial de Versiones"
      >
        <div className="space-y-3">
          {showVersionHistory && getVersionHistory(showVersionHistory).map((archivo, index) => (
            <div
              key={archivo.id}
              className={`p-4 rounded-lg border-2 ${
                index === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    Versión {archivo.version}
                  </span>
                  {index === 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Actual
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {formatSize(archivo.tamano_bytes)}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-2">{archivo.nombre_archivo}</p>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                <span>{dayjs(archivo.created_at).format('DD/MM/YYYY HH:mm')}</span>
                {archivo.uploader?.full_name && (
                  <span>Por: {archivo.uploader.full_name}</span>
                )}
              </div>

              {archivo.etiquetas && archivo.etiquetas.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {archivo.etiquetas.map((etiqueta) => (
                    <span
                      key={etiqueta}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getEtiquetaColor(etiqueta)}`}
                    >
                      {etiqueta}
                    </span>
                  ))}
                </div>
              )}

              {archivo.notas && (
                <p className="text-xs text-gray-600 italic mb-2">
                  Notas: {archivo.notas}
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(archivo.id)}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar esta versión
              </Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
