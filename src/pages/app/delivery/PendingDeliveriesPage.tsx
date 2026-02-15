import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Check, ArrowLeft, Clock, DollarSign, Truck } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { usePendingDeliveries, PendingDelivery } from '../../../hooks/usePendingDeliveries';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { ShippingModal, ShippingData } from '../../../components/orders/ShippingModal';

import { useAuth } from '../../../hooks/useAuth';
import { sendWatiMessage } from '../../../lib/wati';
import { buildTrackingUrl } from '../../../lib/trackingUrl';

export function PendingDeliveriesPage() {
    const navigate = useNavigate();
    usePageHeader('Entregas Pendientes de Despacho');
    const { profile, company } = useAuth();

    const { deliveries, loading, error, refresh, deliverOrder, addPayment } = usePendingDeliveries();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDelivery, setSelectedDelivery] = useState<PendingDelivery | null>(null);
    const [showPagoForm, setShowPagoForm] = useState(false);
    const [showShippingModal, setShowShippingModal] = useState(false);

    const { dialogState: confirmDialogState, closeDialog: closeConfirmDialog, handleConfirm, openConfirm } = useConfirmDialog();
    const { dialogState: infoDialogState, closeDialog: closeInfoDialog, openDialog: openInfoDialog } = useInfoDialog();

    const filteredDeliveries = useMemo(() => {
        if (!searchTerm) return deliveries;
        const lowerTerm = searchTerm.toLowerCase();
        return deliveries.filter(d =>
            d.numero_orden.toLowerCase().includes(lowerTerm) ||
            (d.cliente?.nombre_fantasia || d.cliente?.razon_social || '').toLowerCase().includes(lowerTerm) ||
            (d.cliente?.numero_documento || '').includes(lowerTerm)
        );
    }, [deliveries, searchTerm]);

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
            setSelectedDelivery(delivery);
            setShowPagoForm(true);
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

    const handlePagoSubmit = async (data: any) => {
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
            setShowPagoForm(false);

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="secondary" onClick={() => navigate('/app/dashboard')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al Dashboard
                </Button>
                <div className="text-sm text-gray-500">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Ordenado por antigüedad (Más antiguos primero)
                </div>
            </div>

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
                        <div className="flex items-center gap-2">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Órdenes</div>
                                <Package className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900">{headerMetrics.count}</div>
                            <div className="mt-1 text-xs text-gray-500">Pendientes (según filtro)</div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Deuda total</div>
                                <DollarSign className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900">
                                ${headerMetrics.sumSaldo.toLocaleString('es-AR')}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">Saldo pendiente acumulado</div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">A cobrar</div>
                                <DollarSign className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900">
                                ${headerMetrics.sumCobrar.toLocaleString('es-AR')}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">Sin cuenta corriente</div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">A c/c</div>
                                <DollarSign className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900">
                                ${headerMetrics.sumCuentaCorriente.toLocaleString('es-AR')}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">Con cuenta corriente</div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Despacho</div>
                                <Truck className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900">{headerMetrics.countDespacho}</div>
                            <div className="mt-1 text-xs text-gray-500">Requieren despacho</div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Antigüedad</div>
                                <Clock className="w-4 h-4 text-gray-500" />
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-gray-900">
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
                                    header: 'Pago',
                                    render: (item) => (
                                        <div>
                                            <div className="font-semibold">${item.total.toLocaleString('es-AR')}</div>
                                            {item.saldo_pendiente > 0 ? (
                                                <Badge variant="warning" size="sm">Debe: ${item.saldo_pendiente.toLocaleString('es-AR')}</Badge>
                                            ) : (
                                                <Badge variant="success" size="sm">Pagado</Badge>
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
                                                onClick={() => {
                                                    if (item.tipo === 'orden_trabajo') navigate(`/app/orders/${item.id}`);
                                                    else navigate(`/app/centro-copiado/ordenes/${item.id}`);
                                                }}
                                            >
                                                Ver Detalle
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={item.saldo_pendiente > 0 ? "warning" : (item.requiere_despacho ? "primary" : "success")}
                                                className={item.requiere_despacho && item.saldo_pendiente <= 0 ? "bg-orange-600 hover:bg-orange-700 border-transparent text-white focus:ring-orange-500" : ""}
                                                onClick={() => handleDeliverClick(item)}
                                            >
                                                {item.saldo_pendiente > 0 ? (
                                                    <>
                                                        <DollarSign className="w-4 h-4 mr-1" />
                                                        Cobrar
                                                    </>
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
                            data={filteredDeliveries}
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
            />
        </div>
    );
}
