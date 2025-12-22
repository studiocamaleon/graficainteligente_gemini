
import React, { useState } from 'react';
import { Truck, Calendar, Package, FileText, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DatePicker } from '../ui/DatePicker';

interface ShippingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ShippingData) => Promise<void>;
    loading?: boolean;
}

export interface ShippingData {
    fecha_despacho: string;
    transporte: string;
    numero_guia: string;
}

export function ShippingModal({ isOpen, onClose, onSave, loading = false }: ShippingModalProps) {
    const [formData, setFormData] = useState<ShippingData>({
        fecha_despacho: new Date().toISOString(),
        transporte: '',
        numero_guia: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalles de Despacho" size="md">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium">Información de Envío</p>
                        <p className="mt-1">
                            Complete los datos del despacho. Esta información será enviada automáticamente al cliente por WhatsApp.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <DatePicker
                        label="Fecha de Despacho"
                        value={formData.fecha_despacho}
                        onChange={(date) => setFormData({ ...formData, fecha_despacho: date || new Date().toISOString() })}
                        required
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Empresa de Transporte / Medio de Envío
                        </label>
                        <div className="relative">
                            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                value={formData.transporte}
                                onChange={(e) => setFormData({ ...formData, transporte: e.target.value })}
                                placeholder="Ej: Andreani, Moto Mensajería, etc."
                                required
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Número de Guía / Seguimiento
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input

                                onChange={(e) => setFormData({ ...formData, numero_guia: e.target.value })}
                                value={formData.numero_guia}
                                placeholder="Ej: 394857392"
                                required
                                className="pl-10"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="gap-2">
                        <Truck className="w-4 h-4" />
                        {loading ? 'Procesando...' : 'Confirmar Despacho'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
