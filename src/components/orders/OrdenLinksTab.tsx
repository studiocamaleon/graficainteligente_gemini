import { useState } from 'react';
import { Link as LinkIcon, Plus, ExternalLink, Copy, Trash2, Edit2, AlertTriangle, Clock } from 'lucide-react';
import { useOrdenLinks } from '../../hooks/useOrdenLinks';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import dayjs from 'dayjs';

interface OrdenLinksTabProps {
  ordenId: string;
  fechaEntrega?: string;
  estado: string;
  fechaCompletado?: string;
}

export function OrdenLinksTab({
  ordenId,
  fechaEntrega,
  estado,
  fechaCompletado
}: OrdenLinksTabProps) {
  const {
    links,
    loading,
    error,
    createLink,
    updateLink,
    deleteLink,
    openLink,
    copyLink,
    getServiceType
  } = useOrdenLinks(ordenId);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    url: '',
    descripcion: ''
  });

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
      titulo: '',
      url: '',
      descripcion: ''
    });
  };

  // Abrir modal de creación
  const handleOpenCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  // Abrir modal de edición
  const handleOpenEdit = (link: any) => {
    setEditingLink(link);
    setFormData({
      titulo: link.titulo,
      url: link.url,
      descripcion: link.descripcion || ''
    });
    setShowEditModal(true);
  };

  // Crear link
  const handleCreate = async () => {
    if (!formData.titulo.trim() || !formData.url.trim()) {
      showToast('El título y la URL son obligatorios', 'error');
      return;
    }

    try {
      await createLink({
        titulo: formData.titulo,
        url: formData.url,
        descripcion: formData.descripcion || undefined
      });

      showToast('Link agregado correctamente', 'success');
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Actualizar link
  const handleUpdate = async () => {
    if (!editingLink || !formData.titulo.trim() || !formData.url.trim()) {
      showToast('El título y la URL son obligatorios', 'error');
      return;
    }

    try {
      await updateLink(editingLink.id, {
        titulo: formData.titulo,
        url: formData.url,
        descripcion: formData.descripcion || undefined
      });

      showToast('Link actualizado correctamente', 'success');
      setShowEditModal(false);
      setEditingLink(null);
      resetForm();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Eliminar link
  const handleDelete = async (linkId: string, titulo: string) => {
    const confirmed = await showConfirm(
      'Eliminar link',
      `¿Está seguro de eliminar "${titulo}"?`,
      'Eliminar'
    );

    if (confirmed) {
      try {
        await deleteLink(linkId);
        showToast('Link eliminado correctamente', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  // Copiar link
  const handleCopy = async (url: string) => {
    const success = await copyLink(url);
    if (success) {
      showToast('Link copiado al portapapeles', 'success');
    } else {
      showToast('Error al copiar el link', 'error');
    }
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

  // Obtener icono según tipo de servicio
  const getServiceIcon = (url: string) => {
    const service = getServiceType(url);
    return <LinkIcon className="w-5 h-5 text-violet-600" />;
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
                Los links guardados se eliminarán <strong>AUTOMÁTICAMENTE</strong>{' '}
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
                  • Los links se eliminarán 5 días después de marcar esta orden como completada
                </p>
              )}

              <p className="mt-2 font-medium">
                Asegúrese de descargar los archivos compartidos antes de la fecha de eliminación.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Botón de agregar */}
      <div>
        <Button onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Link
        </Button>
      </div>

      {/* Lista de links */}
      {links.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No hay links"
          description="Agrega links de WeTransfer, Google Drive u otros servicios"
          action={
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Link
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {links.map((link) => {
              const linkReciente = dayjs().diff(dayjs(link.created_at), 'hours') < 24;
              const serviceType = getServiceType(link.url);

              return (
                <div key={link.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                        {getServiceIcon(link.url)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {link.titulo}
                        </h4>
                        {linkReciente && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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

                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-600 hover:text-violet-700 hover:underline block mb-2 truncate"
                      >
                        {link.url}
                      </a>

                      {link.descripcion && (
                        <p className="text-xs text-gray-600 mb-2">{link.descripcion}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {serviceType}
                        </span>
                        <span>
                          {dayjs(link.created_at).format('DD/MM/YYYY HH:mm')}
                        </span>
                        {link.creator?.full_name && (
                          <span>
                            Por: {link.creator.full_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLink(link.url)}
                        title="Abrir link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(link.url)}
                        title="Copiar link"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(link)}
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(link.id, link.titulo)}
                        title="Eliminar"
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

      {/* Modal de crear link */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Agregar Link"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            placeholder="Ej: Archivos en WeTransfer"
            required
          />

          <Input
            label="URL"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://wetransfer.com/..."
            required
          />

          <Input
            label="Descripción (opcional)"
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Información adicional sobre el link"
          />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Puede agregar links de WeTransfer, Google Drive, Dropbox, OneDrive, etc.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.titulo.trim() || !formData.url.trim()}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de editar link */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingLink(null);
          resetForm();
        }}
        title="Editar Link"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={formData.titulo}
            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            placeholder="Ej: Archivos en WeTransfer"
            required
          />

          <Input
            label="URL"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://wetransfer.com/..."
            required
          />

          <Input
            label="Descripción (opcional)"
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Información adicional sobre el link"
          />

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setEditingLink(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.titulo.trim() || !formData.url.trim()}
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
