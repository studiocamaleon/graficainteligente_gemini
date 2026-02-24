import { useState, useEffect, useCallback } from 'react';
import { Link2, FileText, Trash2, ExternalLink, Download, Plus, Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { useOrdenLinks } from '../../hooks/useOrdenLinks';
import { useOrdenArchivos, OrdenArchivo } from '../../hooks/useOrdenArchivos';
import { useFileUpload } from '../../hooks/useFileUpload';
import { FilePasteZone } from './FilePasteZone';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui/Modal';
import { useToast } from '../../contexts/ToastContext';
import { isWorkshopOperatorRole } from '../../utils/roles';

interface OrdenAdjuntosSectionProps {
    ordenId?: string;
    ordenTemporalId?: string;
    // Para modo creación (sin IDs reales aún)
    onLinksChange?: (links: any[]) => void;
    initialLinks?: any[];
    onArchivosCountChange?: (count: number) => void;
}

export function OrdenAdjuntosSection({
    ordenId,
    ordenTemporalId,
    onLinksChange,
    initialLinks = [],
    onArchivosCountChange
}: OrdenAdjuntosSectionProps) {
    const { profile } = useAuth();
    const { showError, showSuccess } = useToast();
    const canUploadAdjuntos = !isWorkshopOperatorRole(profile?.role);
    const { links, createLink, deleteLink } = useOrdenLinks(ordenId || '');
    const { archivos, createArchivo, deleteArchivo, loading: loadingArchivos, error: archivosError } = useOrdenArchivos({ ordenId, ordenTemporalId });
    const { uploadFile, downloadFile, deleteFile: deleteFromStorage, createSignedUrl } = useFileUpload();

    const [showAddLink, setShowAddLink] = useState(false);
    const [newLink, setNewLink] = useState({ titulo: '', url: '', descripcion: '' });
    const [localLinks, setLocalLinks] = useState<any[]>(initialLinks);
    const [isUploading, setIsUploading] = useState(false);

    // Estado para previsualización
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

    // Manejar links en modo creación
    useEffect(() => {
        if (!ordenId && onLinksChange) {
            onLinksChange(localLinks);
        }
    }, [localLinks, ordenId, onLinksChange]);

    useEffect(() => {
        onArchivosCountChange?.(archivos.length);
    }, [archivos.length, onArchivosCountChange]);

    // Cargar miniaturas (Signed URLs) para imágenes
    useEffect(() => {
        const loadThumbnails = async () => {
            const newThumbnails = { ...thumbnails };
            let changed = false;

            for (const archivo of archivos) {
                if (archivo.tipo_mime.startsWith('image/') && !thumbnails[archivo.id]) {
                    const url = await createSignedUrl(archivo.storage_path, 'ordenes-trabajo-archivos');
                    if (url) {
                        newThumbnails[archivo.id] = url;
                        changed = true;
                    }
                }
            }

            if (changed) {
                setThumbnails(newThumbnails);
            }
        };

        if (archivos.length > 0) {
            loadThumbnails();
        }
    }, [archivos, createSignedUrl]);

    const handleAddLink = async () => {
        if (!newLink.titulo || !newLink.url) return;

        if (ordenId) {
            await createLink(newLink);
        } else {
            const link = { ...newLink, id: `temp-${Date.now()}` };
            setLocalLinks(prev => [...prev, link]);
        }

        setNewLink({ titulo: '', url: '', descripcion: '' });
        setShowAddLink(false);
    };

    const handleRemoveLink = async (link: any) => {
        if (ordenId) {
            await deleteLink(link.id);
        } else {
            setLocalLinks(prev => prev.filter(l => l.id !== link.id));
        }
    };

    const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
        if (!canUploadAdjuntos) {
            showError('No tenés permisos para adjuntar archivos');
            return;
        }
        if (!profile?.company_id || (!ordenId && !ordenTemporalId)) return;

        const targetId = (ordenId || ordenTemporalId)!;

        setIsUploading(true);
        try {
            let uploadedCount = 0;
            for (const file of selectedFiles) {
                const fileId = crypto.randomUUID();

                // 1. Subir a Storage
                const uploadResult = await uploadFile(
                    file,
                    profile.company_id,
                    targetId,
                    fileId,
                    'ordenes-trabajo-archivos'
                );

                if (uploadResult) {
                    try {
                        // 2. Crear registro en BD
                        await createArchivo({
                            ...(ordenId ? { orden_id: ordenId } : { orden_temporal_id: ordenTemporalId }),
                            nombre_archivo: file.name,
                            nombre_storage: uploadResult.nombreStorage,
                            tipo_mime: file.type,
                            tamano_bytes: file.size,
                            storage_path: uploadResult.storagePath,
                        });
                        uploadedCount += 1;
                    } catch (createError) {
                        // Evita dejar archivo huérfano en storage si falla el insert
                        await deleteFromStorage(uploadResult.storagePath, 'ordenes-trabajo-archivos');
                        throw createError;
                    }
                }
            }

            if (uploadedCount > 0) {
                showSuccess(
                    uploadedCount === 1
                        ? 'Archivo adjuntado correctamente'
                        : `${uploadedCount} archivos adjuntados correctamente`
                );
            }
        } catch (error: any) {
            showError(error?.message || 'No se pudieron adjuntar los archivos');
        } finally {
            setIsUploading(false);
        }
    }, [canUploadAdjuntos, profile?.company_id, ordenId, ordenTemporalId, uploadFile, createArchivo, deleteFromStorage, showError, showSuccess]);

    const handleDeleteArchivo = async (archivo: OrdenArchivo) => {
        const confirm = window.confirm(`¿Seguro que quieres eliminar "${archivo.nombre_archivo}"?`);
        if (!confirm) return;

        await deleteFromStorage(archivo.storage_path, 'ordenes-trabajo-archivos');
        await deleteArchivo(archivo.id);

        // Limpiar miniatura
        if (thumbnails[archivo.id]) {
            const newThumbs = { ...thumbnails };
            delete newThumbs[archivo.id];
            setThumbnails(newThumbs);
        }
    };

    const handleDownload = (archivo: OrdenArchivo) => {
        downloadFile(archivo.storage_path, archivo.nombre_archivo, 'ordenes-trabajo-archivos');
    };

    const handlePreview = (archivo: OrdenArchivo) => {
        if (thumbnails[archivo.id]) {
            setPreviewImage({
                url: thumbnails[archivo.id],
                title: archivo.nombre_archivo
            });
        }
    };

    const displayLinks = ordenId ? links : localLinks;

    return (
        <div className="space-y-6">
            {/* SECCIÓN ARCHIVOS / PASTE ZONE */}
            <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Imágenes y Documentos Adjuntos
                </label>

                {canUploadAdjuntos ? (
                    <FilePasteZone
                        onFilesSelected={handleFilesSelected}
                        isLoading={isUploading}
                        disabled={loadingArchivos || isUploading}
                    />
                ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Tu rol no tiene permisos para adjuntar archivos.
                    </div>
                )}

                {archivosError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Error al cargar/guardar adjuntos: {archivosError}
                    </div>
                )}

                {archivos.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {archivos.map(archivo => {
                            const isImage = archivo.tipo_mime.startsWith('image/');
                            const hasThumbnail = !!thumbnails[archivo.id];

                            return (
                                <div key={archivo.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-sm group">
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        <div
                                            className={`
                                                w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-100
                                                ${isImage ? 'bg-slate-50 cursor-pointer' : 'bg-blue-50'}
                                            `}
                                            onClick={() => isImage && handlePreview(archivo)}
                                        >
                                            {isImage && hasThumbnail ? (
                                                <img
                                                    src={thumbnails[archivo.id]}
                                                    alt={archivo.nombre_archivo}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                            ) : (
                                                isImage ? (
                                                    <ImageIcon className="w-5 h-5 text-slate-400" />
                                                ) : (
                                                    <FileText className="w-6 h-6 text-blue-600" />
                                                )
                                            )}
                                        </div>
                                        <div className="overflow-hidden flex-1">
                                            <p
                                                className={`text-sm font-medium text-slate-900 truncate ${isImage ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                                title={archivo.nombre_archivo}
                                                onClick={() => isImage && handlePreview(archivo)}
                                            >
                                                {archivo.nombre_archivo}
                                            </p>
                                            <p className="text-[10px] text-slate-500 uppercase font-semibold">
                                                {(archivo.tamano_bytes / 1024).toFixed(1)} KB • {archivo.tipo_mime.split('/')[1]}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        {isImage && (
                                            <button
                                                onClick={() => handlePreview(archivo)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Previsualizar"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDownload(archivo)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            title="Descargar"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteArchivo(archivo)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <hr className="border-slate-200" />

            {/* SECCIÓN LINKS */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-blue-600" />
                        Links Externos (Drive, WeTransfer, etc.)
                    </label>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAddLink(!showAddLink)}
                        className="h-8 px-2"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar Link
                    </Button>
                </div>

                {showAddLink && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="Título (Ej: Carpeta de Google Drive)"
                                className="px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none"
                                value={newLink.titulo}
                                onChange={e => setNewLink(prev => ({ ...prev, titulo: e.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="URL (https://...)"
                                className="px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none"
                                value={newLink.url}
                                onChange={e => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                            />
                        </div>
                        <textarea
                            placeholder="Descripción opcional..."
                            className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none h-20 resize-none"
                            value={newLink.descripcion}
                            onChange={e => setNewLink(prev => ({ ...prev, descripcion: e.target.value }))}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowAddLink(false)}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={handleAddLink} disabled={!newLink.titulo || !newLink.url}>Guardar Link</Button>
                        </div>
                    </div>
                )}

                {displayLinks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {displayLinks.map((link, idx) => (
                            <div key={link.id || idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <Link2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-slate-900 truncate">{link.titulo}</p>
                                        <p className="text-xs text-slate-500 truncate">{link.url}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <button
                                        onClick={() => handleRemoveLink(link)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !showAddLink && (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-sm text-slate-400">No hay links agregados</p>
                        </div>
                    )
                )}
            </div>

            {/* MODAL DE PREVISUALIZACIÓN */}
            <Modal
                isOpen={!!previewImage}
                onClose={() => setPreviewImage(null)}
                title={previewImage?.title || 'Previsualización'}
                size="lg"
            >
                <div className="flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden min-h-[300px]">
                    {previewImage && (
                        <img
                            src={previewImage.url}
                            alt={previewImage.title}
                            className="max-w-full max-h-[70vh] object-contain shadow-lg"
                        />
                    )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={() => setPreviewImage(null)}>
                        Cerrar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            const archivo = archivos.find(a => a.nombre_archivo === previewImage?.title);
                            if (archivo) handleDownload(archivo);
                        }}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar Original
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
