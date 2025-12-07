import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Calendar, DollarSign, Wallet, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Table } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { useCheques } from '../../hooks/useCheques';
import { CreateChequeModal } from './CreateChequeModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import type { Cheque, ChequeDirection } from '../../types/database';
import { formatDateDisplay } from '../../utils/dates';

export function ChequesPanel() {
    const { cheques, loading, createCheque, updateCheque, deleteCheque, refetch } = useCheques();
    const { confirm } = useConfirmDialog();
    const { showSuccess, showError } = useToast();

    const [activeTab, setActiveTab] = useState<ChequeDirection>('emitido');
    const [showModal, setShowModal] = useState(false);
    const [chequeToEdit, setChequeToEdit] = useState<Cheque | null>(null);

    const filteredCheques = useMemo(() => {
        return cheques.filter(c => (c.direction || 'emitido') === activeTab);
    }, [cheques, activeTab]);

    const handleEdit = (cheque: Cheque) => {
        setChequeToEdit(cheque);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (await confirm({
            title: 'Eliminar Cheque',
            message: '¿Estás seguro? Se eliminará de la proyección financiera.',
            confirmText: 'Eliminar',
            type: 'danger'
        })) {
            try {
                await deleteCheque(id);
                showSuccess('Cheque eliminado');
            } catch (err: any) {
                showError(err.message);
            }
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setChequeToEdit(null);
    };

    const handleFormSubmit = async (data: any) => {
        if (chequeToEdit) {
            await updateCheque(chequeToEdit.id, data);
            showSuccess('Cheque actualizado');
        } else {
            await createCheque(data);
            showSuccess('Cheque creado');
        }
        handleCloseModal();
    };

    const getStatusColor = (status: string, fechaPago: string) => {
        if (status === 'pagado') return 'success';
        if (status === 'anulado') return 'default';
        if (status === 'vencido') return 'danger';

        const daysUntilDue = Math.ceil((new Date(fechaPago).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

        if (daysUntilDue < 0) return 'danger'; // Vencido/Atrasado
        if (daysUntilDue <= 3) return 'warning'; // Próximo a vencer
        return 'primary'; // Pendiente normal
    };

    const columns = [
        {
            key: 'fecha_pago',
            header: 'Fecha Pago',
            render: (item: Cheque) => (
                <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{formatDateDisplay(item.fecha_pago)}</span>
                    <span className="text-xs text-gray-500">Emisión: {formatDateDisplay(item.fecha_emision)}</span>
                </div>
            ),
        },
        {
            key: 'numero',
            header: 'Numero / Banco',
            render: (item: Cheque) => (
                <div>
                    <div className="font-medium text-gray-900 flex items-center gap-1">
                        {item.tipo === 'echeq' ? <span className="text-purple-600 text-xs border border-purple-200 px-1 rounded">E-CHEQ</span> : null}
                        {item.numero_cheque}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">{item.banco}</div>
                </div>
            ),
        },
        {
            key: 'beneficiario',
            header: activeTab === 'emitido' ? 'Beneficiario' : 'Recibido De',
            render: (item: any) => (
                <div>
                    <div className="text-sm text-gray-900">
                        {activeTab === 'emitido'
                            ? (item.destinatario || item.provider?.nombre_fantasia)
                            : (item.client?.nombre_fantasia || item.client?.razon_social || item.destinatario)
                        }
                    </div>
                    {item.descripcion && <div className="text-xs text-gray-500 italic">{item.descripcion}</div>}
                </div>
            ),
        },
        {
            key: 'monto',
            header: 'Monto',
            render: (item: Cheque) => (
                <div className={`font-bold ${activeTab === 'recibido' ? 'text-green-600' : 'text-gray-900'}`}>
                    ${item.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            key: 'estado',
            header: 'Estado',
            render: (item: Cheque) => {
                const variant = getStatusColor(item.estado, item.fecha_pago);
                return (
                    <Badge variant={variant === 'default' ? undefined : variant as any}>
                        {item.estado.toUpperCase()}
                    </Badge>
                );
            },
        },
        {
            key: 'actions',
            header: '',
            render: (item: Cheque) => (
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    const totalPendiente = filteredCheques
        .filter(c => c.estado === 'pendiente')
        .reduce((acc, curr) => acc + curr.monto, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Cartera de Cheques</h2>
                    <p className="text-gray-500">Gestión de valores {activeTab === 'emitido' ? 'a pagar' : 'a cobrar'}</p>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <div>
                            <span className="text-xs text-orange-600 uppercase font-bold block">
                                {activeTab === 'emitido' ? 'Pendiente APagar' : 'Pendiente Acred.'}
                            </span>
                            <span className="text-lg font-bold text-orange-700">
                                ${totalPendiente.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>
                    <Button onClick={() => setShowModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        {activeTab === 'emitido' ? 'Nuevo Pago' : 'Nuevo Cobro'}
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
                <button
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'emitido'
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('emitido')}
                >
                    <ArrowRightLeft className="w-4 h-4" />
                    Cheques Emitidos (Pagos)
                </button>
                <button
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'recibido'
                        ? 'border-green-600 text-green-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('recibido')}
                >
                    <Wallet className="w-4 h-4" />
                    Cheques Recibidos (Cobros)
                </button>
            </div>

            <Card>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando...</div>
                ) : filteredCheques.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No tienes cheques {activeTab === 'emitido' ? 'emitidos' : 'recibidos'} registrados.</p>
                        <Button variant="ghost" onClick={() => setShowModal(true)}>Registrar el primero</Button>
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={filteredCheques}
                        keyExtractor={(i) => i.id}
                    />
                )}
            </Card>

            <CreateChequeModal
                isOpen={showModal}
                onClose={handleCloseModal}
                onSubmit={handleFormSubmit}
                onSuccess={() => refetch()}
                chequeToEdit={chequeToEdit}
            />
        </div>
    );
}
