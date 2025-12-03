import { useState } from 'react';
import {
  Link as LinkIcon, Plus, ExternalLink, Copy, Edit2, Trash2,
  AlertTriangle, CheckCircle2, Filter
} from 'lucide-react';
import { useOrdenLinks } from '../../hooks/useOrdenLinks';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import dayjs from 'dayjs';

interface OrdenAdjuntosTabProps {
  ordenId: string;
}

export function OrdenAdjuntosTab({
  ordenId
}: OrdenAdjuntosTabProps) {
  const links = useOrdenLinks(ordenId);

  const [showAddLink, setShowAddLink] = useState(false);
  const [showEditLink, setShowEditLink] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ titulo: '', url: '', descripcion: '' });
  const [editingLink, setEditingLink] = useState<any>(null);

  const { showSuccess, showError, showInfo } = useToast();
  const { showConfirm } = useConfirmDialog();

  // Handlers para links
  const handleCreateLink = async () => {
    if (!linkForm.titulo.trim() || !linkForm.url.trim()) {
      showError('El título y la URL son obligatorios');
      return;
    }
    try {
      const nuevoLink = await links.createLink({
        titulo: linkForm.titulo,
        url: linkForm.url,
        descripcion: linkForm.descripcion || undefined
      });
      showSuccess('Link agregado correctamente');

      // Marcar como recién agregado para highlight
      if (nuevoLink?.id) {
        setRecentlyAddedId(nuevoLink.id);
        setTimeout(() => setRecentlyAddedId(null), 3000);
      }

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
      const updates: any = {};

      if (linkForm.titulo.trim() !== editingLink.titulo) {
        updates.titulo = linkForm.titulo;
      }

      if (linkForm.url.trim() !== editingLink.url) {
        updates.url = linkForm.url;
      }

      if ((linkForm.descripcion || '') !== (editingLink.descripcion || '')) {
        updates.descripcion = linkForm.descripcion || undefined;
      }

      if (Object.keys(updates).length > 0) {
        await links.updateLink(editingLink.id, updates);
        showSuccess('Link actualizado correctamente');
      } else {
        showInfo('No hay cambios que guardar');
      }

      setShowEditLink(false);
      setEditingLink(null);
      setLinkForm({ titulo: '', url: '', descripcion: '' });
    } catch (err: any) {
      showError(err.message || 'Error al actualizar link');
    }
  };

  const handleDeleteLink = async (link: any) => {
    const confirmed = await showConfirm('Eliminar link', `¿Eliminar link "${link.titulo}"?`, 'Eliminar');
    if (!confirmed) return;

    try {
      await links.deleteLink(link.id);
      showSuccess('Link eliminado correctamente');
    } catch (err: any) {
      showError(err.message || 'Error al eliminar link');
    }
  };

  const handleCopyLink = async (url: string) => {
    const success = await links.copyLink(url);
    if (success) {
      showSuccess('Link copiado al portapapeles');
    } else {
      showError('No se pudo copiar el link');
    }
  };

  if (links.loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Acciones */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">
            Total: {links.links.length} {links.links.length === 1 ? 'link' : 'links'}
          </span>
        </div>

        <Button onClick={() => setShowAddLink(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Link
        </Button>
      </div>

      {/* Lista de links */}
      {links.links.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No hay links"
          description="Agrega links externos para esta orden (WeTransfer, Google Drive, etc.)"
        />
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {links.links.map((link) => {
              const esReciente = dayjs().diff(dayjs(link.created_at), 'hours') < 24;
              const esRecienAgregado = link.id === recentlyAddedId;
              const tipoServicio = links.getServiceType(link.url);

              return (
                <div
                  key={link.id}
                  className={`p-4 transition-all duration-300 ${
                    esRecienAgregado
                      ? 'bg-green-50 ring-2 ring-green-500 ring-inset'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <LinkIcon className="w-6 h-6 text-violet-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {link.titulo}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800">
                          {tipoServicio}
                        </span>
                        {esReciente && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            Nuevo
                          </span>
                        )}
                      </div>

                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-600 hover:underline block mb-1 truncate"
                      >
                        {link.url}
                      </a>

                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span>{dayjs(link.created_at).format('DD/MM/YYYY HH:mm')}</span>
                        {link.creator?.full_name && <span>Por: {link.creator.full_name}</span>}
                      </div>

                      {link.descripcion && (
                        <p className="text-xs text-gray-600 mt-1 italic">
                          {link.descripcion}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => links.openLink(link.url)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCopyLink(link.url)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingLink(link);
                        setLinkForm({
                          titulo: link.titulo,
                          url: link.url,
                          descripcion: link.descripcion || ''
                        });
                        setShowEditLink(true);
                      }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteLink(link)}>
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

      {/* Modal agregar link */}
      <Modal
        isOpen={showAddLink}
        onClose={() => {
          setShowAddLink(false);
          setLinkForm({ titulo: '', url: '', descripcion: '' });
        }}
        title="Agregar Link"
      >
        <div className="space-y-4" onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && linkForm.titulo.trim() && linkForm.url.trim()) {
            e.preventDefault();
            handleCreateLink();
          }
        }}>
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
            placeholder="ejemplo.com o https://ejemplo.com/archivo"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (opcional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              value={linkForm.descripcion}
              onChange={(e) => setLinkForm({ ...linkForm, descripcion: e.target.value })}
              placeholder="Información adicional sobre el link"
            />
          </div>
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
        <div className="space-y-4" onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && linkForm.titulo.trim() && linkForm.url.trim()) {
            e.preventDefault();
            handleUpdateLink();
          }
        }}>
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
            placeholder="ejemplo.com o https://ejemplo.com/archivo"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              value={linkForm.descripcion}
              onChange={(e) => setLinkForm({ ...linkForm, descripcion: e.target.value })}
              placeholder="Información adicional sobre el link"
            />
          </div>
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
    </div>
  );
}
