import { useState } from 'react';
import {
  Link as LinkIcon, Plus, ExternalLink, Copy, Edit2, Trash2,
  AlertTriangle, CheckCircle2, Filter, Download, Server
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

type LinkType = 'download' | 'internal';

export function OrdenAdjuntosTab({
  ordenId
}: OrdenAdjuntosTabProps) {
  const links = useOrdenLinks(ordenId);

  const [showAddLink, setShowAddLink] = useState(false);
  const [showEditLink, setShowEditLink] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const [linkForm, setLinkForm] = useState({ titulo: '', url: '', descripcion: '' });
  const [linkType, setLinkType] = useState<LinkType>('download');
  const [editingLink, setEditingLink] = useState<any>(null);

  const { showSuccess, showError, showInfo } = useToast();
  const { showConfirm } = useConfirmDialog();

  const formatUrl = (url: string, type: LinkType): string => {
    const trimmedUrl = url.trim();
    if (type === 'download') {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        return `https://${trimmedUrl}`;
      }
    }
    return trimmedUrl;
  };

  // Handlers para links
  const handleCreateLink = async () => {
    if (!linkForm.titulo.trim() || !linkForm.url.trim()) {
      showError('El título y la URL son obligatorios');
      return;
    }
    try {
      const formattedUrl = formatUrl(linkForm.url, linkType);

      const nuevoLink = await links.createLink({
        titulo: linkForm.titulo,
        url: formattedUrl,
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
      setLinkType('download');
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
      const formattedUrl = formatUrl(linkForm.url, linkType); // Use state linkType for editing

      if (linkForm.titulo.trim() !== editingLink.titulo) {
        updates.titulo = linkForm.titulo;
      }

      if (formattedUrl !== editingLink.url) {
        updates.url = formattedUrl;
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
      setLinkType('download');
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

  const renderLinkTypeSelector = () => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Link</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="linkType"
            checked={linkType === 'download'}
            onChange={() => setLinkType('download')}
            className="text-blue-600 focus:ring-blue-500"
          />
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <Download className="w-4 h-4" />
            <span>Link de descarga (Web)</span>
          </div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="linkType"
            checked={linkType === 'internal'}
            onChange={() => setLinkType('internal')}
            className="text-blue-600 focus:ring-blue-500"
          />
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <Server className="w-4 h-4" />
            <span>Link interno (Red Local)</span>
          </div>
        </label>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {linkType === 'download'
          ? 'Para WeTransfer, Google Drive, Dropbox, etc. Se agregará https:// automáticamente.'
          : 'Para rutas de carpetas en servidores o red local (ej: \\\\servidor\\carpeta).'}
      </p>
    </div>
  );

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

        <Button onClick={() => {
          setLinkType('download');
          setShowAddLink(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Link
        </Button>
      </div>

      {/* Lista de links */}
      {links.links.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No hay links"
          description="Agrega links de descarga o rutas internas para esta orden"
        />
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {links.links.map((link) => {
              const esReciente = dayjs().diff(dayjs(link.created_at), 'hours') < 24;
              const esRecienAgregado = link.id === recentlyAddedId;
              // Detect basic type for icon displayed in list
              const isInternal = !/^https?:\/\//i.test(link.url);

              return (
                <div
                  key={link.id}
                  className={`p-4 transition-all duration-300 ${esRecienAgregado
                    ? 'bg-green-50 ring-2 ring-green-500 ring-inset'
                    : 'hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isInternal ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      {isInternal ? (
                        <Server className="w-6 h-6 text-amber-600" />
                      ) : (
                        <Download className="w-6 h-6 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {link.titulo}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${isInternal ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {isInternal ? 'Interno / Red' : 'Descarga'}
                        </span>
                        {esReciente && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            Nuevo
                          </span>
                        )}
                      </div>

                      {/* URL Display */}
                      <div className="flex items-center gap-2 mb-1">
                        {isInternal ? (
                          <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded truncate select-all">
                            {link.url}
                          </span>
                        ) : (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline truncate"
                          >
                            {link.url}
                          </a>
                        )}
                      </div>

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
                      {!isInternal && (
                        <Button size="sm" variant="outline" onClick={() => links.openLink(link.url)}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleCopyLink(link.url)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingLink(link);
                        // Determine initial type for editing based on URL pattern
                        setLinkType(!/^https?:\/\//i.test(link.url) ? 'internal' : 'download');
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
          {renderLinkTypeSelector()}

          <Input
            label="Título"
            value={linkForm.titulo}
            onChange={(e) => setLinkForm({ ...linkForm, titulo: e.target.value })}
            placeholder={linkType === 'download' ? "Ej: Archivos en WeTransfer" : "Ej: Carpeta de Producción"}
            required
            autoFocus
          />
          <Input
            label={linkType === 'download' ? "URL de Descarga" : "Ruta de Carpeta/Archivo"}
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            placeholder={linkType === 'download' ? "ejemplo.com o https://ejemplo.com/archivo" : "\\\\servidor\\proyectos\\orden-123"}
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
          {renderLinkTypeSelector()}

          <Input
            label="Título"
            value={linkForm.titulo}
            onChange={(e) => setLinkForm({ ...linkForm, titulo: e.target.value })}
            required
          />
          <Input
            label={linkType === 'download' ? "URL de Descarga" : "Ruta de Carpeta/Archivo"}
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            placeholder={linkType === 'download' ? "ejemplo.com o https://ejemplo.com/archivo" : "\\\\servidor\\proyectos\\orden-123"}
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
