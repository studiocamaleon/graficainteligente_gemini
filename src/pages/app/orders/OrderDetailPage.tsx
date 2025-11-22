import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit2,
  Ban,
  Trash2,
  Calendar,
  User,
  DollarSign,
  Package,
  Route,
  CreditCard,
  History,
  Clock,
  FileText,
  Link as LinkIcon,
  Settings
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useAuth } from '../../../hooks/useAuth';
import { useOrdenTrabajo } from '../../../hooks/useOrdenTrabajo';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { OrderStatusBadge } from '../../../components/orders/OrderStatusBadge';
import { ChannelBadge } from '../../../components/orders/ChannelBadge';
import { OrderProductionRouteTab } from '../../../components/orders/OrderProductionRouteTab';
import { OrdenAdjuntosTab } from '../../../components/orders/OrdenAdjuntosTab';
import type { EstadoOrdenTrabajo } from '../../../types/database';

type TabKey = 'items' | 'ruta' | 'adjuntos' | 'pagos' | 'historial';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getOrdenById, deleteOrden, changeEstado, loading } = useOrdenTrabajo();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const [orden, setOrden] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('items');
  const [loadingData, setLoadingData] = useState(true);

  const isAdmin = profile?.role === 'superadmin' || profile?.role === 'admin';

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
      navigate('/app/orders/ordenes');
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

  const canChangeState = useMemo(() => {
    if (!orden) return false;
    if (orden.estado === 'finalizada' || orden.estado === 'cancelada') return false;
    return true;
  }, [orden]);

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

  const handleChangeEstado = async (nuevoEstado: EstadoOrdenTrabajo) => {
    if (!id || orden?.estado === nuevoEstado) return;

    const estadoLabels: Record<EstadoOrdenTrabajo, string> = {
      pendiente: 'Pendiente',
      en_proceso: 'En Proceso',
      finalizada: 'Finalizada',
      entregada: 'Entregada',
      cancelada: 'Cancelada',
    };

    confirmAction({
      title: 'Cambiar estado',
      message: `¿Deseas cambiar el estado de la orden a "${estadoLabels[nuevoEstado]}"?`,
      confirmText: 'Cambiar Estado',
      variant: 'info',
      onConfirm: async () => {
        const success = await changeEstado(id, nuevoEstado);
        if (success) {
          await loadOrden();
        }
      },
    });
  };

  const getAvailableStates = (): EstadoOrdenTrabajo[] => {
    if (!orden) return [];

    const currentState = orden.estado;

    if (currentState === 'pendiente') {
      return ['en_proceso'];
    }

    if (currentState === 'en_proceso') {
      return ['finalizada'];
    }

    if (currentState === 'finalizada') {
      return ['entregada'];
    }

    return [];
  };

  const totalPagado = useMemo(() => {
    if (!orden?.pagos) return 0;
    return orden.pagos.reduce((sum: number, pago: any) => sum + Number(pago.monto), 0);
  }, [orden]);

  const saldoPendiente = useMemo(() => {
    if (!orden) return 0;
    return Number(orden.total) - totalPagado;
  }, [orden, totalPagado]);

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
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/app/orders/ordenes')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Orden {orden.numero_orden}
                  </h1>
                  <OrderStatusBadge estado={orden.estado} size="lg" />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Creada: {new Date(orden.fecha_creacion).toLocaleDateString()}</span>
                  </div>
                  {orden.fecha_estimada_entrega && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Entrega: {new Date(orden.fecha_estimada_entrega).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canChangeState && getAvailableStates().length > 0 && (
                <div className="flex items-center gap-2">
                  {getAvailableStates().map((estado) => (
                    <Button
                      key={estado}
                      variant="outline"
                      size="sm"
                      onClick={() => handleChangeEstado(estado)}
                      disabled={loading}
                    >
                      {estado === 'pendiente' && 'Marcar como Pendiente'}
                      {estado === 'en_proceso' && 'Iniciar Producción'}
                      {estado === 'finalizada' && 'Marcar como Finalizada'}
                    </Button>
                  ))}
                </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Cliente</h3>
              <p className="font-semibold text-gray-900">{orden.cliente?.nombre_fantasia}</p>
              <p className="text-sm text-gray-500">{orden.cliente?.numero_documento}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Canal de Venta</h3>
              <ChannelBadge canal={orden.canal_venta} showLabel />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">Creado por</h3>
              <div className="flex items-center gap-2">
                <Avatar
                  src={orden.created_by_profile?.avatar_url}
                  name={orden.created_by_profile?.full_name}
                  size="sm"
                />
                <span className="text-sm text-gray-700">{orden.created_by_profile?.full_name}</span>
              </div>
            </div>
          </div>

          {orden.notas_internas && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Notas Internas</h3>
              <p className="text-sm text-gray-700">{orden.notas_internas}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8 px-6 overflow-x-auto">
          {[
            { key: 'items' as const, label: 'Items', icon: Package, count: orden.items?.length || 0 },
            { key: 'ruta' as const, label: 'Ruta de Producción', icon: Route },
            { key: 'adjuntos' as const, label: 'Adjuntos', icon: FileText },
            { key: 'pagos' as const, label: 'Pagos', icon: CreditCard, count: orden.pagos?.length || 0 },
            { key: 'historial' as const, label: 'Historial', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Items de la orden ({orden.items.length})
                </h3>

                <div className="space-y-3">
                  {orden.items.map((item: any, index: number) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-semibold flex-shrink-0">
                        {index + 1}
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{item.producto?.nombre || 'Producto'}</p>
                        <p className="text-sm text-gray-500">Cantidad: {item.cantidad}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">Precio unitario</p>
                        <p className="font-semibold text-gray-900">
                          ${Number(item.precio_unitario_final).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="text-right min-w-[120px]">
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-lg font-bold text-blue-600">
                          ${Number(item.precio_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mt-6">
                  <div className="flex justify-end items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Subtotal</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${Number(orden.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ${Number(orden.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ruta' && (
          <div className="p-6">
            {!orden.items || orden.items.length === 0 ? (
              <EmptyState
                icon={Route}
                title="No hay items para mostrar rutas"
                description="Esta orden no tiene productos con rutas de producción"
              />
            ) : (
              <OrderProductionRouteTab ordenId={orden.id} items={orden.items} />
            )}
          </div>
        )}

        {activeTab === 'adjuntos' && (
          <div className="p-6">
            <OrdenAdjuntosTab
              ordenId={orden.id}
              fechaEntregaReal={orden.fecha_entrega_real}
              estado={orden.estado}
            />
          </div>
        )}

        {activeTab === 'pagos' && (
          <div className="p-6">
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Total de la Orden</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${Number(orden.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </Card>

                <Card>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Pagado</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </Card>

                <Card>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-1">Saldo Pendiente</p>
                    <p className={`text-2xl font-bold ${saldoPendiente > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      ${saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </Card>
              </div>
            </div>

            {!orden.pagos || orden.pagos.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No hay pagos registrados"
                description="Aún no se han registrado pagos para esta orden"
              />
            ) : (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Pagos registrados ({orden.pagos.length})
                </h3>

                {orden.pagos.map((pago: any, index: number) => (
                  <motion.div
                    key={pago.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700">
                        <DollarSign className="w-5 h-5" />
                      </div>

                      <div>
                        <p className="font-semibold text-gray-900">{pago.metodo_pago}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(pago.fecha_pago).toLocaleDateString()}
                          {pago.referencia_pago && ` • Ref: ${pago.referencia_pago}`}
                        </p>
                      </div>
                    </div>

                    <p className="text-xl font-bold text-green-600">
                      ${Number(pago.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'historial' && (
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

                    <Badge variant="secondary">{evento.tipo_evento}</Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

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
    </div>
  );
}
