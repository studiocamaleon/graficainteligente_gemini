import { useState } from 'react';
import { CreditCard, Plus, Calendar, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { useTarjetas, useResumenes } from '../../hooks/useTarjetas';
import { CreateTarjetaModal } from './CreateTarjetaModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import type { TarjetaCredito } from '../../types/database';

export function TarjetasPanel() {
    const { tarjetas, loading, crearTarjeta, actualizarTarjeta, eliminarTarjeta, refetch } = useTarjetas();
    const { showConfirm } = useConfirmDialog();
    const { showSuccess, showError } = useToast();

    const [showModal, setShowModal] = useState(false);
    const [tarjetaToEdit, setTarjetaToEdit] = useState<TarjetaCredito | null>(null);
    const [selectedTarjetaId, setSelectedTarjetaId] = useState<string | null>(null);

    const handleEdit = (tarjeta: TarjetaCredito) => {
        setTarjetaToEdit(tarjeta);
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (await showConfirm({
            title: 'Eliminar Tarjeta',
            message: '¿Estás seguro? Se borrarán todos los resúmenes y consumos asociados.',
            confirmText: 'Eliminar',
            variant: 'danger'
        })) {
            try {
                await eliminarTarjeta(id);
                showSuccess('Tarjeta eliminada');
            } catch (err: any) {
                showError(err.message);
            }
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setTarjetaToEdit(null);
    };

    const handleFormSubmit = async (data: any) => {
        try {
            if (tarjetaToEdit) {
                await actualizarTarjeta(tarjetaToEdit.id, data);
                showSuccess('Tarjeta actualizada');
            } else {
                await crearTarjeta(data);
                showSuccess('Tarjeta creada exitosamente');
            }
            handleCloseModal();
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Tarjetas Corporativas</h2>
                    <p className="text-gray-500">Gestión de tarjetas de crédito y resúmenes</p>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Tarjeta
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-gray-500">
                        Cargando tarjetas...
                    </div>
                ) : tarjetas.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 flex flex-col items-center">
                        <CreditCard className="w-12 h-12 mb-3 opacity-20" />
                        <p>No tienes tarjetas registradas.</p>
                        <Button variant="ghost" onClick={() => setShowModal(true)} className="mt-2">
                            Agregar la primera
                        </Button>
                    </div>
                ) : (
                    tarjetas.map((tarjeta) => (
                        <TarjetaCard
                            key={tarjeta.id}
                            tarjeta={tarjeta}
                            onEdit={() => handleEdit(tarjeta)}
                            onDelete={() => handleDelete(tarjeta.id)}
                            onSelect={() => setSelectedTarjetaId(tarjeta.id === selectedTarjetaId ? null : tarjeta.id)}
                            isSelected={selectedTarjetaId === tarjeta.id}
                        />
                    ))
                )}
            </div>

            {/* TODO: Show Summary Details Panel if selectedTarjetaId is not null */}
            {selectedTarjetaId && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                    <ResumenesView tarjetaId={selectedTarjetaId} />
                </div>
            )}

            <CreateTarjetaModal
                isOpen={showModal}
                onClose={handleCloseModal}
                onSubmit={handleFormSubmit}
                onSuccess={() => refetch()}
                tarjetaToEdit={tarjetaToEdit}
            />
        </div>
    );
}

function TarjetaCard({
    tarjeta,
    onEdit,
    onDelete,
    onSelect,
    isSelected
}: {
    tarjeta: TarjetaCredito;
    onEdit: () => void;
    onDelete: () => void;
    onSelect: () => void;
    isSelected: boolean;
}) {
    // Calcular proximo vencimiento (simple estimation based on day)
    const today = new Date();
    const currentDay = today.getDate();
    const paymentMonth = currentDay > tarjeta.dia_vencimiento ? today.getMonth() + 1 : today.getMonth();
    const paymentDate = new Date(today.getFullYear(), paymentMonth, tarjeta.dia_vencimiento);

    const getBgColor = (c: string) => {
        switch (c) {
            case 'blue': return 'bg-blue-600';
            case 'green': return 'bg-emerald-600';
            case 'red': return 'bg-red-600';
            case 'black': return 'bg-gray-900';
            case 'purple': return 'bg-purple-600';
            case 'gold': return 'bg-yellow-600';
            default: return 'bg-blue-600';
        }
    };

    return (
        <div
            className={`relative rounded-xl overflow-hidden shadow-lg transition-all cursor-pointer ${isSelected ? 'ring-4 ring-offset-2 ring-blue-500 scale-[1.02]' : 'hover:shadow-xl'
                }`}
            onClick={onSelect}
        >
            {/* Card Visual */}
            <div className={`${getBgColor(tarjeta.color)} p-6 text-white h-48 flex flex-col justify-between relative`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg">{tarjeta.nombre}</h3>
                        <p className="text-white/80 text-sm">{tarjeta.banco}</p>
                    </div>
                    <CreditCard className="w-8 h-8 opacity-50" />
                </div>

                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs uppercase opacity-75 mb-1">Próximo Vencimiento</p>
                        <div className="flex items-center gap-1 font-mono text-sm">
                            <Calendar className="w-3 h-3" />
                            {paymentDate.toLocaleDateString()}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-mono text-xl tracking-wider">
                            •••• {tarjeta.ultimos_4_digitos || '••••'}
                        </p>
                    </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            </div>

            {/* Actions Footer */}
            <div className="bg-white p-3 flex justify-between items-center border-x border-b border-gray-100 rounded-b-xl" onClick={(e) => e.stopPropagation()}>
                <div className="text-xs text-gray-500">
                    Cierre: día {tarjeta.dia_cierre}
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={onEdit}>
                        <Edit2 className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onDelete}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ResumenesView({ tarjetaId }: { tarjetaId: string }) {
    const { resumenes, loading } = useResumenes(tarjetaId);

    if (loading) return <div className="text-center py-4">Cargando resúmenes...</div>;

    return (
        <div>
            <h3 className="font-bold text-lg text-gray-800 mb-4">Resúmenes de Cuenta</h3>
            {resumenes.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                    No hay resúmenes generados para esta tarjeta.
                    <br />
                    <span className="text-sm">Los resúmenes se generarán automáticamente al registrar gastos.</span>
                </div>
            ) : (
                <div className="grid gap-4">
                    {resumenes.map(r => (
                        <Card key={r.id} padding="sm" className="flex items-center justify-between">
                            <div>
                                <div className="font-bold text-gray-900">Período {r.periodo}</div>
                                <div className="text-xs text-gray-500">
                                    Vence: {new Date(r.fecha_vencimiento).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-lg">
                                    ${r.total_consumos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </div>
                                <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${r.estado === 'pagado' ? 'bg-green-100 text-green-700' :
                                    r.estado === 'cerrado' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {r.estado.toUpperCase()}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
