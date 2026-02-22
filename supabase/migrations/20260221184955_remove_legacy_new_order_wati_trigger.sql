-- Remove legacy new-order WhatsApp trigger that posts old payload shape
-- to send-wati-message (missing company_id/phone/template_name contract).
-- New-order WhatsApp is handled by frontend sendWatiMessage() with template payload.

-- Drop triggers if they still exist (idempotent)
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden ON public.ordenes_trabajo;
DROP TRIGGER IF EXISTS trigger_notify_nueva_orden_copiado ON public.centro_copiado_ordenes;

-- Drop legacy function if present
DROP FUNCTION IF EXISTS public.fn_trigger_whatsapp_nueva_orden();
