import { MessageCircle } from 'lucide-react';


interface TrackingWhatsAppButtonProps {
    phoneNumber: string | null | undefined;
}

export function TrackingWhatsAppButton({ phoneNumber }: TrackingWhatsAppButtonProps) {
    if (!phoneNumber) return null;

    const getWhatsAppLink = (phone: string) => {
        // 1. Limpiar caracteres no numéricos
        let cleanPhone = phone.replace(/\D/g, '');

        // 2. Eliminar '0' inicial si existe (ej: 011...)
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }

        // 3. Eliminar '15' inicial si existe (ej: 15...)
        if (cleanPhone.startsWith('15')) {
            cleanPhone = cleanPhone.substring(2);
        }

        // 4. Asegurar prefijo de Argentina (54)
        // Asumimos que si no empieza con 54, hay que agregarlo.
        // Además, para móviles en Argentina, WhatsApp requiere '9' después del '54'.
        // Si el número tiene 10 dígitos (ej: 1112345678), agregamos 549.
        if (!cleanPhone.startsWith('54')) {
            cleanPhone = `549${cleanPhone}`;
        } else {
            // Si ya empieza con 54, verificamos si necesita el 9 (para móviles).
            // Esto es heurístico, pero común. Si tiene 12 dígitos (54 + 10), le suele faltar el 9.
            if (cleanPhone.length === 12 && !cleanPhone.startsWith('549')) {
                cleanPhone = `549${cleanPhone.substring(2)}`;
            }
        }

        const message = encodeURIComponent(
            'Estoy viendo la vista en tiempo real de mi trabajo y quería consultarles: '
        );

        return `https://wa.me/${cleanPhone}?text=${message}`;
    };

    const whatsappLink = getWhatsAppLink(phoneNumber);

    return (
        <div className="md:hidden fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full shadow-lg shadow-green-500/30 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-green-400/30"
                aria-label="Contactar por WhatsApp"
            >
                <MessageCircle className="w-8 h-8" />
            </a>
            {/* Tooltip flotante simple */}
            <div className="absolute bottom-full right-0 mb-2 w-max px-3 py-1 bg-gray-900/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Consultar por WhatsApp
            </div>
        </div>
    );
}
