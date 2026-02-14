import { supabase } from './supabase';

interface WatiParameter {
    name: string;
    value: string;
}

interface SendWatiMessageParams {
    companyId: string;
    phone: string;
    template_name: 'nueva_orden_v4' | 'orden_finalizada_v2';
    parameters?: WatiParameter[];
    metadata?: {
        tipo?: string;
        visita_id?: string;
        orden_trabajo_id?: string;
        orden_copiado_id?: string;
    };
}

/**
 * Envia un mensaje de WhatsApp via Wati.
 * Solo admite plantillas aprobadas por Meta.
 */
export async function sendWatiMessage({ companyId, phone, template_name, parameters, metadata }: SendWatiMessageParams) {
    try {
        const { data, error } = await supabase.functions.invoke('send-wati-message', {
            body: {
                company_id: companyId,
                phone,
                template_name,
                parameters,
                metadata
            }
        });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error sending Wati message:', err);
        throw err;
    }
}
