import { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Table } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { useRecurringExpenses } from '../../hooks/useRecurringExpenses';
import { CreateRecurringExpenseModal } from './CreateRecurringExpenseModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import type { RecurringExpense } from '../../types/database';

export function RecurringExpensesPanel() {
    const { expenses, loading, createExpense, updateExpense, deleteExpense, refetch } = useRecurringExpenses();
    const { showConfirm, dialogState, closeDialog, handleConfirm, isLoading: isConfirmLoading } = useConfirmDialog();
    const { showSuccess, showError } = useToast();

    const [showModal, setShowModal] = useState(false);
    const [expenseToEdit, setExpenseToEdit] = useState<RecurringExpense | null>(null);

    const handleEdit = (expense: RecurringExpense) => {
        setExpenseToEdit(expense);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (await showConfirm({
            title: 'Eliminar Gasto Recurrente',
            message: '¿Estás seguro? Esto no eliminará los gastos históricos ya generados.',
            confirmText: 'Eliminar',
            type: 'danger'
        } as any)) {
            try {
                await deleteExpense(id);
                showSuccess('Gasto eliminado');
            } catch (err: any) {
                showError(err.message);
            }
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setExpenseToEdit(null);
    };

    const handleFormSubmit = async (data: any) => {
        if (expenseToEdit) {
            await updateExpense(expenseToEdit.id, data);
            showSuccess('Gasto actualizado');
        } else {
            await createExpense(data);
            showSuccess('Gasto creado');
        }
        handleCloseModal();
    };

    const columns = [
        {
            key: 'description',
            header: 'Descripción',
            render: (item: RecurringExpense) => (
                <div>
                    <div className="font-medium text-gray-900">{item.description}</div>
                    <div className="text-sm text-gray-500">
                        {(item as any).provider?.nombre_fantasia || 'Sin proveedor'}
                    </div>
                </div>
            ),
        },
        {
            key: 'amount',
            header: 'Monto Estimado',
            render: (item: RecurringExpense) => (
                <div className="font-semibold text-gray-900">
                    ${item.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
            ),
        },
        {
            key: 'frequency',
            header: 'Frecuencia',
            render: (item: RecurringExpense) => {
                const labels: Record<string, string> = {
                    weekly: 'Semanal',
                    biweekly: 'Quincenal',
                    monthly: 'Mensual',
                    quarterly: 'Trimestral',
                    yearly: 'Anual',
                };
                return (
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-blue-500" />
                        <span>{labels[item.frequency] || item.frequency}</span>
                        {item.day_of_month && <span className="text-xs text-gray-500">(Día {item.day_of_month})</span>}
                    </div>
                );
            },
        },
        {
            key: 'category',
            header: 'Categoría',
            render: (item: any) => (
                <Badge
                    variant="default"
                    className="border"
                    style={{
                        borderColor: item.tipo?.color || '#ccc',
                        color: item.tipo?.color || '#333'
                    }}
                >
                    {item.tipo?.nombre || 'General'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (item: RecurringExpense) => (
                <div className="flex gap-2">
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

    const totalMonthlyProjection = expenses.reduce((acc, curr) => {
        let multiplier = 1;
        if (curr.frequency === 'weekly') multiplier = 4;
        if (curr.frequency === 'biweekly') multiplier = 2;
        if (curr.frequency === 'yearly') multiplier = 1 / 12;
        if (curr.frequency === 'quarterly') multiplier = 1 / 3;
        return acc + (curr.amount * multiplier);
    }, 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Gastos Recurrentes / Fijos</h2>
                    <p className="text-gray-500">Administra tus costos fijos para la proyección de Cashflow</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-600" />
                        <div>
                            <span className="text-xs text-blue-600 uppercase font-bold block">Proyección Mensual</span>
                            <span className="text-lg font-bold text-blue-700">${totalMonthlyProjection.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>
                    <Button onClick={() => setShowModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Gasto
                    </Button>
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando...</div>
                ) : expenses.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No tienes gastos recurrentes configurados.</p>
                        <Button variant="ghost" onClick={() => setShowModal(true)}>Crear el primero</Button>
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={expenses}
                        keyExtractor={(i) => i.id}
                    />
                )}
            </Card>

            <CreateRecurringExpenseModal
                isOpen={showModal}
                onClose={handleCloseModal}
                onSubmit={handleFormSubmit}
                onSuccess={() => refetch()}
                expenseToEdit={expenseToEdit}
            />

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
