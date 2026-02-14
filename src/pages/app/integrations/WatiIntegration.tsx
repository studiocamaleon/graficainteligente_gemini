import { useState, useEffect } from 'react';
import { Save, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

export default function WatiIntegration() {
    usePageHeader('Configuración de Wati');
    const { profile } = useAuth();
    const { showSuccess, showError } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // Config State
    const [enabled, setEnabled] = useState(false);
    const [endpoint, setEndpoint] = useState('');
    const [accessToken, setAccessToken] = useState('');

    useEffect(() => {
        if (profile?.company_id) {
            loadConfig(profile.company_id);
        }
    }, [profile?.company_id]);

    const loadConfig = async (companyId: string) => {
        try {
            setIsFetching(true);
            const { data, error } = await supabase
                .from('companies')
                .select('wati_enabled, wati_api_endpoint, wati_access_token')
                .eq('id', companyId)
                .single();

            const companyData = data as any;

            if (error) throw error;

            if (companyData) {
                setEnabled(companyData.wati_enabled || false);
                setEndpoint(companyData.wati_api_endpoint || '');
                setAccessToken(companyData.wati_access_token || '');
            }
        } catch (err) {
            console.error('Error loading config:', err);
            showError('No se pudo cargar la configuración de Wati');
        } finally {
            setIsFetching(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.company_id) return;

        const normalizedEndpoint = endpoint.trim();
        const normalizedToken = accessToken.trim();

        if (enabled && (!normalizedEndpoint || !normalizedToken)) {
            showError('Para habilitar Wati debes completar endpoint y access token');
            return;
        }

        if (enabled) {
            try {
                // Validates structure (protocol + host) before persisting config.
                new URL(normalizedEndpoint);
            } catch {
                showError('El endpoint de Wati no tiene un formato de URL válido');
                return;
            }
        }

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('companies')
                .update({
                    wati_enabled: enabled,
                    wati_api_endpoint: normalizedEndpoint,
                    wati_access_token: normalizedToken,
                })
                .eq('id', profile.company_id);

            if (error) throw error;
            showSuccess('Configuración guardada correctamente');
        } catch (err) {
            console.error('Error saving config:', err);
            showError('Error al guardar la configuración');
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return <div className="p-8 text-center text-gray-500">Cargando configuración...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card>
                <div className="p-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Credenciales de API</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Ingresa tus credenciales de Wati para habilitar el envío de notificaciones.
                            </p>
                        </div>
                        <Badge variant={enabled ? "success" : "default"}>
                            {enabled ? "Habilitado" : "Deshabilitado"}
                        </Badge>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex items-center space-x-2 pb-4 border-b border-gray-100">
                            <input
                                type="checkbox"
                                id="enable-wati"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                            />
                            <label htmlFor="enable-wati" className="font-medium text-gray-900 cursor-pointer">
                                Habilitar integración con Wati
                            </label>
                        </div>

                        <div className={`space-y-4 transition-all duration-300 ${enabled ? 'opacity-100' : 'opacity-60 grayscale'}`}>
                            <div className="space-y-2">
                                <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700">
                                    API Endpoint URL
                                </label>
                                <input
                                    type="text"
                                    id="endpoint"
                                    value={endpoint}
                                    onChange={(e) => setEndpoint(e.target.value)}
                                    placeholder="https://live-server-XXXX.wati.io"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    disabled={!enabled}
                                />
                                <p className="text-xs text-gray-500">
                                    URL base de tu instancia Wati.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700">
                                    Access Token
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        id="accessToken"
                                        value={accessToken}
                                        onChange={(e) => setAccessToken(e.target.value)}
                                        placeholder="Tu token de acceso..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        disabled={!enabled}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <a
                                href="https://docs.wati.io/reference/introduction"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                Documentación API Wati <ExternalLink className="w-3 h-3" />
                            </a>

                            <Button type="submit" variant="primary" isLoading={isLoading}>
                                <Save className="w-4 h-4 mr-2" />
                                Guardar Configuración
                            </Button>
                        </div>
                    </form>
                </div>
            </Card>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-blue-900">Nota sobre seguridad</h4>
                        <p className="text-sm text-blue-800">
                            Asegúrate de copiar el token correctamente. Si regeneras el token en Wati, deberás actualizarlo aquí.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
