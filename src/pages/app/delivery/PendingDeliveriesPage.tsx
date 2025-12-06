import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Check, ArrowLeft, Clock, DollarSign } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { usePendingDeliveries, PendingDelivery } from '../../../hooks/usePendingDeliveries';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';

export function PendingDeliveriesPage() {
    const navigate = useNavigate();
    usePageHeader('Entregas Pendientes de Despacho');

    const { deliveries, loading, error, refresh, deliverOrder, addPayment } = usePendingDeliveries();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDelivery, setSelectedDelivery] = useState<PendingDelivery | null>(null);
    const [showPagoForm, setShowPagoForm] = useState(false);

    const { dialogState: confirmDialogState, closeDialog: closeConfirmDialog, handleConfirm, openConfirm } = useConfirmDialog();
    const { dialogState: infoDialogState, closeDialog: closeInfoDialog, openDialog: openInfoDialog } = useInfoDialog();

    const filteredDeliveries = useMemo(() => {
        if (!searchTerm) return deliveries;
        const lowerTerm = searchTerm.toLowerCase();
        return deliveries.filter(d =>
            d.numero_orden.toLowerCase().includes(lowerTerm) ||
            d.cliente?.nombre_fantasia.toLowerCase().includes(lowerTerm) ||
            d.cliente?.numero_documento.includes(lowerTerm)
        );
    }, [deliveries, searchTerm]);

    const handleDeliverClick = (delivery: PendingDelivery) => {
        if (delivery.saldo_pendiente > 0) {
            setSelectedDelivery(delivery);
            setShowPagoForm(true);
        } else {
            confirmDelivery(delivery);
        }
    };

    const confirmDelivery = (delivery: PendingDelivery) => {
        openConfirm({
            title: 'Confirmar Entrega',
            message: `¿Estás seguro que deseas marcar la orden ${delivery.numero_orden} como ENTREGADA?`,
            variant: 'success',
            confirmText: 'Confirmar Entrega',
            cancelText: 'Cancelar',
            onConfirm: async () => {
                const success = await deliverOrder(delivery.id, delivery.tipo);
                if (success) {
                    openInfoDialog('Éxito', 'La orden ha sido marcada como entregada correctamente.');
                } else {
                    openInfoDialog('Error', 'No se pudo actualizar el estado de la orden.');
                }
            }
        });
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
            // Check if fully paid now? The list refreshes automatically.
            // But we should notify user.
            // If fully paid, asking to deliver immediately would be nice, but list refresh might be async.
            // For now, simple success message.
            const nuevoSaldo = selectedDelivery.saldo_pendiente - data.monto;
            if (nuevoSaldo <= 0.01) { // Allowing small float margin
                openConfirm({
                    title: 'Pago Registrado - Orden Saldada',
                    message: 'El pago se registró correctamente y la orden está saldada. ¿Deseas entregarla ahora?',
                    variant: 'success',
                    confirmText: 'Sí, Entregar',
                    cancelText: 'Más tarde',
                    onConfirm: async () => {
                        await deliverOrder(selectedDelivery.id, selectedDelivery.tipo);
                        openInfoDialog('Éxito', 'Orden entregada correctamente.');
                    }
                });
            } else {
                openInfoDialog('Pago Registrado', `Se registró el pago. Saldo restante: $${nuevoSaldo.toFixed(2)}`);
            }
            setSelectedDelivery(null);
        } else {
            openInfoDialog('Error', 'No se pudo registrar el pago.');
        }
    };

    const getTipoBadge = (tipo: string) => {
        if (tipo === 'orden_trabajo') return <Badge variant="blue">Orden de Trabajo</Badge>;
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
                                    render: (item) => getTipoBadge(item.tipo),
                                },
                                {
                                    key: 'numero',
                                    header: 'N° Orden',
                                    render: (item) => (
                                        <div>
                                            <span className="font-bold text-gray-900">{item.numero_orden}</span>
                                            <div className="text-xs text-gray-500">{formatDate(item.fecha_solicitud)}</div>
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
                                                variant={item.saldo_pendiente > 0 ? "warning" : "success"}
                                                onClick={() => handleDeliverClick(item)}
                                            >
                                                {item.saldo_pendiente > 0 ? (
                                                    <>
                                                        <DollarSign className="w-4 h-4 mr-1" />
                                                        Cobrar
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Entregar
                                                    </>
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

            <PagoFormModal
                isOpen={showPagoForm}
                onClose={() => {
                    setShowPagoForm(false);
                    setSelectedDelivery(null);
                }}
                onSubmit={handlePagoSubmit}
                saldoPendiente={selectedDelivery?.saldo_pendiente || 0}
            />
        </div>
    );
}
