import { useState, useRef } from 'react';
import {
  Upload, Download, Trash2, FileText, Link as LinkIcon, Settings,
  AlertTriangle, Clock, Plus, ExternalLink, Copy, Edit2, CheckCircle2,
  History, Filter
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
  const archivos = useOrdenArchivos({ ordenId, ordenTemporalId });
  const links = useOrdenLinks({ ordenId, ordenTemporalId });
  const archivosProduccion = useOrdenArchivosProduccion(ordenId || '');

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [showUploadArchivo, setShowUploadArchivo] = useState(false);
  const [showUploadProduccion, setShowUploadProduccion] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showEditLink, setShowEditLink] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  const { showToast } = useToast();
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

  // Consolidar todos los adjuntos en una lista única
  const todosAdjuntos = [
    ...archivos.archivos.map(a => ({
      ...a,
      tipo: 'archivo_cliente' as const,
      fecha: a.created_at,
      usuario: a.uploader?.nombre_completo
    })),
    ...archivosProduccion.archivos.map(a => ({
      ...a,
      tipo: 'archivo_produccion' as const,
      fecha: a.created_at,
      usuario: a.uploader?.nombre_completo
    })),
    ...links.links.map(l => ({
      ...l,
      tipo: 'link' as const,
      fecha: l.created_at,
      usuario: l.creator?.nombre_completo
    }))
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  // Filtrar adjuntos
  const adjuntosFiltrados = todosAdjuntos.filter(adj => {
    if (filtroTipo === 'todos') return true;
    return adj.tipo === filtroTipo;
  });

  // Handlers para archivos de cliente
  const handleUploadArchivo = async () => {
    if (!selectedFile) return;
    try {
      await archivos.uploadArchivo({
        file: selectedFile,
        descripcion: archivoForm.descripcion || undefined
      });
      showToast('Archivo subido correctamente', 'success');
      setShowUploadArchivo(false);
      setSelectedFile(null);
      setArchivoForm({ descripcion: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handlers para archivos de producción
  const handleUploadProduccion = async () => {
    if (!selectedFile) return;
    try {
      await archivosProduccion.uploadArchivo({
        file: selectedFile,
        etiquetas: produccionForm.etiquetas.length > 0 ? produccionForm.etiquetas : undefined,
        notas: produccionForm.notas || undefined,
        reemplaza_a: produccionForm.reemplaza_a || undefined
      });
      showToast('Archivo de producción subido correctamente', 'success');
      setShowUploadProduccion(false);
      setSelectedFile(null);
      setProduccionForm({ etiquetas: [], notas: '', reemplaza_a: '' });
      if (fileProduccionInputRef.current) fileProduccionInputRef.current.value = '';
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handlers para links
  const handleCreateLink = async () => {
    if (!linkForm.titulo.trim() || !linkForm.url.trim()) {
      showToast('El título y la URL son obligatorios', 'error');
      return;
    }
    try {
      await links.createLink({
        titulo: linkForm.titulo,
        url: linkForm.url,
        descripcion: linkForm.descripcion || undefined
      });
      showToast('Link agregado correctamente', 'success');
      setShowAddLink(false);
      setLinkForm({ titulo: '', url: '', descripcion: '' });
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateLink = async () => {
    if (!editingLink || !linkForm.titulo.trim() || !linkForm.url.trim()) {
      showToast('El título y la URL son obligatorios', 'error');
      return;
    }
    try {
      await links.updateLink(editingLink.id, {
        titulo: linkForm.titulo,
        url: linkForm.url,
        descripcion: linkForm.descripcion || undefined
      });
      showToast('Link actualizado correctamente', 'success');
      setShowEditLink(false);
      setEditingLink(null);
      setLinkForm({ titulo: '', url: '', descripcion: '' });
    } catch (err: any) {
      showToast(err.message, 'error');
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
      showToast('Adjunto eliminado correctamente', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadArchivo = async (adjunto: any) => {
    try {
      if (adjunto.tipo === 'archivo_cliente') {
        await archivos.downloadArchivo(adjunto.id);
      } else {
        await archivosProduccion.downloadArchivo(adjunto.id);
      }
      showToast('Descarga iniciada', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
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

  const loading = archivos.loading || links.loading || archivosProduccion.loading;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
              const tipoBadge = getTipoBadge(adjunto.tipo);

              return (
                <div key={`${adjunto.tipo}-${adjunto.id}`} className="p-4 hover:bg-gray-50">
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
          setShowUploadArchivo(false);
          setSelectedFile(null);
          setArchivoForm({ descripcion: '' });
        }}
        title="Subir Archivo de Cliente"
      >
        <div className="space-y-4">
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{archivos.formatSize(selectedFile.size)}</p>
                </div>
              </div>
            </div>
          )}
          <Input
            label="Descripción (opcional)"
            value={archivoForm.descripcion}
            onChange={(e) => setArchivoForm({ descripcion: e.target.value })}
            placeholder="Ej: Archivos enviados por el cliente"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => {
              setShowUploadArchivo(false);
              setSelectedFile(null);
              setArchivoForm({ descripcion: '' });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUploadArchivo}>Subir Archivo</Button>
          </div>
        </div>
      </Modal>

      {/* Modal upload archivo producción */}
      <Modal
        isOpen={showUploadProduccion}
        onClose={() => {
          setShowUploadProduccion(false);
          setSelectedFile(null);
          setProduccionForm({ etiquetas: [], notas: '', reemplaza_a: '' });
        }}
        title="Subir Archivo de Producción"
      >
        <div className="space-y-4">
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{archivosProduccion.formatSize(selectedFile.size)}</p>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas (opcional)</label>
            <MultiSelect
              options={ETIQUETAS_DISPONIBLES}
              value={produccionForm.etiquetas}
              onChange={(etiquetas) => setProduccionForm({ ...produccionForm, etiquetas })}
              placeholder="Seleccionar etiquetas..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Reemplaza archivo?</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={produccionForm.reemplaza_a}
              onChange={(e) => setProduccionForm({ ...produccionForm, reemplaza_a: e.target.value })}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              rows={3}
              value={produccionForm.notas}
              onChange={(e) => setProduccionForm({ ...produccionForm, notas: e.target.value })}
              placeholder="Ej: Ajustes de color aplicados..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => {
              setShowUploadProduccion(false);
              setSelectedFile(null);
              setProduccionForm({ etiquetas: [], notas: '', reemplaza_a: '' });
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUploadProduccion}>Subir Archivo</Button>
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
                {archivo.uploader?.nombre_completo && <span>Por: {archivo.uploader.nombre_completo}</span>}
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
