import { useNavigate } from 'react-router-dom';
import { Calendar, DollarSign } from 'lucide-react';
import { ChannelBadge } from './ChannelBadge';
import { useAuth } from '../../hooks/useAuth';
import type { CanalVenta } from '../../types/database';

interface KanbanCardProps {
  ordenId: string;
  numeroOrden: string;
  clienteNombre: string;
  clienteDocumento: string;
  canalVenta: CanalVenta;
  fechaCreacion: string;
  total: number;
}

export function KanbanCard({
  ordenId,
  numeroOrden,
  clienteNombre,
  clienteDocumento,
  canalVenta,
  fechaCreacion,
  total,
}: KanbanCardProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const canViewPrices = profile?.role !== 'operador_taller';

  const handleClick = () => {
    navigate(`/app/orders/${ordenId}`);
  };

  const formattedDate = new Date(fechaCreacion).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });

  const formattedTotal = Number(total).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      onClick={handleClick}
      className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-blue-600 group-hover:text-blue-700 truncate">
            {numeroOrden}
          </h4>
          <p className="text-sm font-medium text-gray-900 truncate mt-0.5">
            {clienteNombre}
          </p>
          <p className="text-xs text-gray-500 truncate">{clienteDocumento}</p>
        </div>
        <div className="ml-2 flex-shrink-0">
          <ChannelBadge canal={canalVenta} showLabel={false} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{formattedDate}</span>
        </div>
        {canViewPrices && (
          <div className="flex items-center gap-1 font-semibold text-gray-900">
            <DollarSign className="w-3 h-3" />
            <span>{formattedTotal}</span>
          </div>
        )}
      </div>
    </div>
  );
}
