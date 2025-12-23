import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Visita } from '../../types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, User, Building, Phone, AlignLeft, Check, X, AlertCircle } from 'lucide-react';
import { useVisitas } from '../../hooks/useVisitas';

interface DetalleVisitaModalProps {
    visita: Visita | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit?: (visita: Visita) => void;
}

export function DetalleVisitaModal({ visita, isOpen, onClose, onEdit }: DetalleVisitaModalProps) {
    const { updateVisita } = useVisitas();
    const [updatingStatus, setUpdatingStatus] = useState(false);

    if (!visita) return null;

    const statusColors = {
        pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        confirmada: 'bg-blue-100 text-blue-800 border-blue-200',
        completada: 'bg-green-100 text-green-800 border-green-200',
        cancelada: 'bg-red-100 text-red-800 border-red-200'
    };

    const handleStatusChange = async (newStatus: Visita['estado']) => {
        try {
            setUpdatingStatus(true);
            await updateVisita(visita.id, { estado: newStatus });
            // Close to trigger parent refresh
            onClose();
            // In a real app we might want to keep it open and just update local state, 
            // but closing is safer to ensure calendar reflects color change immediately.
        } catch (error) {
            console.error(error);
            alert("Error al actualizar estado");
        } finally {
            setUpdatingStatus(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Detalle de la Visita"
            size="md"
        >
            <div className="space-y-6">
                {/* Header with Status Actions */}
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{visita.titulo}</h2>
                            <div className="flex items-center gap-2 mt-1 text-slate-500">
                                <Calendar className="w-4 h-4" />
                                <span className="capitalize">
                                    {format(new Date(visita.fecha_inicio), "EEEE d 'de' MMMM", { locale: es })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Status Control Bar */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 overflow-x-auto">
                        <span className="text-xs font-bold text-slate-400 uppercase mr-auto">Estado:</span>

                        {visita.estado !== 'pendiente' && (
                            <button
                                onClick={() => handleStatusChange('pendiente')}
                                disabled={updatingStatus}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${visita.estado === 'pendiente' ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                                Pendiente
                            </button>
                        )}

                        <button
                            onClick={() => handleStatusChange('confirmada')}
                            disabled={updatingStatus}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border flex items-center gap-1 ${visita.estado === 'confirmada' ? 'bg-blue-100 border-blue-300 text-blue-800 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'}`}
                        >
                            Confirmada
                        </button>

                        <button
                            onClick={() => handleStatusChange('completada')}
                            disabled={updatingStatus}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border flex items-center gap-1 ${visita.estado === 'completada' ? 'bg-green-100 border-green-300 text-green-800 ring-2 ring-green-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200'}`}
                        >
                            <Check className="w-3 h-3" /> Completada
                        </button>

                        <button
                            onClick={() => handleStatusChange('cancelada')}
                            disabled={updatingStatus}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border flex items-center gap-1 ${visita.estado === 'cancelada' ? 'bg-red-100 border-red-300 text-red-800 ring-2 ring-red-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200'}`}
                        >
                            <X className="w-3 h-3" /> Cancelada
                        </button>
                    </div>
                </div>

                {/* Time Info */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm text-blue-600">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">Horario</p>
                        <p className="text-lg font-bold text-slate-900">
                            {format(new Date(visita.fecha_inicio), 'HH:mm')} - {format(new Date(visita.fecha_fin), 'HH:mm')} hs
                        </p>
                    </div>
                </div>

                {/* Client Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
                        <User className="w-4 h-4" /> Cliente
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-xs text-slate-400">Nombre</span>
                            <p className="font-medium text-slate-800">{visita.cliente_nombre || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-slate-400">Empresa</span>
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                {visita.cliente_empresa || '-'}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-slate-400">WhatsApp</span>
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                <Phone className="w-3.5 h-3.5 text-green-600" />
                                {visita.cliente_whatsapp ? (
                                    <a
                                        href={`https://wa.me/${visita.cliente_whatsapp}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-green-700"
                                    >
                                        {visita.cliente_whatsapp}
                                    </a>
                                ) : '-'}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-slate-400">Domicilio</span>
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                <MapPin className="w-3.5 h-3.5 text-red-500" />
                                {visita.domicilio || '-'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Description */}
                {visita.descripcion && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
                            <AlignLeft className="w-4 h-4" /> Notas / Descripción
                        </h3>
                        <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 text-slate-700 text-sm leading-relaxed">
                            {visita.descripcion}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                    {onEdit && (
                        <Button onClick={() => onEdit(visita)}>
                            Editar Visita
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
