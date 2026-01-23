import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { company_id, phone, message, template_name, parameters, metadata } = await req.json();

        // Allow either 'message' (custom text) OR 'template_name'
        if (!company_id || !phone || (!message && !template_name)) {
            throw new Error('Faltan parámetros requeridos (company_id, phone, y message O template_name)');
        }

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch Wati Credentials
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('wati_api_endpoint, wati_access_token, wati_enabled')
            .eq('id', company_id)
            .single();

        if (companyError || !company) {
            console.error('Error fetching company:', companyError);
            throw new Error('Empresa no encontrada o credenciales no configuradas');
        }

        if (!company.wati_enabled) {
            return new Response(JSON.stringify({ success: false, message: 'Integración Wati deshabilitada' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const endpoint = company.wati_api_endpoint.replace(/\/+$/, '');
        const token = company.wati_access_token;
        let result;
        let url;
        let requestBody;

        if (template_name) {
            // --- SEND TEMPLATE MESSAGE ---
            console.log(`Sending Template ${template_name} to ${phone}`);
            url = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${phone}`;

            requestBody = {
                template_name: template_name,
                broadcast_name: template_name,
                parameters: parameters || [] // Array of { name: "vname", value: "val" }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            result = await response.json();
            if (!response.ok) {
                console.error('Wati Template API Error:', result);
                throw new Error(result.message || 'Error al enviar plantilla Wati');
            }

        } else {
            // --- SEND SESSION MESSAGE (Legacy/Manual) ---
            console.log(`Sending Session Message to ${phone}`);
            url = `${endpoint}/api/v1/sendSessionMessage/${phone}?messageText=${encodeURIComponent(message)}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': token }
            });

            result = await response.json();
            if (!response.ok) {
                console.error('Wati Session API Error:', result);
                throw new Error(result.message || 'Error al enviar mensaje Wati');
            }
        }

        // Log Notification
        const logData = {
            company_id,
            telefono_destino: phone,
            mensaje_enviado: template_name ? `Template: ${template_name}` : message,
            tipo_notificacion: metadata?.tipo || (template_name ? 'template' : 'manual'),
            estado_envio: 'enviado',
            respuesta_backend: result,
            visita_id: metadata?.visita_id || null,
            orden_trabajo_id: metadata?.orden_trabajo_id || null,
            orden_copiado_id: metadata?.orden_copiado_id || null
        };

        await supabase.from('whatsapp_notificaciones').insert(logData);

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err: any) {
        console.error('Edge Function Error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
