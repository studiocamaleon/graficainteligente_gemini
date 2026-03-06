import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Check, ArrowLeft, Clock, DollarSign, Truck, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PagoFormModal, type PagoFormData } from '../../../components/orders/PagoFormModal';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { usePendingDeliveries, PendingDelivery } from '../../../hooks/usePendingDeliveries';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { ShippingModal, ShippingData } from '../../../components/orders/ShippingModal';
import { supabase } from '../../../lib/supabase';

import { useAuth } from '../../../hooks/useAuth';
import { sendWatiMessage } from '../../../lib/wati';
import { buildTrackingUrl } from '../../../lib/trackingUrl';
import { canRegisterPaymentsRole, isWorkshopOperatorRole } from '../../../utils/roles';

interface PendingDeliveriesPageProps {
    embedded?: boolean;
}

interface DeliveryDetailData {
    tipo: 'orden_trabajo' | 'centro_copiado';
    numeroOrden: string;
    clienteNombre: string;
    fecha: string;
    fechaEstimada: string | null;
    total: number;
    saldoPendiente: number;
    notas: string | null;
    items: Array<{
        id: string;
        nombre: string;
        categoria: string;
        cantidad: number;
        precioUnitario: number;
        precioTotal: number;
    }>;
}

function PendingDeliveriesContent({ embedded = false }: PendingDeliveriesPageProps) {
    const getSessionValue = <T,>(key: string, fallback: T, isValid: (value: string) => boolean): T => {
        if (typeof window === 'undefined') return fallback;
        const raw = window.sessionStorage.getItem(key);
        if (!raw || !isValid(raw)) return fallback;
        return raw as T;
    };

    const SESSION_KEYS = {
        searchTerm: 'pending-deliveries:search-term',
        paymentFilter: 'pending-deliveries:payment-filter',
        balanceSort: 'pending-deliveries:balance-sort',
    } as const;

    const navigate = useNavigate();
    const { profile, company } = useAuth();
    const canRegisterPayments = canRegisterPaymentsRole(profile?.role);
    const isWorkshopOperator = isWorkshopOperatorRole(profile?.role);

    const { deliveries, loading, error, refresh, deliverOrder, addPayment } = usePendingDeliveries();
    const [searchTerm, setSearchTerm] = useState(() =>
        getSessionValue<string>(SESSION_KEYS.searchTerm, '', () => true)
    );
    const [paymentFilter, setPaymentFilter] = useState<'all' | 'deben'>(() =>
        getSessionValue<'all' | 'deben'>(SESSION_KEYS.paymentFilter, 'all', (v) => v === 'all' || v === 'deben')
    );
    const [balanceSort, setBalanceSort] = useState<'none' | 'asc' | 'desc'>(() =>
        getSessionValue<'none' | 'asc' | 'desc'>(SESSION_KEYS.balanceSort, 'none', (v) => v === 'none' || v === 'asc' || v === 'desc')
    );
    const [selectedDelivery, setSelectedDelivery] = useState<PendingDelivery | null>(null);
    const [showShippingModal, setShowShippingModal] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<DeliveryDetailData | null>(null);

    const { dialogState: confirmDialogState, closeDialog: closeConfirmDialog, handleConfirm, openConfirm } = useConfirmDialog();
    const { dialogState: infoDialogState, closeDialog: closeInfoDialog, openDialog: openInfoDialog } = useInfoDialog();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.sessionStorage.setItem(SESSION_KEYS.searchTerm, searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.sessionStorage.setItem(SESSION_KEYS.paymentFilter, paymentFilter);
    }, [paymentFilter]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.sessionStorage.setItem(SESSION_KEYS.balanceSort, balanceSort);
    }, [balanceSort]);

    const filteredDeliveries = useMemo(() => {
        return deliveries.filter((d) => {
            const matchesDebt = isWorkshopOperator || paymentFilter !== 'deben' ? true : d.saldo_pendiente > 0.01;
            if (!matchesDebt) return false;
            if (!searchTerm) return true;

            const lowerTerm = searchTerm.toLowerCase();
            return (
                d.numero_orden.toLowerCase().includes(lowerTerm) ||
                (d.cliente?.nombre_fantasia || d.cliente?.razon_social || '').toLowerCase().includes(lowerTerm) ||
                (d.cliente?.numero_documento || '').includes(lowerTerm)
            );
        });
    }, [deliveries, isWorkshopOperator, paymentFilter, searchTerm]);

    const sortedDeliveries = useMemo(() => {
        if (balanceSort === 'none') return filteredDeliveries;

        return [...filteredDeliveries].sort((a, b) => {
            const balanceA = Number(a.saldo_pendiente || 0);
            const balanceB = Number(b.saldo_pendiente || 0);
            if (balanceSort === 'asc') return balanceA - balanceB;
            return balanceB - balanceA;
        });
    }, [filteredDeliveries, balanceSort]);

    const headerMetrics = useMemo(() => {
        const count = filteredDeliveries.length;

        let sumSaldo = 0;
        let sumCobrar = 0;
        let sumCuentaCorriente = 0;
        let countDespacho = 0;
        let oldestTs: number | null = null;

        for (const d of filteredDeliveries) {
            const saldo = Math.max(0, Number(d.saldo_pendiente || 0));
            sumSaldo += saldo;

            if (saldo > 0) {
                if (d.cliente?.tiene_cuenta_corriente) sumCuentaCorriente += saldo;
                else sumCobrar += saldo;
            }

            if (d.tipo === 'orden_trabajo' && d.requiere_despacho) countDespacho += 1;

            const fechaBase = d.fecha_finalizada ?? d.fecha_solicitud;
            const ts = fechaBase ? new Date(fechaBase).getTime() : NaN;
            if (!Number.isNaN(ts)) {
                oldestTs = oldestTs === null ? ts : Math.min(oldestTs, ts);
            }
        }

        const oldestDays =
            oldestTs === null ? null : Math.max(0, Math.floor((Date.now() - oldestTs) / 86400000));

        return {
            count,
            sumSaldo,
            sumCobrar,
            sumCuentaCorriente,
            countDespacho,
            oldestDays,
        };
    }, [filteredDeliveries]);

    const handleDeliverClick = (delivery: PendingDelivery) => {
        // Validation: Must be fully paid OR Client has Current Account
        const canDeliver = delivery.saldo_pendiente <= 0.01 || delivery.cliente?.tiene_cuenta_corriente;

        if (canDeliver) {
            console.log('Checking delivery type:', delivery.requiere_despacho);
            if (delivery.tipo === 'orden_trabajo' && delivery.requiere_despacho) {
                setSelectedDelivery(delivery);
                setShowShippingModal(true);
            } else {
                confirmDelivery(delivery);
            }
        } else {
            // Must pay first
            if (!canRegisterPayments) {
                openInfoDialog('Acción no permitida', 'El rol Operador de taller no puede registrar pagos.');
                return;
            }
            setSelectedDelivery(delivery);
        }
    };

    const confirmDelivery = (delivery: PendingDelivery) => {
        const hasDebt = delivery.saldo_pendiente > 0.01;

        openConfirm({
            title: 'Confirmar Entrega',
            message: hasDebt
                ? `La orden ${delivery.numero_orden} tiene un saldo de $${delivery.saldo_pendiente.toLocaleString('es-AR')}. Como el cliente tiene Cuenta Corriente, el saldo se registrará como pendiente en su cuenta. ¿Confirmar entrega?`
                : `¿Estás seguro que deseas marcar la orden ${delivery.numero_orden} como ENTREGADA?`,
            variant: hasDebt ? 'warning' : 'success',
            confirmText: 'Confirmar Entrega',
            cancelText: 'Cancelar',
            onConfirm: async () => {
                const success = await deliverOrder(delivery.id, delivery.tipo);
                if (success) {
                    openInfoDialog('Éxito', hasDebt
                        ? 'Orden entregada. El saldo ha sido imputado a la Cuenta Corriente del cliente.'
                        : 'La orden ha sido marcada como entregada correctamente.');
                } else {
                    openInfoDialog('Error', 'No se pudo actualizar el estado de la orden.');
                }
            }
        });
    };

    const handleShippingSubmit = async (data: ShippingData) => {
        if (!selectedDelivery) return;

        const success = await deliverOrder(selectedDelivery.id, selectedDelivery.tipo, data);
        if (success) {
            setShowShippingModal(false);

            // Send WhatsApp Notification
            if (selectedDelivery.tipo === 'orden_trabajo' && profile?.company_id && selectedDelivery.cliente?.id && selectedDelivery.cliente?.whatsapp) {
                sendWatiMessage({
                    companyId: profile.company_id,
                    phone: selectedDelivery.cliente.whatsapp,
                    template_name: 'orden_finalizada_v3',
                    parameters: [
                        { name: 'nombre_cliente', value: selectedDelivery.cliente.nombre_fantasia || selectedDelivery.cliente.razon_social },
                        { name: 'numero_orden', value: selectedDelivery.numero_orden },
                        { name: 'saldo_pendiente', value: selectedDelivery.saldo_pendiente.toLocaleString('es-AR') },
                        { name: 'url_tracking', value: buildTrackingUrl(selectedDelivery.tracking_token || '') },
                        { name: 'nombre_empresa', value: company?.name || 'Tu empresa' },
                        { name: '1', value: selectedDelivery.tracking_token || '' }
                    ],
                    metadata: {
                        tipo: 'orden_despachada',
                        orden_trabajo_id: selectedDelivery.id
                    }
                }).then(() => {
                    openInfoDialog('Éxito', 'La orden ha sido despachada y se envió la notificación al cliente.');
                }).catch((err) => {
                    console.error('Error sending WhatsApp:', err);
                    openInfoDialog('Éxito', 'La orden ha sido despachada, pero hubo un error al enviar la notificación por WhatsApp.');
                });
            } else {
                openInfoDialog('Éxito', 'La orden ha sido despachada y se ha registrado el envío.');
            }

            setSelectedDelivery(null);
        } else {
            openInfoDialog('Error', 'No se pudo registrar el despacho.');
        }
    };

    const handlePagoSubmit = async (data: PagoFormData) => {
        if (!selectedDelivery) return;

        const success = await addPayment({
            orden_id: selectedDelivery.id,
            tipo: selectedDelivery.tipo,
            fecha_pago: data.fecha_pago,
            monto: data.monto,
            medio_cobro_id: data.medio_cobro_id,
            referencia_pago: data.referencia_pago,
            notas: data.notas
        });

        if (success) {
            const nuevoSaldo = selectedDelivery.saldo_pendiente - data.monto;
            if (nuevoSaldo <= 0.01) { // Allowing small float margin
                openConfirm({
                    title: 'Pago Registrado - Orden Saldada',
                    message: selectedDelivery.requiere_despacho
                        ? 'El pago se registró correctamente y la orden está saldada. ¿Deseas proceder con el despacho?'
                        : 'El pago se registró correctamente y la orden está saldada. ¿Deseas entregarla ahora?',
                    variant: 'success',
                    confirmText: selectedDelivery.requiere_despacho ? 'Sí, Despachar' : 'Sí, Entregar',
                    cancelText: 'Más tarde',
                    onConfirm: async () => {
                        if (selectedDelivery.requiere_despacho && selectedDelivery.tipo === 'orden_trabajo') {
                            setShowShippingModal(true);
                        } else {
                            await deliverOrder(selectedDelivery.id, selectedDelivery.tipo);
                            openInfoDialog('Éxito', 'Orden entregada correctamente.');
                        }
                    }
                });
            } else {
                openInfoDialog('Pago Registrado', `Se registró el pago. Saldo restante: $${nuevoSaldo.toFixed(2)}`);
                setSelectedDelivery(null);
            }
        } else {
            openInfoDialog('Error', 'No se pudo registrar el pago.');
        }
    };

    const getTipoBadge = (tipo: string, requiereDespacho?: boolean) => {
        if (tipo === 'orden_trabajo') {
            return (
                <div className="flex items-center gap-2">
                    <Badge variant="blue">Orden de Trabajo</Badge>
                    {requiereDespacho && (
                        <div className="bg-orange-100 text-orange-700 p-1 rounded-full" title="Requiere Despacho">
                            <Truck className="w-3 h-3" />
                        </div>
                    )}
                </div>
            );
        }
        return <Badge variant="purple">Centro Copiado</Badge>;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;

    const openDetailModal = async (delivery: PendingDelivery) => {
        if (!profile?.company_id) return;

        setDetailModalOpen(true);
        setDetailLoading(true);
        setDetailError(null);
        setDetailData(null);

        try {
            if (delivery.tipo === 'orden_trabajo') {
                const { data: orden, error: ordenError } = await supabase
                    .from('ordenes_trabajo')
                    .select(`
                        id,
                        numero_orden,
                        fecha_creacion,
                        fecha_estimada_entrega,
                        total,
                        notas_internas,
                        cliente:clients(id, nombre_fantasia, razon_social)
                    `)
                    .eq('id', delivery.id)
                    .eq('company_id', profile.company_id)
                    .single();

                if (ordenError) throw ordenError;

                const { data: items, error: itemsError } = await supabase
                    .from('ordenes_trabajo_items')
                    .select('id, producto_nombre, producto_categoria, cantidad, precio_unitario_final, precio_total')
                    .eq('orden_id', delivery.id)
                    .order('created_at', { ascending: true });

                if (itemsError) throw itemsError;

                const parsedItems = (items || []).map((it: any) => ({
                    id: String(it.id),
                    nombre: it.producto_nombre || 'Item sin nombre',
                    categoria: it.producto_categoria || 'Personalizado',
                    cantidad: Number(it.cantidad || 0),
                    precioUnitario: Number(it.precio_unitario_final || 0),
                    precioTotal: Number(it.precio_total || 0),
                }));

                setDetailData({
                    tipo: 'orden_trabajo',
                    numeroOrden: orden.numero_orden || delivery.numero_orden,
                    clienteNombre: orden.cliente?.nombre_fantasia || orden.cliente?.razon_social || 'Cliente eventual',
                    fecha: orden.fecha_creacion || delivery.fecha_solicitud,
                    fechaEstimada: orden.fecha_estimada_entrega || null,
                    total: Number(orden.total || delivery.total || 0),
                    saldoPendiente: Number(delivery.saldo_pendiente || 0),
                    notas: orden.notas_internas || null,
                    items: parsedItems,
                });
            } else {
                const { data: orden, error: ordenError } = await supabase
                    .from('centro_copiado_ordenes')
                    .select(`
                        id,
                        numero_orden,
                        fecha_solicitud,
                        fecha_entrega_estimada,
                        total,
                        observaciones,
                        cliente:clients(id, nombre_fantasia, razon_social)
                    `)
                    .eq('id', delivery.id)
                    .eq('company_id', profile.company_id)
                    .single();

                if (ordenError) throw ordenError;

                const { data: items, error: itemsError } = await supabase
                    .from('centro_copiado_ordenes_items')
                    .select('id, tipo_item, descripcion, cantidad_hojas, cantidad_unidades, precio_unitario, subtotal')
                    .eq('orden_copiado_id', delivery.id)
                    .order('created_at', { ascending: true });

                if (itemsError) throw itemsError;

                const parsedItems = (items || []).map((it: any) => ({
                    id: String(it.id),
                    nombre: it.descripcion || `Item ${it.tipo_item || 'copiado'}`,
                    categoria: it.tipo_item || 'Centro Copiado',
                    cantidad: Number(it.cantidad_unidades || 1),
                    precioUnitario: Number(it.precio_unitario || 0),
                    precioTotal: Number(it.subtotal || 0),
                }));

                setDetailData({
                    tipo: 'centro_copiado',
                    numeroOrden: orden.numero_orden || delivery.numero_orden,
                    clienteNombre: orden.cliente?.nombre_fantasia || orden.cliente?.razon_social || 'Cliente eventual',
                    fecha: orden.fecha_solicitud || delivery.fecha_solicitud,
                    fechaEstimada: orden.fecha_entrega_estimada || null,
                    total: Number(orden.total || delivery.total || 0),
                    saldoPendiente: Number(delivery.saldo_pendiente || 0),
                    notas: orden.observaciones || null,
                    items: parsedItems,
                });
            }
        } catch (err) {
            console.error('Error loading delivery detail:', err);
            setDetailError('No se pudo cargar el detalle de la orden.');
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {!embedded && (
                <div className="flex items-center justify-between">
                    <Button variant="secondary" onClick={() => navigate('/app/dashboard')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al Dashboard
                    </Button>
                    <div className="text-sm text-gray-500">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {isWorkshopOperator
                            ? 'Ordenado por antigüedad (Más antiguos primero)'
                            : balanceSort === 'none'
                            ? 'Ordenado por antigüedad (Más antiguos primero)'
                            : balanceSort === 'asc'
                                ? 'Ordenado por saldo pendiente (Menor a mayor)'
                                : 'Ordenado por saldo pendiente (Mayor a menor)'}
                    </div>
                </div>
            )}

            <Card>
                <div className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente o número de orden..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            {!isWorkshopOperator && (
                                <select
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'deben')}
                                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">Todas</option>
                                    <option value="deben">Solo deben</option>
                                </select>
                            )}
                            <Badge variant="primary">{filteredDeliveries.length} Pendientes</Badge>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
                            <div>
                                <div className="font-semibold">Error al cargar entregas</div>
                                <div className="mt-1">{error}</div>
                            </div>
                            <Button variant="outline" onClick={refresh}>
                                Actualizar lista
                            </Button>
                        </div>
                    )}

                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${isWorkshopOperator ? 'xl:grid-cols-3' : 'xl:grid-cols-6'} gap-3 mb-6`}>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Órdenes</div>
                                <Package className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-base sm:text-lg lg:text-xl font-semibold leading-tight text-gray-900 whitespace-nowrap tabular-nums">{headerMetrics.count}</div>
                            <div className="mt-1 text-xs text-gray-500">Pendientes (según filtro)</div>
                        </Card>

                        {!isWorkshopOperator && (
                            <>
                                <Card className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">Deuda total</div>
                                        <DollarSign className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div className="mt-2 text-base sm:text-lg lg:text-xl font-semibold leading-tight text-gray-900 whitespace-nowrap tabular-nums">
                                        ${headerMetrics.sumSaldo.toLocaleString('es-AR')}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">Saldo pendiente acumulado</div>
                                </Card>

                                <Card className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">A cobrar</div>
                                        <DollarSign className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <div className="mt-2 text-base sm:text-lg lg:text-xl font-semibold leading-tight text-gray-900 whitespace-nowrap tabular-nums">
                                        ${headerMetrics.sumCobrar.toLocaleString('es-AR')}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">Sin cuenta corriente</div>
                                </Card>

                                <Card className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm text-gray-600">A c/c</div>
                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div className="mt-2 text-base sm:text-lg lg:text-xl font-semibold leading-tight text-gray-900 whitespace-nowrap tabular-nums">
                                        ${headerMetrics.sumCuentaCorriente.toLocaleString('es-AR')}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">Con cuenta corriente</div>
                                </Card>
                            </>
                        )}

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Despacho</div>
                                <Truck className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-base sm:text-lg lg:text-xl font-semibold leading-tight text-gray-900 whitespace-nowrap tabular-nums">{headerMetrics.countDespacho}</div>
                            <div className="mt-1 text-xs text-gray-500">Requieren despacho</div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Antigüedad</div>
                                <Clock className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-base sm:text-lg lg:text-xl font-semibold leading-tight text-gray-900 whitespace-nowrap tabular-nums">
                                {headerMetrics.oldestDays === null ? '-' : `${headerMetrics.oldestDays}d`}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">Más antigua (según filtro)</div>
                        </Card>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredDeliveries.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">No hay entregas pendientes</h3>
                            <p className="text-gray-500">Todas las órdenes finalizadas han sido entregadas.</p>
                            <Button variant="outline" className="mt-4" onClick={refresh}>
                                Actualizar lista
                            </Button>
                        </div>
                    ) : (
                        <Table
                            columns={[
                                {
                                    key: 'tipo',
                                    header: 'Tipo',
                                    render: (item) => getTipoBadge(item.tipo, item.requiere_despacho),
                                },
                                {
                                    key: 'numero',
                                    header: 'N° Orden',
                                    render: (item) => (
                                        <div>
                                            <span className="font-bold text-gray-900">{item.numero_orden}</span>
                                            <div className="text-xs text-gray-500">
                                                Finalizada: {formatDate(item.fecha_finalizada ?? item.fecha_solicitud)}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'cliente',
                                    header: 'Cliente',
                                    render: (item) => (
                                        <div>
                                            <div className="font-medium text-gray-900">{item.cliente?.nombre_fantasia || 'Cliente Eventual'}</div>
                                            <div className="text-xs text-gray-500">{item.cliente?.numero_documento}</div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'total',
                                    header: isWorkshopOperator ? 'Estado de pago' : (
                                        <button
                                            type="button"
                                            onClick={() => setBalanceSort((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'))}
                                            className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors"
                                            title="Ordenar por saldo pendiente"
                                        >
                                            Saldo
                                            {balanceSort === 'none' ? (
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            ) : balanceSort === 'asc' ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    ),
                                    render: (item) => (
                                        <div>
                                            {isWorkshopOperator ? (
                                                item.saldo_pendiente > 0
                                                    ? <div className="font-semibold text-amber-700">Pendiente de pago</div>
                                                    : <div className="font-semibold text-emerald-700">Pagado</div>
                                            ) : (
                                                <>
                                                    {item.saldo_pendiente > 0 ? (
                                                        <div className="font-semibold text-amber-700">
                                                            ${item.saldo_pendiente.toLocaleString('es-AR')}
                                                        </div>
                                                    ) : (
                                                        <div className="font-semibold text-emerald-700">Pagado</div>
                                                    )}
                                                    <div className="text-xs text-gray-500">
                                                        Total orden: ${item.total.toLocaleString('es-AR')}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'acciones',
                                    header: 'Acciones',
                                    render: (item) => (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => openDetailModal(item)}
                                            >
                                                Ver Detalle
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={item.saldo_pendiente > 0 ? (canRegisterPayments ? "warning" : "secondary") : (item.requiere_despacho ? "primary" : "success")}
                                                className={item.requiere_despacho && item.saldo_pendiente <= 0 ? "bg-orange-600 hover:bg-orange-700 border-transparent text-white focus:ring-orange-500" : ""}
                                                disabled={item.saldo_pendiente > 0 && !canRegisterPayments}
                                                onClick={() => handleDeliverClick(item)}
                                            >
                                                {item.saldo_pendiente > 0 ? (
                                                    canRegisterPayments ? (
                                                        <>
                                                            <DollarSign className="w-4 h-4 mr-1" />
                                                            Cobrar
                                                        </>
                                                    ) : (
                                                        'Pago pendiente'
                                                    )
                                                ) : (
                                                    item.requiere_despacho ? (
                                                        <>
                                                            <Truck className="w-4 h-4 mr-1" />
                                                            Despachar
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check className="w-4 h-4 mr-1" />
                                                            Entregar
                                                        </>
                                                    )
                                                )}
                                            </Button>
                                        </div>
                                    ),
                                },
                            ]}
                            data={sortedDeliveries}
                            keyExtractor={(item) => item.id}
                        />
                    )}
                </div>
            </Card>

            <ConfirmDialog
                isOpen={confirmDialogState.isOpen}
                title={confirmDialogState.title}
                message={confirmDialogState.message}
                variant={confirmDialogState.variant}
                confirmText={confirmDialogState.confirmText}
                cancelText={confirmDialogState.cancelText}
                onConfirm={handleConfirm}
                onClose={closeConfirmDialog}
            />

            <InfoDialog
                isOpen={infoDialogState.isOpen}
                title={infoDialogState.title}
                message={infoDialogState.message}
                onClose={closeInfoDialog}
            />

            {selectedDelivery && (
                <PagoFormModal
                    isOpen={!!selectedDelivery}
                    onClose={() => setSelectedDelivery(null)}
                    onSubmit={handlePagoSubmit}
                    saldoPendiente={selectedDelivery.saldo_pendiente}
                    clientName={selectedDelivery.cliente?.nombre_fantasia || selectedDelivery.cliente?.razon_social}
                />
            )}
            <ShippingModal
                isOpen={showShippingModal}
                onClose={() => {
                    setShowShippingModal(false);
                    setSelectedDelivery(null);
                }}
                onSave={handleShippingSubmit}
                companyData={{
                    name: company?.name || 'Tu empresa',
                    logoUrl: company?.logo_url || null,
                    phone: company?.contact_phone || null,
                    email: company?.contact_email || null,
                    address: company?.address || null,
                }}
                orderData={
                    selectedDelivery
                        ? {
                            numeroOrden: selectedDelivery.numero_orden,
                            clienteNombre: selectedDelivery.cliente?.nombre_fantasia || selectedDelivery.cliente?.razon_social || 'Cliente',
                            requiereDespacho: Boolean(selectedDelivery.requiere_despacho),
                        }
                        : undefined
                }
            />

            <Modal
                isOpen={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false);
                    setDetailData(null);
                    setDetailError(null);
                }}
                title={detailData ? `Detalle ${detailData.numeroOrden}` : 'Detalle de orden'}
                size="xl"
            >
                {detailLoading ? (
                    <div className="py-10 flex justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                    </div>
                ) : detailError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {detailError}
                    </div>
                ) : !detailData ? (
                    <div className="text-sm text-gray-500">Sin datos para mostrar.</div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="p-3">
                                <div className="text-xs text-gray-500">Tipo</div>
                                <div className="font-semibold text-gray-900">
                                    {detailData.tipo === 'orden_trabajo' ? 'Orden de Trabajo' : 'Centro Copiado'}
                                </div>
                            </Card>
                            <Card className="p-3">
                                <div className="text-xs text-gray-500">Cliente</div>
                                <div className="font-semibold text-gray-900">{detailData.clienteNombre}</div>
                            </Card>
                            {!isWorkshopOperator && (
                                <>
                                    <Card className="p-3">
                                        <div className="text-xs text-gray-500">Total</div>
                                        <div className="font-semibold text-gray-900">{formatMoney(detailData.total)}</div>
                                    </Card>
                                    <Card className="p-3">
                                        <div className="text-xs text-gray-500">Saldo pendiente</div>
                                        <div className={`font-semibold ${detailData.saldoPendiente > 0.01 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {formatMoney(detailData.saldoPendiente)}
                                        </div>
                                    </Card>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <div className="text-xs text-gray-500">Fecha de creación</div>
                                <div className="font-medium text-gray-900">{formatDate(detailData.fecha)}</div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <div className="text-xs text-gray-500">Fecha estimada</div>
                                <div className="font-medium text-gray-900">
                                    {detailData.fechaEstimada ? formatDate(detailData.fechaEstimada) : '-'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">Productos / Items comprados</h4>
                            {detailData.items.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                                    Esta orden no tiene items cargados.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full min-w-[760px] text-sm">
                                        <thead className="bg-gray-50 text-gray-600">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold">Producto / Item</th>
                                                <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                                                <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                                                {!isWorkshopOperator && <th className="px-3 py-2 text-right font-semibold">P. Unitario</th>}
                                                {!isWorkshopOperator && <th className="px-3 py-2 text-right font-semibold">Subtotal</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.items.map((item) => (
                                                <tr key={item.id} className="border-t border-gray-200">
                                                    <td className="px-3 py-2 text-gray-900">{item.nombre}</td>
                                                    <td className="px-3 py-2 text-gray-600">{item.categoria}</td>
                                                    <td className="px-3 py-2 text-right text-gray-900">{item.cantidad.toLocaleString('es-AR')}</td>
                                                    {!isWorkshopOperator && <td className="px-3 py-2 text-right text-gray-900">{formatMoney(item.precioUnitario)}</td>}
                                                    {!isWorkshopOperator && <td className="px-3 py-2 text-right font-medium text-gray-900">{formatMoney(item.precioTotal)}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {detailData.notas && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <div className="text-xs text-gray-500 mb-1">Notas</div>
                                <div className="text-sm text-gray-800 whitespace-pre-wrap">{detailData.notas}</div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}

export function PendingDeliveriesPage() {
    usePageHeader('Entregas Pendientes de Despacho');
    return <PendingDeliveriesContent />;
}

export function PendingDeliveriesEmbedded() {
    return <PendingDeliveriesContent embedded />;
}
