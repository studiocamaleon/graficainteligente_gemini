import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { formatPhoneNumber } from '../_shared/messageGenerators.ts';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
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
    mensaje: string,
    tipoNotificacion: string, // 'cliente' | 'staff'
    visitaId: string,
    supabase: any
): Promise<any> {

    console.log(`[WhatsApp] Sending to ${telefono}: ${mensaje.substring(0, 50)}...`);

    let resultado;
    try {
        const response = await fetch(`${WHATSAPP_BACKEND_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId, to: telefono, message: mensaje }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || response.statusText);
        }
        resultado = await response.json();

        // Log Success
        await supabase.from('whatsapp_notificaciones').insert({
            company_id: companyId,
            visita_id: visitaId,
            tipo_notificacion: tipoNotificacion === 'cliente' ? 'nueva_visita_cliente_web' : 'nueva_visita_staff_web',
            telefono_destino: telefono,
            mensaje_enviado: mensaje,
            estado_envio: 'enviado',
            respuesta_backend: resultado
        });

    } catch (error: any) {
        console.error(`Error sending message to ${telefono}:`, error);

        // Log Failure
        await supabase.from('whatsapp_notificaciones').insert({
            company_id: companyId,
            visita_id: visitaId,
            tipo_notificacion: tipoNotificacion === 'cliente' ? 'nueva_visita_cliente_web' : 'nueva_visita_staff_web',
            telefono_destino: telefono,
            mensaje_enviado: mensaje,
            estado_envio: 'fallido',
            error_mensaje: error.message || 'Error desconocido'
        });

        // Don't throw to allow other notifications to proceed (soft fail)
    }

    return resultado;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { company_id, cliente_nombre, cliente_whatsapp, domicilio, fecha_inicio, fecha_fin, titulo, notas } = await req.json();

        if (!company_id || !cliente_nombre || !fecha_inicio || !fecha_fin) {
            throw new Error("Faltan datos requeridos");
        }

        // 1. Format Phone Number
        const formattedPhone = formatPhoneNumber(cliente_whatsapp);

        // 2. Validate Availability
        const { data: overlaps, error: overlapError } = await supabase
            .from('visitas')
            .select('id')
            .eq('company_id', company_id)
            .neq('estado', 'cancelada')
            .lt('fecha_inicio', fecha_fin)
            .gt('fecha_fin', fecha_inicio);

        if (overlapError) throw overlapError;
        if (overlaps && overlaps.length > 0) {
            return new Response(
                JSON.stringify({ success: false, error: 'El horario seleccionado ya está ocupado.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Insert Visit
        const { data: visita, error: insertError } = await supabase
            .from('visitas')
            .insert({
                company_id,
                titulo: titulo || `Visita Web - ${cliente_nombre}`,
                cliente_nombre,
                cliente_whatsapp: formattedPhone, // Save formatted
                domicilio,
                fecha_inicio,
                fecha_fin,
                estado: 'confirmada',
                descripcion: notas,
                notif_cliente_creacion_env: false, // Update after sending
                notif_staff_creacion_env: false
            })
            .select()
            .single();

        if (insertError) throw insertError;

        console.log(`Visit created: ${visita.id}`);

        // 4. Send Notifications
        const isConnected = await verificarWhatsAppDisponible(company_id);
        const results = { client: false, staff: false };

        if (isConnected) {
            // Helper to capitalize first letter
            const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

            // Format Date and Time for Argentina
            const dateObj = new Date(fecha_inicio);

            const timeOptions: Intl.DateTimeFormatOptions = {
                timeZone: 'America/Argentina/Buenos_Aires',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };
            const dateOptions: Intl.DateTimeFormatOptions = {
                timeZone: 'America/Argentina/Buenos_Aires',
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            };

            const timeStr = new Intl.DateTimeFormat('es-AR', timeOptions).format(dateObj); // e.g. "14:00" or "09:00"
            // Note: weekday and month in es-AR are lowercase. capitalize logic needed if strict match desired.
            let dateStr = new Intl.DateTimeFormat('es-AR', dateOptions).format(dateObj);

            // Capitalize words in dateStr for better aesthetic (e.g. "Lunes 23 De Diciembre")
            dateStr = dateStr.replace(/\b\w/g, l => l.toUpperCase());

            // A. Client Notification
            try {
                // Get Company Name
                const { data: company } = await supabase.from('companies').select('name, contact_phone').eq('id', company_id).single();
                const companyName = company?.name || 'la empresa';

                const clienteFirstName = cliente_nombre.split(' ')[0];
                const saludo = `Hola ${clienteFirstName}!`;

                // Template matching lib/whatsappVisitas.ts
                const msgCliente = `${saludo} 👋\n\nTe confirmamos tu visita técnica para el día *${dateStr}* a las *${timeStr}* hs.\n\n📍 Domicilio: ${domicilio}\n📋 Motivo: ${titulo || 'Visita Web'}\n\nGracias por elegirnos.\nEquipo de *${companyName}*`;

                await enviarMensajeWhatsApp(company_id, formattedPhone, msgCliente, 'cliente', visita.id, supabase);

                // Update flag
                await supabase.from('visitas').update({ notif_cliente_creacion_env: true }).eq('id', visita.id);
                results.client = true;
            } catch (e: any) {
                console.error('Error flow client notification:', e);
            }

            // B. Staff Notification (Notify Company Phone, and ideally all staff but let's stick to company phone + active staff if possible)
            try {
                // Fetch Active Staff to notify
                const { data: staffList } = await supabase
                    .from('visitas_staff')
                    .select('telefono')
                    .eq('company_id', company_id)
                    .eq('activo', true);

                const phonesToNotify = new Set<string>();

                const { data: company } = await supabase.from('companies').select('contact_phone').eq('id', company_id).single();
                if (company?.contact_phone) phonesToNotify.add(formatPhoneNumber(company.contact_phone));

                if (staffList) {
                    staffList.forEach((s: any) => {
                        if (s.telefono) phonesToNotify.add(formatPhoneNumber(s.telefono));
                    });
                }

                if (phonesToNotify.size > 0) {
                    const msgStaff = `🚨 *NUEVA RESERVA WEB*\n\n📅 Fecha: ${dateStr}\n⏰ Hora: ${timeStr}\n👤 Cliente: ${cliente_nombre}\n📍 Domicilio: ${domicilio}\n📝 Título: ${titulo || 'Visita Web'}\n📄 Notas: ${notas || '-'}\n📱 Tel: ${formattedPhone}`;

                    for (const phone of phonesToNotify) {
                        await enviarMensajeWhatsApp(company_id, phone, msgStaff, 'staff', visita.id, supabase);
                    }

                    // Update flag
                    await supabase.from('visitas').update({ notif_staff_creacion_env: true }).eq('id', visita.id);
                    results.staff = true;
                }
            } catch (e: any) {
                console.error('Error flow staff notification:', e);
            }
        }

        return new Response(
            JSON.stringify({ success: true, visita, notifications: results }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('Error in public-book-visit:', err);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
