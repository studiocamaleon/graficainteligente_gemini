export interface WhatsappNotificacion {
    id: string;
    company_id: string;
    visita_id?: string | null;
    orden_id?: string | null;
    tipo_notificacion: string;
    telefono_destino: string;
    mensaje_enviado: string;
    estado_envio: 'enviado' | 'fallido' | 'pendiente';
    respuesta_backend?: any;
    error_mensaje?: string | null;
    created_at: string;
}
