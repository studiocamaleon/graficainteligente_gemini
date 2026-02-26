import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { StepProgressIndicator } from './StepProgressIndicator';
import { useStepExecution } from '../../hooks/useStepExecution';
import { useOrdenItemRutas } from '../../hooks/useOrdenItemRutas';
import type { JobItem } from '../../hooks/useProductionJobs';
import {
  AlertCircle,
  CalendarClock,
  Download,
  Eye,
  FileImage,
  FileText,
  Hash,
  Loader2,
  Package,
  Truck,
  User,
  X,
} from 'lucide-react';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { InfoDialog } from '../ui/InfoDialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ItemConfigRenderer } from '../orders/ItemConfigRenderer';
import { useAuth } from '../../hooks/useAuth';
import { ordenarRutasPorEtapaYOrden } from '../../utils/productionUtils';
import type { OrdenItemRuta } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useInfoDialog } from '../../hooks/useInfoDialog';

interface JobExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobItem;
  onOptimisticUpdate?: (jobId: string, patch: Partial<JobItem>) => void;
}

type SidePanelMode = 'none' | 'summary';

interface OrderAttachment {
  id: string;
  nombre_archivo: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  created_at: string;
}

interface OrderContext {
  notas_internas: string | null;
  estado_orden: string;
  fecha_estimada_entrega: string | null;
  canal_venta: string | null;
  requiere_despacho: boolean;
  item_detalle: {
    id: string;
    producto_nombre: string;
    producto_categoria: string | null;
    tipo_item: string | null;
    descripcion: string | null;
    cantidad: number;
    precio_total: number;
    configuracion: any;
  } | null;
  adjuntos_count: number;
  adjuntos: OrderAttachment[];
}

const etapaLabels: Record<string, string> = {
  pre_prensa: 'Pre-Prensa',
  principal: 'Producción',
  post_prensa: 'Post-Prensa',
  instalacion: 'Instalación',
};

const etapaColors: Record<string, string> = {
  pre_prensa: 'bg-slate-100 text-slate-700 border-slate-200',
  principal: 'bg-slate-100 text-slate-700 border-slate-200',
  post_prensa: 'bg-slate-100 text-slate-700 border-slate-200',
  instalacion: 'bg-slate-100 text-slate-700 border-slate-200',
};

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  pausado: 'Pausado',
  completado: 'Completado',
  omitido: 'Omitido',
};

const estadoOrdenLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  finalizada: 'Finalizada',
  entregada: 'Entregada',
  cancelada: 'Cancelada',
};

const estadoColor: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700 border-slate-200',
  en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
  pausado: 'bg-amber-100 text-amber-700 border-amber-200',
  completado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  omitido: 'bg-orange-100 text-orange-700 border-orange-200',
};

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function bytesToLabel(sizeInBytes: number): string {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) return '0 KB';
  const kb = sizeInBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatOrderStatusLabel(status?: string | null): string {
  if (!status) return '-';
  if (estadoOrdenLabel[status]) return estadoOrdenLabel[status];
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function canPreviewAttachment(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

function getAttachmentIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return FileImage;
  }
  return FileText;
}

