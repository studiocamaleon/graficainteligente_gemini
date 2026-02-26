import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Switch } from '../../../components/ui/Switch';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit2,
  Ban,
  Share2,
  Check,
  FileText,
  Download,
  Trash2,
  Package,
  Truck,
  Route,
  Link as LinkIcon,
  CreditCard,
  History,
  MessageSquarePlus,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useAuth } from '../../../hooks/useAuth';
import { canManagePaymentsRole, canRegisterPaymentsRole, isWorkshopOperatorRole } from '../../../utils/roles';
import { useOrdenTrabajo } from '../../../hooks/useOrdenTrabajo';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { OrderStatusBadge } from '../../../components/orders/OrderStatusBadge';
import { ChannelBadge } from '../../../components/orders/ChannelBadge';
import { OrderProductionRouteTab } from '../../../components/orders/OrderProductionRouteTab';
import { OrdenAdjuntosSection } from '../../../components/orders/OrdenAdjuntosSection';
import { OrdenPagosTab } from '../../../components/orders/OrdenPagosTab';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import { OrdenCopiadoAsociadaCard } from '../../../components/orders/OrdenCopiadoAsociadaCard';
import { useToast } from '../../../contexts/ToastContext';
import { descargarFactura } from '../../../utils/facturaHelpers';
import { ItemConfigRenderer } from '../../../components/orders/ItemConfigRenderer';
import { ShippingLabelModal } from '../../../components/orders/ShippingLabelModal';
import { clampZeroMoney, roundMoney, toMoney } from '../../../utils/money';
import { formatDateTimeDisplay } from '../../../utils/dates';

