import { useState } from 'react';
import { X, Save, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface QuickClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClientCreated: (client: any) => void;
    initialName?: string;
}

export function QuickClientModal({ isOpen, onClose, onClientCreated, initialName = '' }: QuickClientModalProps) {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        razon_social: initialName,
        nombre_fantasia: initialName,
        numero_documento: '',
        email: '',
        whatsapp: '',
    });

    const formatWhatsApp = (value: string): string => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.startsWith('549')) {
            return cleaned;
        }
        if (cleaned.startsWith('54')) {
            return '549' + cleaned.substring(2);
        }
        if (cleaned.startsWith('15')) {
            return '549' + cleaned.substring(2);
        }
        if (cleaned.startsWith('0')) {
            return '549' + cleaned.substring(1);
        }
        if (cleaned.length > 0) {
            return '549' + cleaned;
        }
        return cleaned;
    };

    const formatCUIT = (value: string): string => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length > 11) return value; // Don't format if too long

        if (numbers.length === 11) {
            return `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10)}`;
        }
        return numbers;
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.company_id) return;

        setLoading(true);
        setError(null);

        // Basic Validation
        if (!formData.razon_social || !formData.nombre_fantasia) {
            setError('Nombre y Razón Social son requeridos');
            setLoading(false);
            return;
        }

        if (!formData.numero_documento) {
            setError('CUIT / DNI es requerido');
            setLoading(false);
            return;
        }

        if (!formData.whatsapp) {
            setError('WhatsApp es requerido');
            setLoading(false);
            return;
        }

        // Infer document type
        const cleanDoc = formData.numero_documento.replace(/\D/g, '');
        const tipo_documento = cleanDoc.length === 11 ? 'CUIT' : 'DNI';

        try {
            const newClient = {
                company_id: profile.company_id,
                razon_social: formData.razon_social,
                nombre_fantasia: formData.nombre_fantasia,
                tipo_documento,
                numero_documento: formData.numero_documento,
                email: formData.email || null,
                whatsapp: formData.whatsapp || null,
                created_by: profile.id,
            };

            const { data, error: insertError } = await supabase
                .from('clients')
                .insert(newClient)
                .select()
                .single();

            if (insertError) throw insertError;

            onClientCreated(data);
            onClose();
            // Reset form
            setFormData({
                razon_social: '',
                nombre_fantasia: '',
                numero_documento: '',
                email: '',
                whatsapp: '',
            });
        } catch (err: any) {
            console.error('Error creating client:', err);
            setError(err.message || 'Error al crear cliente');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Nuevo Cliente Rápido
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            label="Nombre Fantasía *"
                            value={formData.nombre_fantasia}
                            onChange={e => setFormData({
                                ...formData,
                                nombre_fantasia: e.target.value,
                                razon_social: e.target.value // Auto-fill razon social
                            })}
                            placeholder="Ej: Kiosco Pepe"
                            required
                            autoFocus
                        />

                        <Input
                            label="Razón Social *"
                            value={formData.razon_social}
                            onChange={e => setFormData({ ...formData, razon_social: e.target.value })}
                            placeholder="Ej: Pepe S.A."
                            required
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="CUIT / DNI *"
                                value={formData.numero_documento}
                                onChange={e => setFormData({ ...formData, numero_documento: formatCUIT(e.target.value) })}
                                placeholder="XX-XXXXXXXX-X o DNI"
                                required
                            />

                            <Input
                                label="WhatsApp *"
                                value={formData.whatsapp}
                                onChange={e => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                                placeholder="000 000000"
                                required
                            />
                        </div>

                        <Input
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="cliente@email.com (Opcional)"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Crear Cliente
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
