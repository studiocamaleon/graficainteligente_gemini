import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils/stringUtils';
import { Caja, CajaConMediosCobro } from '../../types/medios-cobro';
import { useCajaDestinations, useCajaMutations } from '../../hooks/useCajas'; // Assuming useCajas exports this
import { useToast } from '../../contexts/ToastContext';
import { ArrowRight, Lock } from 'lucide-react';

interface TransferirCajaModalProps {
    isOpen: boolean;
    onClose: () => void;
    cajaOrigen: CajaConMediosCobro | Caja | null;
    onSuccess?: () => void;
}

export function TransferirCajaModal({ isOpen, onClose, cajaOrigen, onSuccess }: TransferirCajaModalProps) {
    const { destinations, loading: loadingDestinations } = useCajaDestinations();
    const { transferirEntreCajas } = useCajaMutations();
    const { showSuccess, showError } = useToast();

    const [cajaDestinoId, setCajaDestinoId] = useState('');
    const [monto, setMonto] = useState('');
    const [concepto, setConcepto] = useState('Transferencia de fondos');
    const [notas, setNotas] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCajaDestinoId('');
            setMonto('');
            setConcepto('Transferencia de fondos');
            setNotas('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cajaOrigen || !cajaDestinoId) return;

        // Validaciones
        if (parseFloat(monto) <= 0) {
            showError('El monto debe ser mayor a 0');
            return;
        }

        if (cajaOrigen.id === cajaDestinoId) {
            showError('No puedes transferir a la misma caja');
            return;
        }

        setIsSubmitting(true);
        try {
            await transferirEntreCajas(
                cajaOrigen.id,
                cajaDestinoId,
                parseFloat(monto),
                concepto,
                notas
            );

            showSuccess('Transferencia realizada con éxito');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('Error transfer:', error);
            showError(error.message || 'Error al realizar la transferencia');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!cajaOrigen) return null;

    // Filter out origin from destinations
    const availableDestinations = destinations.filter(d => d.id !== cajaOrigen.id);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Transferir Fondos"
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {/* Visual Flow */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-center w-1/3">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Origen</div>
                        <div className="font-bold text-gray-900 truncate px-2">{cajaOrigen.nombre}</div>
                        <div className="text-sm text-green-600 font-medium">
                            {formatCurrency(Number(cajaOrigen.saldo_actual))}
                        </div>
                    </div>

                    <div className="flex-shrink-0 text-gray-400">
                        <ArrowRight className="w-6 h-6" />
                    </div>

                    <div className="text-center w-1/3">
                        <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Destino</div>
                        {cajaDestinoId ? (
                            <div className="font-bold text-gray-900 truncate px-2">
                                {destinations.find(d => d.id === cajaDestinoId)?.nombre}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400 italic">Seleccionar...</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3" /> Saldo Oculto
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Destino Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Caja Destino</label>
                        <select
                            className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={cajaDestinoId}
                            onChange={(e) => setCajaDestinoId(e.target.value)}
                            required
                            disabled={loadingDestinations}
                        >
                            <option value="">Seleccione una caja...</option>
                            {availableDestinations.map(dest => (
                                <option key={dest.id} value={dest.id}>
                                    {dest.nombre} {dest.es_principal ? '(Principal)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Monto */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Monto a Transferir</label>
                        <div className="relative">
                            <Input
                                type="number"
                                step="0.01"
                                className="pl-10 text-lg font-bold"
                                placeholder="0.00"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                required
                            />
                            <span className="absolute left-3 top-3 text-gray-500">$</span>
                        </div>
                    </div>

                    {/* Concepto & Notas */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Concepto</label>
                            <Input
                                value={concepto}
                                onChange={(e) => setConcepto(e.target.value)}
                                placeholder="Ej: Cierre de caja diario"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Notas (Opcional)</label>
                            <textarea
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                value={notas}
                                onChange={(e) => setNotas(e.target.value)}
                                placeholder="Detalles adicionales..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting || !cajaDestinoId}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSubmitting ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