export function JobExecutionModal({ isOpen, onClose, job, onOptimisticUpdate }: JobExecutionModalProps) {
  const { profile } = useAuth();
  const { rutas, refetch } = useOrdenItemRutas({ ordenItemId: job.id });
  const { completeStep, getActiveStep, canStartStep, loading } = useStepExecution();
  const { createSignedUrl, downloadFile } = useFileUpload();
  const {
    showConfirm,
    dialogState: confirmDialogState,
    closeDialog: closeConfirmDialog,
    handleConfirm,
    isLoading: isConfirmLoading,
  } = useConfirmDialog();
  const {
    dialogState: infoDialogState,
    closeDialog: closeInfoDialog,
    showWarning,
    showError,
  } = useInfoDialog();

  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>('none');
  const [orderContextLoading, setOrderContextLoading] = useState(false);
  const [orderContextError, setOrderContextError] = useState<string | null>(null);
  const [orderContext, setOrderContext] = useState<OrderContext | null>(null);
  const [showFullNotes, setShowFullNotes] = useState(false);
  const [attachmentActionLoading, setAttachmentActionLoading] = useState<string | null>(null);

  const activeStep = getActiveStep(rutas);
  const isSidePanelOpen = sidePanelMode !== 'none';

  const loadOrderContext = useCallback(async () => {
    setOrderContextLoading(true);
    setOrderContextError(null);
    try {
      const [orderRes, archivosRes, itemRes] = await Promise.all([
        supabase
          .from('ordenes_trabajo')
          .select(
            'id, estado, fecha_estimada_entrega, canal_venta, requiere_despacho, notas_internas'
          )
          .eq('id', job.orden_id)
          .maybeSingle(),
        supabase
          .from('ordenes_trabajo_archivos')
          .select('id, nombre_archivo, tipo_mime, tamano_bytes, storage_path, created_at')
          .eq('orden_id', job.orden_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('ordenes_trabajo_items')
          .select('id, producto_nombre, producto_categoria, tipo_item, descripcion, cantidad, precio_total, configuracion')
          .eq('id', job.id)
          .maybeSingle(),
      ]);

      if (orderRes.error) throw orderRes.error;
      if (archivosRes.error) throw archivosRes.error;
      if (itemRes.error) throw itemRes.error;
      if (!orderRes.data) throw new Error('No se encontró la orden para este item.');

      const orderData = orderRes.data as any;
      const itemData = (itemRes.data as any) || null;
      const adjuntos = (archivosRes.data || []) as OrderAttachment[];

      setOrderContext({
        notas_internas: orderData.notas_internas,
        estado_orden: orderData.estado || 'pendiente',
        fecha_estimada_entrega: orderData.fecha_estimada_entrega,
        canal_venta: orderData.canal_venta,
        requiere_despacho: Boolean(orderData.requiere_despacho),
        item_detalle: itemData
          ? {
              id: itemData.id,
              producto_nombre: itemData.producto_nombre || job.producto_nombre || 'Producto',
              producto_categoria: itemData.producto_categoria,
              tipo_item: itemData.tipo_item,
              descripcion: itemData.descripcion,
              cantidad: Number(itemData.cantidad || job.cantidad || 0),
              precio_total: Number(itemData.precio_total || 0),
              configuracion: itemData.configuracion || {},
            }
          : null,
        adjuntos_count: adjuntos.length,
        adjuntos,
      });
    } catch (err) {
      console.error('Error loading order context:', err);
      setOrderContextError(err instanceof Error ? err.message : 'No se pudo cargar el contexto de la orden.');
    } finally {
      setOrderContextLoading(false);
    }
  }, [job.orden_id, job.id, job.producto_nombre, job.cantidad]);

  useEffect(() => {
    if (!isOpen) {
      setSidePanelMode('none');
      setShowFullNotes(false);
      setAttachmentActionLoading(null);
      return;
    }

    refetch();
    void loadOrderContext();
  }, [isOpen, loadOrderContext, refetch]);

  const buildRelevantStep = (allRutas: OrdenItemRuta[]) => {
    const rutasOrdenadas = ordenarRutasPorEtapaYOrden(allRutas);
    const pasoPausado = rutasOrdenadas.find((r) => r.estado_paso === 'pausado');
    if (pasoPausado) {
      return { nombre: pasoPausado.paso_nombre, estado: 'pausado' as const, etapa: pasoPausado.tipo_etapa };
    }
    const pasoEnProceso = rutasOrdenadas.find((r) => r.estado_paso === 'en_proceso');
    if (pasoEnProceso) {
      return { nombre: pasoEnProceso.paso_nombre, estado: 'en_proceso' as const, etapa: pasoEnProceso.tipo_etapa };
    }
    const pasoPendiente = rutasOrdenadas.find((r) => r.estado_paso === 'pendiente');
    if (pasoPendiente) {
      return { nombre: pasoPendiente.paso_nombre, estado: 'pendiente' as const, etapa: pasoPendiente.tipo_etapa };
    }
    return null;
  };

  const handleCompleteStep = async (rutaId: string) => {
    const confirmed = await showConfirm({
      title: '¿Marcar paso como completado?',
      message: 'Se registrará responsable, fecha y hora de finalización.',
      confirmText: 'Marcar completado',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    const result = await completeStep(rutaId, job.id);

    if (result.success) {
      const nowIso = new Date().toISOString();
      const rutasOptimisticas = rutas.map((ruta) =>
        ruta.id === rutaId
          ? {
              ...ruta,
              estado_paso: 'completado' as const,
              fecha_inicio: ruta.fecha_inicio || nowIso,
              fecha_fin: nowIso,
              responsable_id: profile?.id || ruta.responsable_id,
              responsable_nombre: profile?.full_name || ruta.responsable_nombre,
            }
          : ruta
      ) as OrdenItemRuta[];

      const totalPasos = rutasOptimisticas.length;
      const pasosCompletados = rutasOptimisticas.filter(
        (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
      ).length;
      const pasosEnProceso = rutasOptimisticas.filter((r) => r.estado_paso === 'en_proceso').length;
      const pasosPendientes = rutasOptimisticas.filter((r) => r.estado_paso === 'pendiente').length;
      const todosPasosResueltos = totalPasos > 0 && pasosCompletados === totalPasos;

      onOptimisticUpdate?.(job.id, {
        estado: todosPasosResueltos ? 'finalizado' : 'en_proceso',
        total_pasos: totalPasos,
        pasos_completados: pasosCompletados,
        pasos_en_proceso: pasosEnProceso,
        pasos_pendientes: pasosPendientes,
        progreso_porcentaje: totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0,
        paso_relevante: buildRelevantStep(rutasOptimisticas),
        updated_at: nowIso,
      });

      await refetch();

      if (result.ordenCambioAFinalizada && result.ordenRequiereDespacho) {
        const numeroOrden = result.ordenNumero || job.numero_orden;
        showWarning(
          'Orden finalizada con despacho',
          `La orden #${numeroOrden} quedó finalizada y requiere despacho.\nPreparar empaque para entrega.`
        );
      }
    } else {
      showError('No se pudo finalizar el paso', result.error || 'Error desconocido al completar el paso.');
    }
  };

  const handleToggleSidePanel = (mode: 'summary') => {
    setSidePanelMode((prev) => (prev === mode ? 'none' : mode));
  };

  const handlePreviewAttachment = async (attachment: OrderAttachment) => {
    if (!canPreviewAttachment(attachment.tipo_mime)) return;
    try {
      setAttachmentActionLoading(attachment.id);
      const signedUrl = await createSignedUrl(attachment.storage_path, 'ordenes-trabajo-archivos', 3600);
      if (!signedUrl) {
        throw new Error('No se pudo generar enlace de previsualización');
      }
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error previewing attachment:', err);
      alert('No se pudo abrir el adjunto.');
    } finally {
      setAttachmentActionLoading(null);
    }
  };

  const handleDownloadAttachment = async (attachment: OrderAttachment) => {
    try {
      setAttachmentActionLoading(attachment.id);
      await downloadFile(attachment.storage_path, attachment.nombre_archivo, 'ordenes-trabajo-archivos');
    } catch (err) {
      console.error('Error downloading attachment:', err);
      alert('No se pudo descargar el adjunto.');
    } finally {
      setAttachmentActionLoading(null);
    }
  };

  const rutasPorEtapa = rutas.reduce((acc, ruta) => {
    if (!acc[ruta.tipo_etapa]) {
      acc[ruta.tipo_etapa] = [];
    }
    acc[ruta.tipo_etapa].push(ruta);
    return acc;
  }, {} as Record<string, typeof rutas>);

  Object.keys(rutasPorEtapa).forEach((etapa) => {
    rutasPorEtapa[etapa].sort((a, b) => a.orden - b.orden);
  });

  const ordenEtapas = ['pre_prensa', 'principal', 'post_prensa', 'instalacion'];

  const notesPreview = useMemo(() => {
    const notes = (orderContext?.notas_internas || '').trim();
    if (!notes) return 'Sin notas internas';
    if (showFullNotes || notes.length <= 220) return notes;
    return `${notes.slice(0, 220)}...`;
  }, [orderContext?.notas_internas, showFullNotes]);

  const sidePanelContent = (
    <div className="flex h-full flex-col bg-slate-50/70">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">
            Resumen de orden
          </p>
          <button
            onClick={() => setSidePanelMode('none')}
            className="rounded-md px-2 py-1 text-xs text-slate-200 hover:bg-white/10 hover:text-white"
          >
            Cerrar
          </button>
        </div>
      </div>

      {orderContextLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando contexto...
          </div>
        </div>
      ) : orderContextError ? (
        <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {orderContextError}
        </div>
      ) : !orderContext ? (
        <div className="m-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          No hay información de orden disponible.
        </div>
      ) : sidePanelMode === 'summary' ? (
        <div className="space-y-4 p-5">
          {orderContext.item_detalle && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">
                  {orderContext.item_detalle.producto_nombre || 'Producto'}
                </h4>
                {job.identificador_interno && (
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {job.identificador_interno}
                  </span>
                )}
                {(orderContext.item_detalle.tipo_item === 'centro_copiado' ||
                  orderContext.item_detalle.producto_categoria === 'Centro de Copiado') ? (
                  <Badge variant="blue" className="text-xs">
                    Centro de Copiado
                  </Badge>
                ) : (
                  <>
                    {orderContext.item_detalle.producto_categoria && (
                      <Badge variant="default" className="text-xs">
                        {orderContext.item_detalle.producto_categoria}
                      </Badge>
                    )}
                    {orderContext.item_detalle.tipo_item === 'personalizado' && (
                      <Badge variant="purple" className="text-xs">
                        Personalizado
                      </Badge>
                    )}
                  </>
                )}
              </div>

              <div className="py-2">
                <ItemConfigRenderer
                  config={orderContext.item_detalle.configuracion}
                  tipoItem={orderContext.item_detalle.tipo_item || undefined}
                  rutasGeneradas={rutas}
                />
              </div>

              {orderContext.item_detalle.tipo_item === 'personalizado' &&
                orderContext.item_detalle.descripcion &&
                !orderContext.item_detalle.configuracion?.descripcion && (
                  <div className="mt-2 rounded border border-gray-100 bg-gray-50 p-3 text-sm italic text-gray-600">
                    {orderContext.item_detalle.descripcion}
                  </div>
                )}

              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-sm text-gray-600">
                  Cantidad: <span className="font-semibold text-gray-900">{orderContext.item_detalle.cantidad} unidades</span>
                </span>
                <span className="text-base font-bold text-blue-600">
                  {formatMoney(orderContext.item_detalle.precio_total)}
                </span>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Notas internas</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{notesPreview}</p>
            {orderContext.notas_internas && orderContext.notas_internas.trim().length > 220 && (
              <button
                onClick={() => setShowFullNotes((prev) => !prev)}
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showFullNotes ? 'Ver menos' : 'Ver completo'}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adjuntos</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {orderContext.adjuntos.length}
              </span>
            </div>
            {orderContext.adjuntos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                La orden no tiene adjuntos.
              </div>
            ) : (
              <div className="space-y-2">
                {orderContext.adjuntos.map((attachment) => {
                  const Icon = getAttachmentIcon(attachment.tipo_mime);
                  const canPreview = canPreviewAttachment(attachment.tipo_mime);
                  const isWorking = attachmentActionLoading === attachment.id;

                  return (
                    <div key={attachment.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                            <p className="truncate text-sm font-medium text-slate-900">{attachment.nombre_archivo}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {bytesToLabel(attachment.tamano_bytes)} · {formatDateTime(attachment.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {canPreview && (
                            <button
                              onClick={() => void handlePreviewAttachment(attachment)}
                              disabled={isWorking}
                              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                              title="Ver"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => void handleDownloadAttachment(attachment)}
                            disabled={isWorking}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            title="Descargar"
                          >
                            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="md"
        showHeader={false}
        sidePanel={sidePanelContent}
        isSidePanelOpen={isSidePanelOpen}
      >
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
              aria-label="Cerrar modal"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-5 text-white shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/20 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-100">Contexto del item</p>
                <p className="mt-1 text-xs text-slate-200">Información rápida de la orden sin salir del flujo</p>
                {!orderContextLoading && orderContext?.requiere_despacho && (
                  <div className="mt-2">
                    <Badge variant="warning" className="inline-flex items-center gap-1 border-transparent bg-amber-100 text-amber-800">
                      <Truck className="h-3.5 w-3.5" />
                      Requiere despacho
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleSidePanel('summary')}
                  className={`relative rounded-lg border p-2 transition-colors ${
                    sidePanelMode === 'summary'
                      ? 'border-cyan-200 bg-cyan-100 text-slate-900'
                      : 'border-white/25 bg-white/10 text-slate-100 hover:bg-white/20'
                  }`}
                  title="Ver resumen y notas"
                >
                  <FileText className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-200" />
                    <p className="text-xs text-slate-200">Cliente</p>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{job.cliente_nombre}</p>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-slate-200" />
                    <p className="text-xs text-slate-200">Orden</p>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">#{job.numero_orden}</p>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-slate-200" />
                    <p className="text-xs text-slate-200">Producto</p>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{job.producto_nombre}</p>
                  {job.identificador_interno && (
                    <p className="mt-1 text-xs text-slate-100">
                      Identificador: <span className="font-medium text-white">{job.identificador_interno}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-200">Cantidad: {job.cantidad}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-200">Estado orden</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {orderContextLoading ? 'Cargando...' : formatOrderStatusLabel(orderContext?.estado_orden)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-200">Entrega</p>
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-sm font-semibold text-white">
                    <CalendarClock className="h-3.5 w-3.5 text-slate-200" />
                    <span className="truncate">
                      {orderContextLoading
                        ? 'Cargando...'
                        : orderContext?.fecha_estimada_entrega
                          ? formatDate(orderContext.fecha_estimada_entrega)
                          : '-'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-200">Adjuntos</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {orderContextLoading ? '...' : orderContext?.adjuntos_count || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <StepProgressIndicator rutas={rutas} currentStepId={activeStep?.id} />
          </div>

          {rutas.length === 0 ? (
            <div className="rounded-lg bg-gray-50 py-8 text-center">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <p className="text-gray-600">No hay pasos de producción definidos para este item.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordenEtapas.map((etapa) => {
                const rutasEtapa = rutasPorEtapa[etapa];
                if (!rutasEtapa || rutasEtapa.length === 0) return null;

                return (
                  <div key={etapa} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${etapaColors[etapa]}`}
                      >
                        {etapaLabels[etapa]}
                      </div>
                      <span className="text-xs text-slate-400">{rutasEtapa.length} pasos</span>
                    </div>
                    <div className="space-y-3">
                      {rutasEtapa.map((ruta) => {
                        const isActive = activeStep?.id === ruta.id;
                        const canComplete =
                          canStartStep(ruta, rutas) || ruta.estado_paso === 'en_proceso' || ruta.estado_paso === 'pausado';
                        const showAction = ruta.estado_paso !== 'completado' && ruta.estado_paso !== 'omitido';
                        const isCompleted = ruta.estado_paso === 'completado';

                        return (
                          <div
                            key={ruta.id}
                            className={`rounded-xl border p-3 transition-colors ${
                              isCompleted
                                ? 'border-emerald-300 bg-emerald-50 shadow-[0_10px_30px_rgba(5,150,105,0.08)]'
                                : isActive
                                  ? 'border-blue-300 bg-white ring-1 ring-blue-200 shadow-[0_10px_30px_rgba(37,99,235,0.1)]'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium text-slate-900">{ruta.paso_nombre}</p>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                      estadoColor[ruta.estado_paso] || estadoColor.pendiente
                                    }`}
                                  >
                                    {estadoLabel[ruta.estado_paso] || ruta.estado_paso}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {ruta.fecha_fin
                                    ? `Finalizado: ${formatDateTime(ruta.fecha_fin)}${ruta.responsable_nombre ? ` · ${ruta.responsable_nombre}` : ''}`
                                    : ruta.fecha_inicio
                                      ? `Iniciado: ${formatDateTime(ruta.fecha_inicio)}${ruta.responsable_nombre ? ` · ${ruta.responsable_nombre}` : ''}`
                                      : 'Sin registrar'}
                                </div>
                              </div>

                              {showAction && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCompleteStep(ruta.id)}
                                  disabled={!canComplete || loading}
                                  isLoading={loading}
                                  className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 md:w-auto"
                                >
                                  Finalizar
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={handleConfirm}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        confirmText={confirmDialogState.confirmText}
        cancelText={confirmDialogState.cancelText}
        variant={confirmDialogState.variant}
        isLoading={isConfirmLoading}
      />
      <InfoDialog
        isOpen={infoDialogState.isOpen}
        onClose={closeInfoDialog}
        title={infoDialogState.title}
        message={infoDialogState.message}
        variant={infoDialogState.variant}
        buttonText={infoDialogState.buttonText}
      />
    </>
  );
}
