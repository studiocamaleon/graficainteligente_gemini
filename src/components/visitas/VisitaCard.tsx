import { Visita } from '../../types/database';
import { Badge } from '../ui/Badge';

interface VisitaCardProps {
    visita: Visita;
    onClick?: (visita: Visita) => void;
}

export function VisitaCard({ visita, onClick }: VisitaCardProps) {
    const statusColors = {
        pendiente: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        confirmada: 'bg-blue-100 border-blue-300 text-blue-800',
        completada: 'bg-green-100 border-green-300 text-green-800',
        cancelada: 'bg-red-100 border-red-300 text-red-800 opacity-60'
    };

    const statusDot = {
        pendiente: 'bg-yellow-500',
        confirmada: 'bg-blue-500',
        completada: 'bg-green-500',
        cancelada: 'bg-red-500'
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                if (onClick) onClick(visita);
            }}
            className={`
                h-full w-full rounded-md border p-1.5 text-xs shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]
                flex flex-col justify-center gap-0.5
                ${statusColors[visita.estado] || 'bg-gray-100 text-gray-800 border-gray-200'}
            `}
        >
            <div className="font-bold truncate leading-tight flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[visita.estado]}`}></span>
                {visita.cliente_nombre}
            </div>

            {visita.cliente_empresa && (
                <div className="truncate text-[10px] opacity-90 pl-3.5">
                    {visita.cliente_empresa}
                </div>
            )}
        </div>
    );
}