type TabKey = 'items' | 'ruta' | 'adjuntos' | 'pagos' | 'historial';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, company } = useAuth();
  const {
    getOrdenById,
    deleteOrden,
    changeEstado,
    addPago,
    updatePago,
    deletePago,
    addNota,
    desvincularOrdenCopiado,
    updateOrden,
    loading,
    error: ordenTrabajoError,
  } = useOrdenTrabajo();
  const { showSuccess, showError } = useToast();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  const handleToggleFactura = async (checked: boolean) => {
    if (!orden) return;

    // Constraint: Validar si ya tiene factura
    if (orden.numero_factura && !checked) {
      showError('No se puede desactivar la opción porque ya existe una factura generada.');
      return;
    }

    // Constraint: Check OC invoice as well
    if (orden.ordenCopiado?.numero_factura && !checked) {
      showError(`La orden de copiado asociada ya tiene factura (${orden.ordenCopiado.numero_factura}).`);
      return;
    }

    let newOrdenCopiadoTotal = 0;

    // 1. Handle Copy Order if exists (Sync Logic)
    if (orden.ordenCopiado) {
      // Calculate OC totals from items (runtime check for items existence)
      const ocItems = (orden.ordenCopiado as any).items || [];
      const ocSubtotal = ocItems.reduce((acc: number, item: any) =>
        acc + (Number(item.subtotal) || 0), 0);

      const ocIva = checked ? ocSubtotal * 0.21 : 0;
      newOrdenCopiadoTotal = ocSubtotal + ocIva;

      // Update linked OC
      const { error: ocError } = await (supabase
        .from('centro_copiado_ordenes') as any)
        .update({
          requiere_factura: checked,
          total: newOrdenCopiadoTotal
        })
        .eq('id', orden.ordenCopiado.id);

      if (ocError) {
        console.error('Error updating linked OC:', ocError);
        showError('Error al actualizar orden de copiado asociada');
        return;
      }
    }

    // 2. Handle Work Order
    // Calculate OT base amounts
    const subtotal = Number(orden.subtotal || 0);
    const totalDescuentos = Number(orden.total_descuentos || 0);
    const baseImponible = subtotal - totalDescuentos;

    // Calculate OT specific Tax
    const newIva = checked ? baseImponible * 0.21 : 0;

    // Calculate Final Total: OT Base + OT Tax + NEW OC Total
    // NOTE: This assumes OT Total should aggregately include OC Total.
    const newTotal = baseImponible + newIva + newOrdenCopiadoTotal;

    const success = await updateOrden(orden.id, {
      requiere_factura: checked,
      subtotal_iva: newIva,
      total: newTotal
    });

    if (success) {
      showSuccess('Orden actualizada correctamente');
      loadOrden();
    } else {
      showError('No se pudo actualizar la orden');
    }
  };

  const [orden, setOrden] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('items');
  const [loadingData, setLoadingData] = useState(true);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [editingPago, setEditingPago] = useState<any>(null);
  const [downloadingFactura, setDownloadingFactura] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [adjuntosCount, setAdjuntosCount] = useState(0);
  const [showShippingLabelModal, setShowShippingLabelModal] = useState(false);

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const canViewPrices = !isWorkshopOperatorRole(profile?.role);
  const canRegisterPayments = canRegisterPaymentsRole(profile?.role);
  const canManagePayments = canManagePaymentsRole(profile?.role);

  usePageHeader(orden ? `Orden ${orden.numero_orden}` : 'Cargando orden...');

  useEffect(() => {
    if (id) {
      loadOrden();
    }
  }, [id]);

  const loadOrden = async () => {
    if (!id) return;

    setLoadingData(true);
    const data = await getOrdenById(id);
    if (data) {
      setOrden(data);
    } else {
      setOrden(null);
    }
    setLoadingData(false);
  };

  const canDelete = useMemo(() => {
    return false;
  }, []);

  const canCancel = useMemo(() => {
    if (!orden) return false;
    if (orden.estado === 'finalizada' || orden.estado === 'cancelada') return false;
    if (orden.estado === 'pendiente') return true;
    if (orden.estado === 'en_proceso') return isAdmin;
    return false;
  }, [orden, isAdmin]);

  const canGenerateShippingLabel = useMemo(() => {
    if (!orden) return false;
    return (
      Boolean(orden.requiere_despacho) &&
      (orden.estado === 'finalizada' || orden.estado === 'entregada')
    );
  }, [orden]);



  const handleCopyTrackingLink = async () => {
    if (!orden?.tracking_token) return;

    const trackingUrl = `${window.location.origin}/track/${orden.tracking_token}`;

    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    } catch (error) {
      console.error('Error al copiar el enlace:', error);
    }
  };

  const handleDescargarFactura = async () => {
    if (!orden?.facturaStoragePath || !orden?.numero_factura) {
      showError('No hay factura disponible para descargar');
      return;
    }

    setDownloadingFactura(true);
    try {
      const resultado = await descargarFactura(
        orden.facturaStoragePath,
        orden.numero_factura
      );

      if (resultado.success) {
        showSuccess('Factura descargada correctamente');
      } else {
        showError(resultado.error || 'Error al descargar la factura');
      }
    } catch (error) {
      console.error('Error descargando factura:', error);
      showError('Error inesperado al descargar la factura');
    } finally {
      setDownloadingFactura(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    confirmAction({
      title: 'Eliminar orden',
      message: '¿Estás seguro de que deseas eliminar esta orden? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      variant: 'danger',
      onConfirm: async () => {
        const success = await deleteOrden(id);
        if (success) {
          navigate('/app/orders/ordenes');
        }
      },
    });
  };

  const handleCancel = async () => {
    if (!id) return;

    confirmAction({
      title: 'Cancelar orden',
      message: '¿Estás seguro de que deseas cancelar esta orden?',
      confirmText: 'Cancelar Orden',
      variant: 'danger',
      onConfirm: async () => {
        const success = await changeEstado(id, 'cancelada');
        if (success) {
          await loadOrden();
        }
      },
    });
  };

  const handleAgregarPago = () => {
    if (!canRegisterPayments) {
      showError('El rol Operador de taller no puede registrar pagos.');
      return;
    }
    setEditingPago(null);
    setShowPagoModal(true);
  };

  const handleEditarPago = (pago: any) => {
    if (!canManagePayments) {
      showError('Solo superadmin puede editar pagos registrados.');
      return;
    }
    setEditingPago(pago);
    setShowPagoModal(true);
  };

  const handleSubmitPago = async (pagoData: any): Promise<boolean> => {
    if (!id) return false;

    try {
      if (editingPago) {
        const success = await updatePago(editingPago.id, id, pagoData);
        if (success) {
          showSuccess('Pago actualizado correctamente');
          await loadOrden();
          return true;
        }
        showError('Error al actualizar el pago');
        return false;
      } else {
        const success = await addPago(id, pagoData);
        if (success) {
          showSuccess('Pago registrado correctamente');
          await loadOrden();
          return true;
        }
        showError('Error al registrar el pago');
        return false;
      }
    } catch (error) {
      console.error('Error en pago:', error);
      showError(error instanceof Error ? error.message : 'Error al procesar el pago');
      return false;
    }
  };

  const handleEliminarPago = async (pagoId: string) => {
    if (!canManagePayments) {
      showError('Solo superadmin puede eliminar pagos registrados.');
      return;
    }
    if (!id) return;

    const success = await deletePago(pagoId, id);
    if (success) {
      showSuccess('Pago eliminado correctamente');
      await loadOrden();
    } else {
      showError(ordenTrabajoError || 'Error al eliminar el pago');
    }
  };




  const handleDesvincularOrdenCopiado = async () => {
    if (!id) return;

    const success = await desvincularOrdenCopiado(id);
    if (success) {
      showSuccess('Orden de copiado desvinculada correctamente');
      await loadOrden();
    } else {
      showError('Error al desvincular orden de copiado');
    }
  };

  const handleAddNote = async () => {
    if (!orden?.id || !newNoteText.trim()) return;

    setAddingNote(true);
    const ok = await addNota(orden.id, newNoteText);
    if (ok) {
      setNewNoteText('');
      showSuccess('Nota agregada');
      await loadOrden();
    } else {
      showError(ordenTrabajoError || 'No se pudo agregar la nota');
    }
    setAddingNote(false);
  };

  const totalPagado = useMemo(() => {
    if (!orden?.pagos) return 0;
    return roundMoney(orden.pagos.reduce((sum: number, pago: any) => sum + toMoney(pago.monto), 0));
  }, [orden]);

  const saldoPendiente = useMemo(() => {
    if (!orden) return 0;
    return clampZeroMoney(roundMoney(toMoney(orden.total)) - roundMoney(totalPagado));
  }, [orden, totalPagado]);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('es-AR');
  };

  const ocSubtotal = Number((orden?.ordenCopiado as any)?.items?.reduce((acc: number, i: any) => acc + (Number(i.subtotal) || 0), 0) || 0);
  const subtotal = Number(orden?.subtotal || 0);
  const descuentos = Number(orden?.total_descuentos || 0);
  const baseImponible = subtotal + ocSubtotal - descuentos;
  const ivaTotal = Number(orden?.subtotal_iva || 0) + (orden?.ordenCopiado?.total ? (Number(orden.ordenCopiado.total) - ocSubtotal) : 0);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (!orden) {
    return (
      <EmptyState
        icon={Package}
        title="Orden no encontrada"
        description="No se pudo cargar la información de esta orden"
        action={
          <Button variant="primary" onClick={() => navigate('/app/orders/ordenes')}>
            Volver al listado
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/orders/ordenes')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>

            <div className="flex items-center gap-3">
              {canGenerateShippingLabel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShippingLabelModal(true)}
                  className="bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-700"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Generar etiqueta de envío
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/orders/editar-ot/${id}`)}
                className="bg-white border-blue-200 hover:bg-blue-50 text-blue-700"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Editar Orden
              </Button>
              {orden.tracking_token && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyTrackingLink}
                  className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 hover:border-cyan-400 text-cyan-700"
                >
                  {copiedTracking ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-green-600" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Compartir Tracking
                    </>
                  )}
                </Button>
              )}

              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              )}

              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                  Eliminar
                </Button>
              )}


            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Orden {orden.numero_orden}
              </h1>
              <OrderStatusBadge estado={orden.estado} size="md" />
              {orden.requiere_factura && (
                <Badge variant={orden.facturada ? 'success' : 'warning'}>
                  {orden.facturada ? '✓ Facturada' : 'Requiere Factura'}
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cliente</p>
                <p className="text-base font-semibold text-slate-900">{orden.cliente?.nombre_fantasia || orden.cliente?.razon_social || '-'}</p>
                <p className="text-sm text-slate-500">{orden.cliente?.numero_documento || '-'}</p>
              </div>
              <div className="px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Canal de venta</p>
                <div className="mt-2">
                  <ChannelBadge canal={orden.canal_venta} showLabel />
                </div>
              </div>
              <div className="px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Creado por</p>
                <div className="mt-2 flex items-center gap-2">
                  <Avatar
                    src={orden.created_by_profile?.avatar_url}
                    name={orden.created_by_profile?.full_name}
                    size="sm"
                  />
                  <span className="text-base text-slate-900">{orden.created_by_profile?.full_name || '-'}</span>
                </div>
              </div>
              <div className="px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fechas</p>
                <div className="mt-1 space-y-1 text-sm">
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-600">Creada:</span>{' '}
                    <span className="text-slate-900">{formatDate(orden.fecha_creacion)}</span>
                  </p>
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-600">Entrega estimada:</span>{' '}
                    <span className="text-slate-900">{formatDate(orden.fecha_estimada_entrega)}</span>
                  </p>
                </div>
                {orden.facturada && orden.numero_factura && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <FileText className="w-4 h-4" />
                    <span>Factura N° {orden.numero_factura}</span>
                    {orden.fecha_facturacion && <span>• Facturada: {formatDate(orden.fecha_facturacion)}</span>}
                    {orden.facturaStoragePath && (
                      <button
                        onClick={handleDescargarFactura}
                        disabled={downloadingFactura}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Descargar factura"
                      >
                        <Download className={`w-4 h-4 text-blue-600 ${downloadingFactura ? 'animate-bounce' : ''}`} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-amber-50 rounded-lg border border-amber-200 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-medium text-amber-900">Notas Internas</h3>
            </div>

            <div className="space-y-2">
              {(orden.notas && orden.notas.length > 0) ? (
                orden.notas.map((note: any) => (
                  <div key={note.id} className="rounded-lg border border-amber-200 bg-white p-3">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.nota}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      {note.author_name || note.author_email || 'Usuario'} · {formatDateTimeDisplay(note.created_at)}
                    </div>
                  </div>
                ))
              ) : orden.notas_internas ? (
                <div className="rounded-lg border border-amber-200 bg-white p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{orden.notas_internas}</p>
                  <div className="mt-2 text-xs text-gray-500">Nota legacy</div>
                </div>
              ) : (
                <p className="text-sm text-amber-900">Sin notas cargadas.</p>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">Agregar nota</label>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                rows={3}
                placeholder="Escribí una nota interna..."
                className="w-full rounded-md border border-amber-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={addingNote || !newNoteText.trim()}
                >
                  <MessageSquarePlus className="w-4 h-4 mr-2" />
                  {addingNote ? 'Guardando...' : 'Agregar nota'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="border-b border-slate-200">
        <nav className="flex gap-8 px-2 overflow-x-auto">
          {[
            { key: 'items' as const, label: 'Items', icon: Package, count: orden.items?.length || 0 },
            { key: 'ruta' as const, label: 'Ruta de Producción', icon: Route },
            { key: 'adjuntos' as const, label: 'Adjuntos', icon: LinkIcon, count: adjuntosCount },
            ...(canViewPrices ? [{ key: 'pagos' as const, label: 'Pagos', icon: CreditCard, count: orden.pagos?.length || 0 }] : []),
            { key: 'historial' as const, label: 'Historial', icon: History },
          ].map((tab) => {
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <Card>
        {activeTab === 'items' && (
          <div className="p-6">
            {!orden.items || orden.items.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No hay items en esta orden"
                description="Esta orden no tiene productos asociados"
              />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Items de la orden ({orden.items.length})
                    </h3>

                    <div className="space-y-3 mt-4">
                      {orden.items.map((item: any, index: number) => {
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                          >
                          {/* Línea 1: Número + Nombre + Categorías */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                            <h4 className="font-semibold text-gray-900">
                              {item.producto_nombre || 'Producto'}
                            </h4>
                            {item.configuracion?.identificador_interno && (
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {item.configuracion.identificador_interno}
                              </span>
                            )}
                            {/* Clasificación de Categoría y Tipo */}
                            {(item.tipo_item === 'centro_copiado' || item.producto_categoria === 'Centro de Copiado' || item.categoria_id === 'centro_copiado') ? (
                              <Badge variant="blue" className="bg-blue-100 text-blue-800 text-xs">
                                Centro de Copiado
                              </Badge>
                            ) : (
                              <>
                                {item.producto_categoria && (
                                  <Badge variant="default" className="text-xs">
                                    {item.producto_categoria}
                                  </Badge>
                                )}
                                {item.tipo_item === 'personalizado' && (
                                  <Badge variant="purple" className="text-xs">
                                    Personalizado
                                  </Badge>
                                )}
                              </>
                            )}
                            {/* Servicios Check */}
                            {orden.servicios?.some((s: any) => s.metadata?.linked_item_ids?.includes(item.id)) && (
                              <Badge variant="warning" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                + Servicios
                              </Badge>
                            )}
                          </div>

                          {/* Renderizado Unificado de Configuración */}
                          <div className="py-2">
                            <ItemConfigRenderer
                              config={item.configuracion}
                              tipoItem={item.tipo_item}
                              rutasGeneradas={item.rutas}
                            />
                          </div>

                          {/* Descripción para Personalizados (si no está contenida en config) */}
                          {item.tipo_item === 'personalizado' && item.descripcion && !item.configuracion?.descripcion && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 italic">
                              {item.descripcion}
                            </div>
                          )}

                          {/* Línea final: Cantidad y Total */}
                          <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
                            <span className="text-sm text-gray-600">
                              Cantidad: <span className="font-semibold text-gray-900">{item.cantidad} unidades</span>
                            </span>
                            {canViewPrices && (
                              <span className="text-lg font-bold text-blue-600">
                                ${Number(item.precio_total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Servicios Adicionales */}
                  {orden.servicios && orden.servicios.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full inline-block"></span>
                        Servicios Adicionales ({orden.servicios.length})
                      </h3>
                      <div className="space-y-3">
                        {orden.servicios.map((servicio: any, index: number) => {
                          // Encontrar items vinculados si existen en metadata
                          const linkedItemIds = servicio.metadata?.linked_item_ids || [];
                          const linkedItemsNames = orden.items
                            ? orden.items
                              .filter((item: any) => linkedItemIds.includes(item.id))
                              .map((item: any) => item.producto_nombre)
                            : [];

                          return (
                            <div
                              key={servicio.id || index}
                              className="p-4 bg-white rounded-lg border border-gray-200"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                                <h4 className="font-semibold text-gray-900">
                                  {servicio.descripcion || 'Servicio sin descripción'}
                                </h4>
                                <Badge variant="blue" className="bg-blue-50 text-blue-700 border-blue-100 text-xs">
                                  Servicio Adicional
                                </Badge>
                              </div>

                              {linkedItemsNames.length > 0 && (
                                <div className="mb-3 py-1 px-2 bg-gray-50 rounded text-xs text-gray-600 inline-flex items-center">
                                  <span className="font-medium mr-1">Aplicado a:</span>
                                  {linkedItemsNames.join(', ')}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
                                <span className="text-sm text-gray-600">
                                  Cantidad: <span className="font-semibold text-gray-900">{servicio.cantidad}</span>
                                </span>
                                {canViewPrices && (
                                  <span className="text-lg font-bold text-blue-600">
                                    ${Number(servicio.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Orden de Copiado Asociada */}
                  {orden.ordenCopiado && (
                    <div className="mt-6">
                      <OrdenCopiadoAsociadaCard
                        ordenCopiado={orden.ordenCopiado}
                        numeroOrdenTrabajo={orden.numero_orden}
                        onDesvincular={handleDesvincularOrdenCopiado}
                        canDesvincular={isAdmin || profile?.role === 'operador_diseno'}
                        totalOrdenTrabajo={orden.total}
                        totalPagado={orden.pagos?.reduce((acc: number, p: any) => acc + Number(p.monto), 0) || 0}
                      />
                    </div>
                  )}

                </div>

                {canViewPrices && (
                  <div className="xl:sticky xl:top-4 h-fit rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="text-sm font-medium text-slate-700">Requiere factura</span>
                      <Switch
                        checked={orden.requiere_factura}
                        onChange={handleToggleFactura}
                        label=""
                      />
                    </div>
                    <div className="flex justify-between items-center text-base">
                      <span className="text-slate-700">Subtotal:</span>
                      <span className="font-semibold text-slate-900">
                        ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-700">Base Imponible:</span>
                        <span className="font-medium text-slate-900">
                          ${baseImponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-700">IVA (21%):</span>
                        <span className="font-medium text-slate-900">
                          ${ivaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-300 pt-3 flex justify-between items-center">
                      <span className="text-slate-900">Total:</span>
                      <span className="text-2xl font-bold text-slate-900">
                        ${Number(orden.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {
          activeTab === 'ruta' && (
            <div className="p-6">
              {!orden.items || orden.items.length === 0 ? (
                <EmptyState
                  icon={Route}
                  title="No hay items para mostrar rutas"
                  description="Esta orden no tiene productos con rutas de producción"
                />
              ) : (
                <OrderProductionRouteTab items={orden.items} />
              )}
            </div>
          )
        }

        {
          activeTab === 'adjuntos' && (
            <div className="p-6">
              <OrdenAdjuntosSection
                ordenId={orden.id}
                onArchivosCountChange={setAdjuntosCount}
              />
            </div>
          )
        }

        {
          activeTab === 'pagos' && orden && (
            <div className="p-6">
              <OrdenPagosTab
                totales={{
                  subtotal: Number(orden.subtotal || 0),
                  descuentoAplicado: Number(orden.total_descuentos || 0),
                  subtotalConDescuento: Number(orden.subtotal || 0) - Number(orden.total_descuentos || 0),
                  iva: Number(orden.subtotal_iva || 0),
                  total: Number(orden.total || 0),
                }}
                pagos={orden.pagos || []}
                onAgregarPago={handleAgregarPago}
                onEditarPago={canManagePayments ? handleEditarPago : undefined}
                onEliminarPago={canManagePayments ? handleEliminarPago : undefined}
                ordenCopiado={orden.ordenCopiado}
                readOnly={!canRegisterPayments}
              />
            </div>
          )
        }

        {
          activeTab === 'historial' && (
            <div className="p-6">
              {!orden.historial || orden.historial.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No hay historial disponible"
                  description="Aún no se han registrado eventos para esta orden"
                />
              ) : (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Historial de eventos ({orden.historial.length})
                  </h3>

                  {orden.historial.map((evento: any, index: number) => (
                    <motion.div
                      key={evento.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                        <History className="w-5 h-5" />
                      </div>

                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{evento.descripcion}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(evento.created_at).toLocaleString('es-AR')}
                        </p>
                      </div>

                      <Badge variant="default">{evento.tipo_evento}</Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )
        }
      </Card >

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />

      <PagoFormModal
        isOpen={showPagoModal}
        onClose={() => setShowPagoModal(false)}
        onSubmit={handleSubmitPago}
        saldoPendiente={saldoPendiente}
        clientName={orden.cliente?.nombre || orden.cliente?.razon_social} // Pass Client Name
      />

      {orden && canGenerateShippingLabel && (
        <ShippingLabelModal
          isOpen={showShippingLabelModal}
          onClose={() => setShowShippingLabelModal(false)}
          companyData={{
            name: company?.name || 'Tu empresa',
            logoUrl: company?.logo_url || null,
            phone: company?.contact_phone || null,
            email: company?.contact_email || null,
            address: company?.address || null,
          }}
          orderData={{
            numeroOrden: orden.numero_orden || 'OT',
            clienteNombre:
              orden.cliente?.nombre_fantasia ||
              orden.cliente?.nombre ||
              orden.cliente?.razon_social ||
              'Cliente',
            requiereDespacho: Boolean(orden.requiere_despacho),
          }}
          defaultAddress={orden.cliente?.domicilio || null}
        />
      )}
    </div >
  );
}
