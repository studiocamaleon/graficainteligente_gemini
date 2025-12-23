import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { formatPhoneNumber } from '../_shared/messageGenerators.ts';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const WHATSAPP_BACKEND_URL = Deno.env.get('WHATSAPP_BACKEND_URL') || 'https://whatsapp-backend-w6ot.onrender.com';

async function verificarWhatsAppDisponible(companyId: string): Promise<boolean> {
    try {
        const response = await fetch(`${WHATSAPP_BACKEND_URL}/status/${companyId}`);
        if (!response.ok) return false;
        const data = await response.json();
        return data.connected === true;
    } catch (error) {
        console.error('[WhatsApp] Error verificando estado:', error);
        return false;
    }
}

async function enviarMensajeWhatsApp(
    companyId: string,
    telefono: string,
    mensaje: string
): Promise<any> {
    const response = await fetch(`${WHATSAPP_BACKEND_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, to: telefono, message: mensaje }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || response.statusText);
    }

    return response.json();
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000); // Now + 1h
        // const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000); // Now + 30m

        // Strategy: 
        // 1. Fetch visits that are CONFIRMED and NOT completed/cancelled.
        // 2. Filter Client Reminders: Start time is between NOW and NOW+65min AND !notif_cliente_1h_env
        // 3. Filter Staff Reminders: Start time is between NOW and NOW+35min AND !notif_staff_30m_env

        // We fetch a bit wider range to catch any missed in the last cron tick (assuming 15 min tick)
        // Range: Now to Now + 75 min
        const upperLimit = new Date(now.getTime() + 75 * 60 * 1000);

        const { data: visits, error } = await supabase
            .from('visitas')
            .select(`
                *,
                company:company_id (
                    id,
                    contact_phone,
                    name
                )
            `)
            .eq('estado', 'confirmada')
            .gte('fecha_inicio', now.toISOString())
            .lte('fecha_inicio', upperLimit.toISOString());

        if (error) throw error;

        const results = {
            client_reminders: 0,
            staff_reminders: 0,
            errors: [] as any[]
        };

        if (!visits || visits.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: 'No pending reminders found', results }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Processing ${visits.length} potential visits for reminders...`);

        for (const visit of visits) {
            const start = new Date(visit.fecha_inicio);
            const diffMinutes = (start.getTime() - now.getTime()) / (1000 * 60);

            // --- CLIENT REMINDER (approx 60 min before) ---
            // Window: 45 to 75 minutes before (to be safe with cron intervals)
            if (!visit.notif_cliente_creacion_env && !visit.notif_cliente_1h_env && diffMinutes >= 45 && diffMinutes <= 75) {
                if (visit.cliente_whatsapp && visit.company) {
                    // Check WA connection
                    const isConnected = await verificarWhatsAppDisponible(visit.company_id);
                    if (isConnected) {
                        try {
                            const timeStr = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const msg = `Hola ${visit.cliente_nombre}, te recordamos tu visita con ${visit.company.name} hoy a las ${timeStr} hs.\n📍 Domicilio: ${visit.domicilio}. \n\nTe esperamos.`;

                            const phone = formatPhoneNumber(visit.cliente_whatsapp);
                            await enviarMensajeWhatsApp(visit.company_id, phone, msg);

                            // Update Flag
                            await supabase.from('visitas').update({ notif_cliente_1h_env: true }).eq('id', visit.id);
                            results.client_reminders++;
                            console.log(`Client reminder sent for visit ${visit.id}`);
                        } catch (e: any) {
                            console.error(`Error sending client reminder for ${visit.id}:`, e);
                            results.errors.push({ id: visit.id, type: 'client', error: e.message });
                        }
                    }
                }
            }

            // --- STAFF REMINDER (approx 30 min before) ---
            // Window: 15 to 45 minutes before
            if (!visit.notif_staff_30m_env && diffMinutes >= 15 && diffMinutes <= 45) {
                if (visit.company && visit.company.contact_phone) {
                    const isConnected = await verificarWhatsAppDisponible(visit.company_id);
                    if (isConnected) {
                        try {
                            const timeStr = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const msg = `🔔 *Próxima Visita en 30 min*\n\nCliente: ${visit.cliente_nombre}\nHora: ${timeStr} hs\nDirección: ${visit.domicilio}`;

                            const phone = formatPhoneNumber(visit.company.contact_phone);
                            await enviarMensajeWhatsApp(visit.company_id, phone, msg);

                            // Update Flag
                            await supabase.from('visitas').update({ notif_staff_30m_env: true }).eq('id', visit.id);
                            results.staff_reminders++;
                            console.log(`Staff reminder sent for visit ${visit.id}`);
                        } catch (e: any) {
                            console.error(`Error sending staff reminder for ${visit.id}:`, e);
                            results.errors.push({ id: visit.id, type: 'staff', error: e.message });
                        }
                    }
                }
            }
        }

        return new Response(
            JSON.stringify({ success: true, results }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('Critical Error:', err);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
