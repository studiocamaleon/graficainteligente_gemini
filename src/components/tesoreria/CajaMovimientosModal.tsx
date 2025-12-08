import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/stringUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ArrowDownLeft,
    ArrowUpRight,
    ArrowRightLeft,
    Calendar,
    User,
    FileText,
    TrendingUp,
    TrendingDown,
    RefreshCw
} from 'lucide-react';
import { Caja } from '../../types/medios-cobro';
import { useCajaMovimientos } from '../../hooks/useCajas'; // We will create this

interface CajaMovimientosModalProps {
    isOpen: boolean;
    onClose: () => void;
    caja: Caja | null;
}

export function CajaMovimientosModal({ isOpen, onClose, caja }: CajaMovimientosModalProps) {
    const { movimientos, loading, error, refetch, hasMore, loadMore } = useCajaMovimientos(caja?.id || null, isOpen);

    if (!caja) return null;

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'ingreso': return <ArrowDownLeft className="w-5 h-5 text-green-600" />;
            case 'egreso': return <ArrowUpRight className="w-5 h-5 text-red-600" />;
            case 'transferencia_entrante': return <ArrowRightLeft className="w-5 h-5 text-blue-600 rotate-45" />; // Incoming transfer
            case 'transferencia_saliente': return <ArrowRightLeft className="w-5 h-5 text-orange-600" />;
            case 'ajuste': return <RefreshCw className="w-5 h-5 text-purple-600" />;
            default: return <FileText className="w-5 h-5 text-gray-500" />;
        }
    };

    const getLabel = (tipo: string, otroCaja?: string) => {
        switch (tipo) {
            case 'ingreso': return 'Ingreso';
            case 'egreso': return 'Egreso';
            case 'transferencia_entrante': return `Recibido de ${otroCaja || 'Otra Caja'}`;
            case 'transferencia_saliente': return `Enviado a ${otroCaja || 'Otra Caja'}`;
            case 'ajuste': return 'Ajuste de Sistema';
            default: return 'Movimiento';
        }
    };

    const getColorClass = (tipo: string) => {
        if (tipo === 'ingreso' || tipo === 'transferencia_entrante') return 'text-green-700 bg-green-50 border-green-100';
        if (tipo === 'egreso' || tipo === 'transferencia_saliente') return 'text-red-700 bg-red-50 border-red-100';
        return 'text-gray-700 bg-gray-50 border-gray-100';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Historial: ${caja.nombre}`}
            size="lg"
        >
            <div className="flex flex-col h-[60vh]">

                {/* Header Stats could go here */}

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
                    {loading && movimientos.length === 0 && (
                        <div className="flex justify-center p-8 text-gray-400">
                            Cargando movimientos...
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-center">
                            Error al cargar: {error.message}
                        </div>
                    )}

                    {!loading && movimientos.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FileText className="w-12 h-12 mb-2 opacity-20" />
                            <p>No hay movimientos registrados</p>
                        </div>
                    )}

                    {movimientos.map((mov) => (
                        <div
                            key={mov.id}
                            className={`p-4 rounded-xl border flex items-start gap-4 transition-all hover:shadow-sm ${getColorClass(mov.tipo_movimiento)}`}
                        >
                            <div className={`p-2 rounded-full bg-white shadow-sm shrink-0`}>
                                {getIcon(mov.tipo_movimiento)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-gray-900 truncate">
                                            {mov.concepto}
                                        </h4>
                                        <p className="text-sm font-medium mt-0.5 opacity-90">
                                            {getLabel(mov.tipo_movimiento, mov.otro_caja_nombre)}
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <span className="font-mono font-bold text-lg">
                                            {['egreso', 'transferencia_saliente'].includes(mov.tipo_movimiento) ? '-' : '+'}
                                            {formatCurrency(mov.monto)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-xs opacity-70">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {format(new Date(mov.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                                    </span>
                                    {mov.usuario_nombre && (
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {mov.usuario_nombre}
                                        </span>
                                    )}
                                    {mov.referencia_tipo && (
                                        <span className="bg-white/50 px-1.5 py-0.5 rounded border border-black/5 capitalize">
                                            {mov.referencia_tipo.replace('_', ' ')}
                                        </span>
                                    )}
                                </div>
                                {mov.notas && (
                                    <div className="mt-2 text-sm italic bg-black/5 p-2 rounded-md">
                                        "{mov.notas}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <div className="pt-2 text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={loadMore}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Cargando más...' : 'Ver más antiguos'}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
