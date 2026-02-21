
import { useState } from 'react';
import { Vencimiento } from '../../hooks/useVencimientos';
import { formatCurrency } from '../../utils/stringUtils';
import { formatDateDisplay as formatDate } from '../../utils/dates';
import { Button } from '../ui/Button';
import { AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { RegistrarEgresoModal } from './RegistrarEgresoModal';
import { CreateEgresoData } from '../../types/tesoreria';
import { useEgresos } from '../../hooks/useEgresos';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface VencimientosListProps {
    vencimientos: Vencimiento[];
    onRefresh: () => void;
}

export function VencimientosList({ vencimientos, onRefresh }: VencimientosListProps) {
    const { createEgreso } = useEgresos();
    const { showSuccess, showError } = useToast();
    const { profile } = useAuth();
    const [selectedVencimiento, setSelectedVencimiento] = useState<Vencimiento | null>(null);
    const canDelete = profile?.role === 'super_admin' || profile?.role === 'admin';

    const canDeleteVencimiento = (item: Vencimiento) => item.origen === 'compra' || item.origen === 'cheque' || item.origen === 'recurrente';

    const handleDeleteVencimiento = async (item: Vencimiento) => {
        if (!canDelete) {
            showError('Solo admin o superadmin pueden eliminar cuentas por pagar.');
            return;
        }
        if (!canDeleteVencimiento(item)) {
            showError('Este vencimiento no se puede eliminar desde esta vista.');
            return;
        }

        const confirmed = window.confirm('¿Eliminar este vencimiento? Esta acción no se puede deshacer.');
        if (!confirmed) return;

        try {
            if (item.origen === 'compra') {
                const { error } = await supabase
                    .from('compras_proveedores')
                    .delete()
                    .eq('id', item.id_origen);
                if (error) throw error;
            }

            if (item.origen === 'cheque') {
                const { error } = await supabase
                    .from('cheques_cartera')
                    .delete()
                    .eq('id', item.id_origen);
                if (error) throw error;
            }

            if (item.origen === 'recurrente') {
                const { error } = await supabase
                    .from('recurring_expenses')
                    .update({ is_active: false })
                    .eq('id', item.id_origen);
                if (error) throw error;
            }

            showSuccess('Vencimiento eliminado correctamente');
            onRefresh();
        } catch (error: any) {
            const code = error?.code ? String(error.code) : '';
            if (code === '42501') {
                showError('No tenés permisos para eliminar este registro con tu rol actual.');
                return;
            }
            showError(error?.message || 'No se pudo eliminar el vencimiento');
        }
    };

    const handlePagar = async (data: CreateEgresoData) => {
        try {
            if (!selectedVencimiento) return;

            // Ensure recurrente_id is passed if origin is recurrente
            const payload = {
                ...data,
                recurrente_id: selectedVencimiento.origen === 'recurrente' ? selectedVencimiento.id_origen : undefined,
                cheque_pagado_id: selectedVencimiento.origen === 'cheque' ? selectedVencimiento.id_origen : undefined,
                // For 'recurrente', periodo_devengado implies the month intended. 
                // We use fecha_vencimiento as the reference for the period.
                periodo_devengado: selectedVencimiento.origen === 'recurrente' ? selectedVencimiento.fecha_vencimiento : undefined
            };

            await createEgreso(payload);
            showSuccess('Pago registrado correctamente');
            setSelectedVencimiento(null);
            onRefresh(); // Refresh the list to remove the paid item
        } catch (error: any) {
            showError(error.message || 'Error al registrar el pago');
        }
    };

    const getStatusColor = (estado: string) => {
        switch (estado) {
            case 'vencido': return 'bg-red-100 text-red-800 border-red-200';
            case 'hoy': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'proximo': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusIcon = (estado: string) => {
        switch (estado) {
            case 'vencido': return <AlertCircle size={14} className="mr-1" />;
            case 'hoy': return <Clock size={14} className="mr-1" />;
            case 'proximo': return <CheckCircle size={14} className="mr-1" />;
        }
    };

    if (vencimientos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <CheckCircle className="text-green-500 mb-2" size={32} />
                <p className="text-gray-600 font-medium">¡Estás al día!</p>
                <p className="text-gray-400 text-sm">No hay vencimientos pendientes.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 bg-white">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {vencimientos.map((item) => (
                            <tr key={`${item.origen}-${item.id_origen}-${item.fecha_vencimiento}`} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {formatDate(item.fecha_vencimiento)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <div className="font-medium">{item.descripcion}</div>
                                    <span className="text-xs text-gray-500 capitalize">{item.origen}</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {item.proveedor}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.estado)}`}>
                                        {getStatusIcon(item.estado)}
                                        {item.estado === 'vencido'
                                            ? `Vencido (${item.dias_atraso}d)`
                                            : item.estado === 'hoy' ? 'Vence Hoy'
                                                : `Faltan ${Math.abs(item.dias_atraso)}d`
                                        }
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                    {formatCurrency(item.monto_pendiente)}
                                    {item.monto_pagado > 0 && (
                                        <div className="text-xs text-green-600 font-normal">
                                            Pagado: {formatCurrency(item.monto_pagado)}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <div className="ml-auto grid w-[180px] grid-cols-[1fr_36px] items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => setSelectedVencimiento(item)}
                                            className="justify-self-end"
                                        >
                                            Pagar
                                        </Button>
                                        {canDelete && canDeleteVencimiento(item) && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 hover:text-red-700"
                                                onClick={() => handleDeleteVencimiento(item)}
                                                title="Eliminar cuenta por pagar"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                        {(!canDelete || !canDeleteVencimiento(item)) && <span className="block h-9 w-9" aria-hidden="true" />}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedVencimiento && (
                <RegistrarEgresoModal
                    isOpen={true}
                    onClose={() => setSelectedVencimiento(null)}
                    onSuccess={() => { }} // Handle in onSubmit directly for stricter flow
                    onSubmit={handlePagar}
                    initialData={{
                        monto: selectedVencimiento.monto_pendiente,
                        concepto: selectedVencimiento.descripcion,
                        // Pre-fill type if possible? Ideally we map recurrente->provider->tipo_egreso, but that's complex here.
                        // For now, allow user to select type.
                    }}
                    recurrenteId={selectedVencimiento.origen === 'recurrente' ? selectedVencimiento.id_origen : undefined}
                    periodoDevengado={selectedVencimiento.origen === 'recurrente' ? selectedVencimiento.fecha_vencimiento : undefined}
                    proveedorId={selectedVencimiento.proveedor_id || undefined}
                    tipoEgresoId={selectedVencimiento.tipo_egreso_id || undefined}
                    chequePagadoId={selectedVencimiento.origen === 'cheque' ? selectedVencimiento.id_origen : undefined}
                />
            )}
        </div>
    );
}
