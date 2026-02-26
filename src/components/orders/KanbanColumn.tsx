import { KanbanCard } from './KanbanCard';
import { Package } from 'lucide-react';
import type { EstadoOrdenTrabajo, CanalVenta } from '../../types/database';

interface OrdenData {
  id: string;
  numero_orden: string | null;
  cliente?: {
    nombre_fantasia: string;
    numero_documento: string;
  };
  canal_venta: CanalVenta | null;
  fecha_creacion: string;
  total: number;
}

interface KanbanColumnProps {
  estado: EstadoOrdenTrabajo;
  titulo: string;
  ordenes: OrdenData[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const estadoEmptyMessages: Record<EstadoOrdenTrabajo, string> = {
  borrador: 'No hay órdenes en borrador',
  pendiente: 'No hay órdenes pendientes',
  en_proceso: 'No hay órdenes en proceso',
  finalizada: 'No hay órdenes finalizadas',
  entregada: 'No hay órdenes entregadas',
  cancelada: 'No hay órdenes canceladas',
};

export function KanbanColumn({
  estado,
  titulo,
  ordenes,
  color,
  bgColor,
  borderColor,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col h-full">
      <div
        className={`${bgColor} ${borderColor} border-b-4 rounded-t-lg px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm`}
      >
        <h3 className={`text-sm font-bold ${color} uppercase tracking-wide`}>
          {titulo}
        </h3>
        <div
          className={`${color} ${bgColor} px-2.5 py-0.5 rounded-full text-xs font-bold border ${borderColor}`}
        >
          {ordenes.length}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3 min-h-[200px]">
        {ordenes.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[150px]">
            <div className="text-center">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{estadoEmptyMessages[estado]}</p>
            </div>
          </div>
        ) : (
          ordenes.map((orden) => (
            <KanbanCard
              key={orden.id}
              ordenId={orden.id}
              numeroOrden={orden.numero_orden}
              clienteNombre={orden.cliente?.nombre_fantasia || 'Sin cliente'}
              clienteDocumento={orden.cliente?.numero_documento || '-'}
              canalVenta={orden.canal_venta}
              fechaCreacion={orden.fecha_creacion}
              total={orden.total}
            />
          ))
        )}
      </div>
    </div>
  );
}
