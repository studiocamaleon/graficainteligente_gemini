
import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils/stringUtils';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Caja } from '../../types/medios-cobro';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface ArqueoCajaModalProps {
    isOpen: boolean;
    onClose: () => void;
    caja: Caja | null;
    onSuccess?: () => void;
    onTransferRequest?: () => void;
}

export function ArqueoCajaModal({ isOpen, onClose, caja, onSuccess, onTransferRequest }: ArqueoCajaModalProps) {
    const [step, setStep] = useState<'input' | 'confirm' | 'completed'>('input');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [difference, setDifference] = useState<number | null>(null);

    const { showSuccess, showError, showInfo } = useToast();

    // Form State
    const [saldoReal, setSaldoReal] = useState<string>('');
    const [observaciones, setObservaciones] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && caja) {
            setStep('input');
            setSaldoReal('');
            setObservaciones('');
            setError('');
        }
    }, [isOpen, caja]);

    const onPreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!saldoReal || isNaN(parseFloat(saldoReal))) {
            setError('Ingresa el monto contado válido');
            return;
        }

        if (parseFloat(saldoReal) < 0) {
            setError('El monto no puede ser negativo');
            return;
        }

        if (!caja) return;

        const diferencia = parseFloat(saldoReal) - Number(caja.saldo_actual);
        setDifference(diferencia);
        setStep('confirm');
    };

    const onFinalSubmit = async () => {
        if (!caja) return;
        setIsSubmitting(true);
        try {
            const { error: rpcError } = await supabase.rpc('fn_realizar_arqueo_caja', {
                p_caja_id: caja.id,
                p_saldo_real: parseFloat(saldoReal),
                p_observaciones: observaciones || null
            });

            if (rpcError) throw rpcError;

            showSuccess('Arqueo realizado correctamente');

            if (difference !== 0 && difference !== null) {
                // We show this as info
                showInfo(`Se generó un ajuste automático de ${formatCurrency(Math.abs(difference))}`, 5000);
            }

            // Notify parent to refresh data immediately
            onSuccess?.();

            // Move to completed step to offer transfer
            setStep('completed');

        } catch (error: any) {
            console.error('Error arqueo:', error);
            showError(error.message || 'Error al realizar el arqueo');
            // Don't close or change step on error
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!caja) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Arqueo de Caja: ${caja.nombre} `}
            size="md"
        >
            {step === 'input' && (
                <form onSubmit={onPreSubmit} className="space-y-6 mt-4">

                    <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                        <span className="text-blue-700 font-medium">Saldo en Sistema:</span>
                        <span className="text-2xl font-bold text-blue-900">{formatCurrency(caja.saldo_actual)}</span>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="saldo_real" className="block text-sm font-medium text-gray-700">
                                Saldo Real (Lo que contaste)
                            </label>
                            <div className="relative">
                                <Input
                                    id="saldo_real"
                                    type="number"
                                    step="0.01"
                                    className="pl-10 text-lg font-bold"
                                    placeholder="0.00"
                                    value={saldoReal}
                                    onChange={(e) => setSaldoReal(e.target.value)}
                                    required
                                />
                                <span className="absolute left-3 top-3 text-gray-500">$</span>
                            </div>
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="observaciones" className="block text-sm font-medium text-gray-700">
                                Observaciones
                            </label>
                            <textarea
                                id="observaciones"
                                rows={3}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Comentarios sobre el cierre..."
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit">Siguiente: Verificar</Button>
                    </div>
                </form>
            )}

            {step === 'confirm' && (
                <div className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase">Sistema</div>
                            <div className="text-lg font-semibold text-gray-900">{formatCurrency(caja.saldo_actual)}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase">Real</div>
                            <div className="text-lg font-bold text-blue-600">{formatCurrency(parseFloat(saldoReal) || 0)}</div>
                        </div>
                    </div>

                    {difference === 0 ? (
                        <div className="bg-green-50 p-4 rounded-lg flex items-center gap-3 text-green-700">
                            <CheckCircle2 className="w-8 h-8" />
                            <div>
                                <div className="font-bold">¡Caja Balanceada!</div>
                                <div className="text-sm">El saldo coincide perfectamente.</div>
                            </div>
                        </div>
                    ) : (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${difference! > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'} `}>
                            <AlertTriangle className="w-6 h-6 shrink-0 mt-1" />
                            <div>
                                <div className="font-bold text-lg">
                                    Diferencia: {difference! > 0 ? '+' : ''}{formatCurrency(difference!)}
                                </div>
                                <div className="text-sm mt-1">
                                    El sistema generará automáticamente un movimiento de
                                    <b> {difference! > 0 ? 'INGRESO (Sobrante)' : 'EGRESO (Faltante)'} </b>
                                    por {formatCurrency(Math.abs(difference!))} para ajustar el saldo.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setStep('input')} disabled={isSubmitting}>Atrás</Button>
                        <Button
                            onClick={onFinalSubmit}
                            disabled={isSubmitting}
                            className={difference !== 0 ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
                        >
                            {isSubmitting ? 'Procesando...' : difference === 0 ? 'Confirmar Cierre' : 'Confirmar Ajuste'}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'completed' && (
                <div className="space-y-6 mt-4 text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900">¡Arqueo Finalizado!</h3>
                    <p className="text-gray-500">
                        El saldo de la caja ha sido verificado y actualizado correctamente.
                    </p>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-6">
                        <p className="text-sm text-gray-500 uppercase font-semibold mb-1">Saldo Disponible</p>
                        <p className="text-3xl font-bold text-gray-900">{formatCurrency(parseFloat(saldoReal))}</p>
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        {onTransferRequest && (
                            <Button
                                onClick={onTransferRequest}
                                className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
                            >
                                Transferir a Tesorería / Caja Fuerte
                            </Button>
                        )}
                        <Button variant="outline" onClick={onClose} className="w-full">
                            Cerrar y Volver
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
