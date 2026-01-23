import { supabase } from './supabase';

interface WatiParameter {
    name: string;
    value: string;
}

interface SendWatiMessageParams {
    companyId: string;
    phone: string;
    message?: string;        // Optional if using template
    template_name?: string;  // Optional if using session message
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
 * Puede ser un mensaje de sesión (texto libre) o una plantilla.
 */
export async function sendWatiMessage({ companyId, phone, message, template_name, parameters, metadata }: SendWatiMessageParams) {
    try {
        const { data, error } = await supabase.functions.invoke('send-wati-message', {
            body: {
                company_id: companyId,
                phone,
                message,
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
