import { useState, useRef, useEffect } from 'react';
import {
  Upload, Download, Trash2, FileText, Link as LinkIcon, Settings,
  AlertTriangle, Clock, Plus, ExternalLink, Copy, Edit2, CheckCircle2,
  History, Filter, Loader, X
} from 'lucide-react';
import { useOrdenArchivos } from '../../hooks/useOrdenArchivos';
import { useOrdenLinks } from '../../hooks/useOrdenLinks';
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

interface OrdenAdjuntosTabProps {
  ordenId?: string;
  ordenTemporalId?: string;
  fechaEntregaReal?: string;
  estado: string;
  modoCreacion?: boolean;
}

type FiltroTipo = 'todos' | 'archivos_cliente' | 'archivos_produccion' | 'links';

const ETIQUETAS_DISPONIBLES = [
  { value: 'final', label: 'Final' },
  { value: 'revision', label: 'Revisión' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'backup', label: 'Backup' },
  { value: 'prueba', label: 'Prueba' }
];

export function OrdenAdjuntosTab({
  ordenId,
  ordenTemporalId,
  fechaEntregaReal,
  estado,
  modoCreacion = false
}: OrdenAdjuntosTabProps) {
  console.log('[OrdenAdjuntosTab] Props recibidos:', { ordenId, ordenTemporalId, modoCreacion, estado });

  const archivos = useOrdenArchivos({ ordenId, ordenTemporalId });
  const links = useOrdenLinks({ ordenId, ordenTemporalId });
  // En modo creación, no cargar archivos de producción (no tiene sentido sin orden real)
  const archivosProduccion = useOrdenArchivosProduccion(ordenId || '');

  console.log('[OrdenAdjuntosTab] Estados de carga:', {
    archivosLoading: archivos.loading,
    linksLoading: links.loading,
    archivosProduccionLoading: archivosProduccion.loading,
    modoCreacion
  });

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [showUploadArchivo, setShowUploadArchivo] = useState(false);
  const [showUploadProduccion, setShowUploadProduccion] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showEditLink, setShowEditLink] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recentlyUploadedId, setRecentlyUploadedId] = useState<string | null>(null);
  const [mostrarAdvertenciaViejos, setMostrarAdvertenciaViejos] = useState(false);
  const [archivoForm, setArchivoForm] = useState({ descripcion: '' });
  const [produccionForm, setProduccionForm] = useState({
    etiquetas: [] as string[],
    notas: '',
    reemplaza_a: ''
  });
  const [linkForm, setLinkForm] = useState({ titulo: '', url: '', descripcion: '' });
  const [editingLink, setEditingLink] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileProduccionInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { showConfirm } = useConfirmDialog();

  // Calcular fecha de eliminación usando fecha_entrega_real
  const getFechaEliminacion = () => {
    if (fechaEntregaReal && estado === 'entregada') {
      return dayjs(fechaEntregaReal).add(5, 'days');
    }
    return null;
  };

  const fechaEliminacion = getFechaEliminacion();
  const diasRestantes = fechaEliminacion ? fechaEliminacion.diff(dayjs(), 'days') : null;

  // Detectar archivos temporales antiguos en modo creación
  useEffect(() => {
    if (modoCreacion && (archivos.archivos.length > 0 || links.links.length > 0)) {
      // Verificar si hay archivos más viejos de 1 hora
      const tieneArchivosAntiguos = archivos.archivos.some(archivo => {
        const horasDesdeCreacion = dayjs().diff(dayjs(archivo.created_at), 'hours');
        return horasDesdeCreacion > 1;
      }) || links.links.some(link => {
        const horasDesdeCreacion = dayjs().diff(dayjs(link.created_at), 'hours');
        return horasDesdeCreacion > 1;
      });

      if (tieneArchivosAntiguos) {
        setMostrarAdvertenciaViejos(true);
      }
    }
  }, [modoCreacion, archivos.archivos, links.links]);

  // Consolidar todos los adjuntos en una lista única
  const todosAdjuntos = [
    ...archivos.archivos.map(a => ({
      ...a,
      tipo: 'archivo_cliente' as const,
      fecha: a.created_at,
      usuario: a.uploader?.full_name
    })),
    ...archivosProduccion.archivos.map(a => ({
      ...a,
      tipo: 'archivo_produccion' as const,
      fecha: a.created_at,
      usuario: a.uploader?.full_name
    })),
    ...links.links.map(l => ({
      ...l,
      tipo: 'link' as const,
      fecha: l.created_at,
      usuario: l.creator?.full_name
    }))
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  // Filtrar adjuntos
  const adjuntosFiltrados = todosAdjuntos.filter(adj => {
    if (filtroTipo === 'todos') return true;
    return adj.tipo === filtroTipo;
  });

  // Helper para limpiar nombre de archivo y sugerir descripción
  const generarNombreDescriptivo = (fileName: string): string => {
    const nombreSinExtension = fileName.replace(/\.[^/.]+$/, '');
    const nombreLimpio = nombreSinExtension
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    return nombreLimpio;
  };

  // Handler para selección de archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar archivo antes de aceptarlo
    const validacion = archivos.validateFile(file);
    if (!validacion.isValid) {
      showError(validacion.error || 'Archivo no válido');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);

    // Generar preview para imágenes
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    // Auto-sugerir descripción basada en nombre de archivo
    if (!archivoForm.descripcion) {
      const nombreSugerido = generarNombreDescriptivo(file.name);
      setArchivoForm({ descripcion: nombreSugerido });
    }
  };

  // Handler para selección de archivo de producción
  const handleFileProduccionSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validacion = archivosProduccion.validateFile(file);
    if (!validacion.isValid) {
      showError(validacion.error || 'Archivo no válido');
      if (fileProduccionInputRef.current) fileProduccionInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Limpiar archivo seleccionado
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileProduccionInputRef.current) fileProduccionInputRef.current.value = '';
  };

  // Handlers para archivos de cliente
  const handleUploadArchivo = async () => {
    if (!selectedFile) {
      showWarning('Por favor selecciona un archivo');
      return;
    }

    try {
      const nuevoArchivo = await archivos.uploadArchivo({
        file: selectedFile,
        descripcion: archivoForm.descripcion || undefined
      });

      showSuccess('Archivo subido correctamente');

      // Marcar como recién subido para highlight
      if (nuevoArchivo?.id) {
        setRecentlyUploadedId(nuevoArchivo.id);
        setTimeout(() => setRecentlyUploadedId(null), 3000);
      }

      // Cerrar modal y limpiar
      setShowUploadArchivo(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setArchivoForm({ descripcion: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      let errorMessage = 'Error al subir archivo';

      if (err.message?.includes('size')) {
        errorMessage = 'El archivo es demasiado grande';
      } else if (err.message?.includes('storage') || err.message?.includes('espacio')) {
        errorMessage = 'No hay espacio suficiente';
      } else if (err.message) {
        errorMessage = err.message;
      }

      showError(errorMessage);
    }
  };

  // Handlers para archivos de producción
  const handleUploadProduccion = async () => {
    if (!selectedFile) {
      showWarning('Por favor selecciona un archivo');
      return;
    }

    try {
      const nuevoArchivo = await archivosProduccion.uploadArchivo({
        file: selectedFile,
        etiquetas: produccionForm.etiquetas.length > 0 ? produccionForm.etiquetas : undefined,
        notas: produccionForm.notas || undefined,
        reemplaza_a: produccionForm.reemplaza_a || undefined
      });

      showSuccess('Archivo de producción subido correctamente');

      // Marcar como recién subido
      if (nuevoArchivo?.id) {
        setRecentlyUploadedId(nuevoArchivo.id);
        setTimeout(() => setRecentlyUploadedId(null), 3000);
      }

      // Cerrar modal y limpiar
      setShowUploadProduccion(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setProduccionForm({ etiquetas: [], notas: '', reemplaza_a: '' });
      if (fileProduccionInputRef.current) fileProduccionInputRef.current.value = '';
    } catch (err: any) {
      let errorMessage = 'Error al subir archivo de producción';

      if (err.message?.includes('size')) {
        errorMessage = 'El archivo es demasiado grande';
      } else if (err.message?.includes('storage') || err.message?.includes('espacio')) {
        errorMessage = 'No hay espacio suficiente';
      } else if (err.message) {
        errorMessage = err.message;
      }

      showError(errorMessage);
    }
  };

  // Handlers para links
  const handleCreateLink = async () => {
    if (!linkForm.titulo.trim() || !linkForm.url.trim()) {
      showError('El título y la URL son obligatorios');
      return;
    }
    try {
      await links.createLink({
        titulo: linkForm.titulo,
        url: linkForm.url,
        descripcion: linkForm.descripcion || undefined
      });
      showSuccess('Link agregado correctamente');
      setShowAddLink(false);
      setLinkForm({ titulo: '', url: '', descripcion: '' });
    } catch (err: any) {
      showError(err.message || 'Error al agregar link');
    }
  };

  const handleUpdateLink = async () => {
    if (!editingLink || !linkForm.titulo.trim() || !linkForm.url.trim()) {
      showError('El título y la URL son obligatorios');
      return;
    }
    try {
      await links.updateLink(editingLink.id, {
        titulo: linkForm.titulo,
        url: linkForm.url,
        descripcion: linkForm.descripcion || undefined
      });
      showSuccess('Link actualizado correctamente');
      setShowEditLink(false);
      setEditingLink(null);
      setLinkForm({ titulo: '', url: '', descripcion: '' });
    } catch (err: any) {
      showError(err.message || 'Error al actualizar link');
    }
  };

  const handleDeleteAdjunto = async (adjunto: any) => {
    let confirmMsg = '';
    if (adjunto.tipo === 'archivo_cliente') {
      confirmMsg = `¿Eliminar "${adjunto.nombre_archivo}"?`;
    } else if (adjunto.tipo === 'archivo_produccion') {
      confirmMsg = `¿Eliminar "${adjunto.nombre_archivo}"?`;
    } else {
      confirmMsg = `¿Eliminar link "${adjunto.titulo}"?`;
    }

    const confirmed = await showConfirm('Eliminar adjunto', confirmMsg, 'Eliminar');
    if (!confirmed) return;

    try {
      if (adjunto.tipo === 'archivo_cliente') {
        await archivos.deleteArchivo(adjunto.id);
      } else if (adjunto.tipo === 'archivo_produccion') {
        await archivosProduccion.deleteArchivo(adjunto.id);
      } else {
        await links.deleteLink(adjunto.id);
      }
      showSuccess('Adjunto eliminado correctamente');
    } catch (err: any) {
      showError(err.message || 'Error al eliminar adjunto');
    }
  };

  const handleDownloadArchivo = async (adjunto: any) => {
    try {
      if (adjunto.tipo === 'archivo_cliente') {
        await archivos.downloadArchivo(adjunto.id);
      } else {
        await archivosProduccion.downloadArchivo(adjunto.id);
      }
      showInfo('Descarga iniciada');
    } catch (err: any) {
      showError(err.message || 'Error al descargar archivo');
    }
  };

  const getIcono = (tipo: string) => {
    if (tipo === 'archivo_cliente') return <FileText className="w-6 h-6 text-blue-600" />;
    if (tipo === 'archivo_produccion') return <Settings className="w-6 h-6 text-green-600" />;
    return <LinkIcon className="w-6 h-6 text-violet-600" />;
  };

  const getBgColor = (tipo: string) => {
    if (tipo === 'archivo_cliente') return 'bg-blue-100';
    if (tipo === 'archivo_produccion') return 'bg-green-100';
    return 'bg-violet-100';
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === 'archivo_cliente') return { label: 'Cliente', color: 'bg-blue-100 text-blue-800' };
    if (tipo === 'archivo_produccion') return { label: 'Producción', color: 'bg-green-100 text-green-800' };
    return { label: 'Link', color: 'bg-violet-100 text-violet-800' };
  };

  const getWarningColor = () => {
    if (!diasRestantes) return 'bg-yellow-50 border-yellow-300';
    if (diasRestantes <= 3) return 'bg-red-50 border-red-300';
    return 'bg-yellow-50 border-yellow-300';
  };

  // En modo creación, solo esperar archivos y links (no archivos de producción)
  const loading = modoCreacion
    ? (archivos.loading || links.loading)
    : (archivos.loading || links.loading || archivosProduccion.loading);

  console.log('[OrdenAdjuntosTab] Loading final:', loading);

  if (loading) {
    console.log('[OrdenAdjuntosTab] Mostrando spinner...');
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  console.log('[OrdenAdjuntosTab] Renderizando contenido completo');

  const totalSize = archivos.totalSize + archivosProduccion.totalSize;
  const maxSize = archivos.maxTotalSize + archivosProduccion.maxTotalSize;
  const usagePercentage = (totalSize / maxSize) * 100;

  return (
    <div className="space-y-6">
      {/* Mensaje modo creación */}
      {modoCreacion && (
        <Card className="border-2 bg-blue-50 border-blue-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                Adjuntos Pre-Carga
              </h3>
              <div className="text-sm text-gray-700">
                <p>
                  Los archivos y links que agregues aquí se asociarán automáticamente a la orden cuando la guardes.
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Si cancelas sin guardar, los adjuntos se eliminarán automáticamente.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Advertencia de archivos temporales antiguos */}
      {mostrarAdvertenciaViejos && modoCreacion && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                Archivos de sesión anterior detectados
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Hay archivos de una sesión de creación anterior. Estos se eliminarán automáticamente en 24 horas.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await Promise.all([
                        archivos.limpiarTemporales(),
                        links.limpiarTemporales()
                      ]);
                      showSuccess('Archivos antiguos eliminados correctamente');
                      setMostrarAdvertenciaViejos(false);
                    } catch (err: any) {
                      showError(err.message || 'Error al eliminar archivos antiguos');
                    }
                  }}
                >
                  Eliminar Ahora
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMostrarAdvertenciaViejos(false)}
                >
                  Mantener
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Advertencia de Política */}
      {!modoCreacion && estado === 'entregada' && fechaEliminacion && (
        <Card className={`border-2 ${getWarningColor()}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                IMPORTANTE: Eliminación Automática Programada
              </h3>
              <div className="text-sm text-gray-700 space-y-1">
                <p>
                  Los adjuntos se eliminarán <strong>AUTOMÁTICAMENTE e IRREVERSIBLEMENTE</strong>{' '}
                  5 días después de la entrega REAL de esta orden.
                </p>
                <div className="mt-2 space-y-1">
                  <p>
                    • Fecha de entrega real: <strong>{dayjs(fechaEntregaReal).format('DD/MM/YYYY')}</strong>
                  </p>
                  <p>
                    • Eliminación programada:{' '}
                    <strong className={diasRestantes && diasRestantes <= 3 ? 'text-red-600' : ''}>
                      {fechaEliminacion.format('DD/MM/YYYY')}
                      {diasRestantes !== null && ` (${diasRestantes} días restantes)`}
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Indicador de espacio */}
      <Card>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Espacio utilizado (Archivos)</span>
            <span className="font-semibold text-gray-900">
              {archivos.formatSize(totalSize)} / {archivos.formatSize(maxSize)}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                usagePercentage < 60 ? 'bg-green-600' :
                usagePercentage < 85 ? 'bg-yellow-600' :
                usagePercentage < 95 ? 'bg-orange-600' : 'bg-red-600'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Filtros y acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos ({todosAdjuntos.length})</option>
            <option value="archivos_cliente">Archivos Cliente ({archivos.archivos.length})</option>
            {!modoCreacion && <option value="archivos_produccion">Archivos Producción ({archivosProduccion.archivos.length})</option>}
            <option value="links">Links ({links.links.length})</option>
          </select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button onClick={() => fileInputRef.current?.click()} disabled={archivos.availableSpace <= 0}>
            <Upload className="w-4 h-4 mr-2" />
            Archivo Cliente
          </Button>

          {archivosProduccion.canUpload && !modoCreacion && (
            <Button onClick={() => fileProduccionInputRef.current?.click()} variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Archivo Producción
            </Button>
          )}

          <Button onClick={() => setShowAddLink(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Link
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setSelectedFile(e.target.files[0]);
              setShowUploadArchivo(true);
            }
          }}
        />
        <input
          ref={fileProduccionInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setSelectedFile(e.target.files[0]);
              setShowUploadProduccion(true);
            }
          }}
        />
      </div>

      {/* Lista de adjuntos */}
      {adjuntosFiltrados.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay adjuntos"
          description={
            filtroTipo === 'todos'
              ? "Agrega archivos o links para esta orden"
              : `No hay ${filtroTipo === 'archivos_cliente' ? 'archivos de cliente' : filtroTipo === 'archivos_produccion' ? 'archivos de producción' : 'links'}`
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {adjuntosFiltrados.map((adjunto) => {
              const esReciente = dayjs().diff(dayjs(adjunto.fecha), 'hours') < 24;
              const esRecienSubido = adjunto.id === recentlyUploadedId;
              const tipoBadge = getTipoBadge(adjunto.tipo);

              return (
                <div
                  key={`${adjunto.tipo}-${adjunto.id}`}
                  data-archivo-item
                  className={`p-4 transition-all duration-300 ${
                    esRecienSubido
                      ? 'bg-green-50 ring-2 ring-green-500 ring-inset'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${getBgColor(adjunto.tipo)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      {getIcono(adjunto.tipo)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {adjunto.tipo === 'link' ? adjunto.titulo : adjunto.nombre_archivo}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${tipoBadge.color}`}>
                          {tipoBadge.label}
                        </span>
                        {esReciente && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            Nuevo
                          </span>
                        )}
                        {adjunto.tipo === 'archivo_produccion' && adjunto.version > 1 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            v{adjunto.version}
                          </span>
                        )}
                        {adjunto.tipo === 'archivo_produccion' && adjunto.etiquetas?.map((etiq: string) => (
                          <span key={etiq} className={`px-2 py-0.5 rounded text-xs font-medium ${archivosProduccion.getEtiquetaColor(etiq)}`}>
                            {etiq.toUpperCase()}
                          </span>
                        ))}
                        {diasRestantes !== null && diasRestantes <= 3 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Eliminar en {diasRestantes}d
                          </span>
                        )}
                      </div>

                      {adjunto.tipo === 'link' && (
                        <a
                          href={adjunto.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-600 hover:underline block mb-1 truncate"
                        >
                          {adjunto.url}
                        </a>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {adjunto.tipo !== 'link' && (
                          <span>{archivos.formatSize(adjunto.tamano_bytes)}</span>
                        )}
                        <span>{dayjs(adjunto.fecha).format('DD/MM/YYYY HH:mm')}</span>
                        {adjunto.usuario && <span>Por: {adjunto.usuario}</span>}
                      </div>

                      {(adjunto.descripcion || adjunto.notas) && (
                        <p className="text-xs text-gray-600 mt-1 italic">
                          {adjunto.tipo === 'link' ? adjunto.descripcion : adjunto.notas || adjunto.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {adjunto.tipo === 'link' ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => links.openLink(adjunto.url)}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => links.copyLink(adjunto.url)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingLink(adjunto);
                            setLinkForm({
                              titulo: adjunto.titulo,
                              url: adjunto.url,
                              descripcion: adjunto.descripcion || ''
                            });
                            setShowEditLink(true);
                          }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadArchivo(adjunto)}>
                            <Download className="w-4 h-4" />
                          </Button>
                          {adjunto.tipo === 'archivo_produccion' && adjunto.version > 1 && (
                            <Button size="sm" variant="outline" onClick={() => setShowVersionHistory(adjunto.id)}>
                              <History className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleDeleteAdjunto(adjunto)}>
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

      {/* Modal upload archivo cliente */}
      <Modal
        isOpen={showUploadArchivo}
        onClose={() => {
          if (archivos.uploading) return; // No cerrar si está subiendo
          setShowUploadArchivo(false);
          clearSelectedFile();
          setArchivoForm({ descripcion: '' });
        }}
        title="Subir Archivo de Cliente"
      >
        <div className="space-y-4">
          {/* Información del archivo seleccionado */}
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-start gap-3">
                <FileText className="w-8 h-8 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                    <span>{archivos.formatSize(selectedFile.size)}</span>
                    <span>•</span>
                    <span>{selectedFile.type || 'Tipo desconocido'}</span>
                  </div>
                </div>
                {!archivos.uploading && (
                  <button
                    onClick={clearSelectedFile}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Quitar archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Preview de imagen */}
              {previewUrl && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa:</p>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-48 w-auto rounded border border-gray-300"
                  />
                </div>
              )}
            </div>
          )}

          {/* Input de archivo si no hay seleccionado */}
          {!selectedFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar archivo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          )}

          {/* Campo de descripción */}
          <Input
            label="Nombre descriptivo"
            value={archivoForm.descripcion}
            onChange={(e) => setArchivoForm({ descripcion: e.target.value })}
            placeholder="Ej: Logo Final V2, Contrato Firmado, Mockup Aprobado"
            disabled={archivos.uploading}
          />

          {/* Indicador de progreso */}
          {archivos.uploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Subiendo archivo...</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${archivos.uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {archivos.uploadProgress}% completado
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (archivos.uploading) return;
                setShowUploadArchivo(false);
                clearSelectedFile();
                setArchivoForm({ descripcion: '' });
              }}
              disabled={archivos.uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadArchivo}
              disabled={!selectedFile || archivos.uploading}
            >
              {archivos.uploading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Archivo
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal upload archivo producción */}
      <Modal
        isOpen={showUploadProduccion}
        onClose={() => {
          if (archivosProduccion.uploading) return;
          setShowUploadProduccion(false);
          clearSelectedFile();
          setProduccionForm({ etiquetas: [], notas: '', reemplaza_a: '' });
        }}
        title="Subir Archivo de Producción"
      >
        <div className="space-y-4">
          {/* Información del archivo seleccionado */}
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-start gap-3">
                <Settings className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                    <span>{archivosProduccion.formatSize(selectedFile.size)}</span>
                    <span>•</span>
                    <span>{selectedFile.type || 'Tipo desconocido'}</span>
                  </div>
                </div>
                {!archivosProduccion.uploading && (
                  <button
                    onClick={clearSelectedFile}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Quitar archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Preview de imagen */}
              {previewUrl && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa:</p>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-48 w-auto rounded border border-gray-300"
                  />
                </div>
              )}
            </div>
          )}

          {/* Input de archivo si no hay seleccionado */}
          {!selectedFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar archivo
              </label>
              <input
                ref={fileProduccionInputRef}
                type="file"
                onChange={handleFileProduccionSelect}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas (opcional)</label>
            <MultiSelect
              options={ETIQUETAS_DISPONIBLES}
              value={produccionForm.etiquetas}
              onChange={(etiquetas) => setProduccionForm({ ...produccionForm, etiquetas })}
              placeholder="Seleccionar etiquetas..."
              disabled={archivosProduccion.uploading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Reemplaza archivo?</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              value={produccionForm.reemplaza_a}
              onChange={(e) => setProduccionForm({ ...produccionForm, reemplaza_a: e.target.value })}
              disabled={archivosProduccion.uploading}
            >
              <option value="">No reemplaza</option>
              {archivosProduccion.archivos.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre_archivo} (v{a.version})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              rows={3}
              value={produccionForm.notas}
              onChange={(e) => setProduccionForm({ ...produccionForm, notas: e.target.value })}
              placeholder="Ej: Ajustes de color aplicados..."
              disabled={archivosProduccion.uploading}
            />
          </div>

          {/* Indicador de progreso */}
          {archivosProduccion.uploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Subiendo archivo de producción...</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${archivosProduccion.uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">
                {archivosProduccion.uploadProgress}% completado
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (archivosProduccion.uploading) return;
                setShowUploadProduccion(false);
                clearSelectedFile();
                setProduccionForm({ etiquetas: [], notas: '', reemplaza_a: '' });
              }}
              disabled={archivosProduccion.uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUploadProduccion}
              disabled={!selectedFile || archivosProduccion.uploading}
            >
              {archivosProduccion.uploading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Archivo
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal agregar link */}
      <Modal
        isOpen={showAddLink}
        onClose={() => {
          setShowAddLink(false);
          setLinkForm({ titulo: '', url: '', descripcion: '' });
        }}
        title="Agregar Link"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={linkForm.titulo}
            onChange={(e) => setLinkForm({ ...linkForm, titulo: e.target.value })}
            placeholder="Ej: Archivos en WeTransfer"
            required
          />
          <Input
            label="URL"
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            placeholder="https://wetransfer.com/..."
            required
          />
          <Input
            label="Descripción (opcional)"
            value={linkForm.descripcion}
            onChange={(e) => setLinkForm({ ...linkForm, descripcion: e.target.value })}
            placeholder="Información adicional"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => {
              setShowAddLink(false);
              setLinkForm({ titulo: '', url: '', descripcion: '' });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLink}>Agregar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar link */}
      <Modal
        isOpen={showEditLink}
        onClose={() => {
          setShowEditLink(false);
          setEditingLink(null);
          setLinkForm({ titulo: '', url: '', descripcion: '' });
        }}
        title="Editar Link"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={linkForm.titulo}
            onChange={(e) => setLinkForm({ ...linkForm, titulo: e.target.value })}
            required
          />
          <Input
            label="URL"
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            required
          />
          <Input
            label="Descripción"
            value={linkForm.descripcion}
            onChange={(e) => setLinkForm({ ...linkForm, descripcion: e.target.value })}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => {
              setShowEditLink(false);
              setEditingLink(null);
              setLinkForm({ titulo: '', url: '', descripcion: '' });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateLink}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal historial versiones */}
      <Modal
        isOpen={showVersionHistory !== null}
        onClose={() => setShowVersionHistory(null)}
        title="Historial de Versiones"
      >
        <div className="space-y-3">
          {showVersionHistory && archivosProduccion.getVersionHistory(showVersionHistory).map((archivo, index) => (
            <div key={archivo.id} className={`p-4 rounded-lg border-2 ${
              index === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Versión {archivo.version}</span>
                  {index === 0 && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Actual
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {archivosProduccion.formatSize(archivo.tamano_bytes)}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{archivo.nombre_archivo}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                <span>{dayjs(archivo.created_at).format('DD/MM/YYYY HH:mm')}</span>
                {archivo.uploader?.full_name && <span>Por: {archivo.uploader.full_name}</span>}
              </div>
              {archivo.notas && <p className="text-xs text-gray-600 italic mb-2">Notas: {archivo.notas}</p>}
              <Button size="sm" variant="outline" onClick={() => archivosProduccion.downloadArchivo(archivo.id)}>
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
