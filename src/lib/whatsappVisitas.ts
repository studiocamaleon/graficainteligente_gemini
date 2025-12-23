import { supabase } from './supabase';
import { sendMessage, getConnectionStatus } from './whatsappApi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Visita } from '../types/database';

export async function notificarNuevaVisita(visitaId: string) {
    try {
        const { data: visitaData, error } = await supabase
            .from('visitas')
            .select('*')
            .eq('id', visitaId)
            .single();

        const visita = visitaData as Visita;

        if (error || !visita) throw new Error('Visita no encontrada');

        // 2. Fetch Company Settings (to check if WhatsApp is connected)
        const companyId = visita.company_id;
        const status = await getConnectionStatus(companyId);
        if (!status?.connected) {
            console.log('WhatsApp no conectado, omitiendo notificaciones');
            return;
        }

        const fechaFormateada = format(new Date(visita.fecha_inicio), "EEEE d 'de' MMMM", { locale: es });
        const horaFormateada = format(new Date(visita.fecha_inicio), "HH:mm");

        // 2b. Fetch Company Name for Signature
        const { data: companyDataRaw } = await supabase
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single();

        const companyData = companyDataRaw as { name: string } | null;
        const companyName = companyData?.name || 'la empresa';

        // 3. Notify Client
        if (visita.cliente_whatsapp) {
            const clienteNombre = visita.cliente_nombre ? visita.cliente_nombre.split(' ')[0] : '';
            const saludo = clienteNombre ? `Hola ${clienteNombre}!` : 'Hola!';

            const mensajeCliente = `${saludo} 👋\n\nTe confirmamos tu visita técnica para el día *${fechaFormateada}* a las *${horaFormateada}* hs.\n\n📍 Domicilio: ${visita.domicilio}\n📋 Motivo: ${visita.titulo}\n\nGracias por elegirnos.\nEquipo de *${companyName}*`;

            await enviarMensajeSeguro(companyId, visita.cliente_whatsapp, mensajeCliente, visitaId, 'cliente');
        }

        // 4. Notify ALL Active Staff
        const { data: staffListRaw } = await supabase
            .from('visitas_staff')
            .select('*')
            .eq('company_id', companyId)
            .eq('activo', true);

        const staffList = staffListRaw as any[];

        if (staffList && staffList.length > 0) {
            for (const staff of staffList) {
                const mensajeStaff = `🚨 *NUEVA VISITA AGENDADA*\n\n📅 Fecha: ${fechaFormateada}\n⏰ Hora: ${horaFormateada}\n👤 Cliente: ${visita.cliente_nombre || 'N/A'}\n📍 Domicilio: ${visita.domicilio}\n📝 Título: ${visita.titulo}\n📄 Desc.: ${visita.descripcion || '-'}`;

                await enviarMensajeSeguro(companyId, staff.telefono, mensajeStaff, visitaId, 'staff');
            }
        }

    } catch (err) {
        console.error('Error en notificarNuevaVisita:', err);
    }
}

async function enviarMensajeSeguro(companyId: string, telefono: string, mensaje: string, visitaId: string, destinatario: 'cliente' | 'staff') {
    try {
        // Clean phone
        let phone = telefono.replace(/[^0-9]/g, '');
        if (!phone.startsWith('54') && phone.length >= 10) phone = '54' + phone;

        // Send
        const res = await sendMessage(companyId, phone, mensaje);

        // Log Notification
        const payload: any = {
            company_id: companyId,
            visita_id: visitaId,
            tipo_notificacion: destinatario === 'cliente' ? 'nueva_visita_cliente' : 'nueva_visita_staff',
            telefono_destino: phone,
            mensaje_enviado: mensaje,
            estado_envio: 'enviado',
            respuesta_backend: res
        };
        await supabase.from('whatsapp_notificaciones').insert(payload);

    } catch (err: any) {
        console.error(`Error enviando a ${destinatario}:`, err);
        // Log Failure
        const errorPayload: any = {
            company_id: companyId,
            visita_id: visitaId,
            tipo_notificacion: destinatario === 'cliente' ? 'nueva_visita_cliente' : 'nueva_visita_staff',
            telefono_destino: telefono,
            mensaje_enviado: mensaje,
            estado_envio: 'fallido',
            error_mensaje: err.message || 'Error desconocido'
        };
        await supabase.from('whatsapp_notificaciones').insert(errorPayload);
    }
}
