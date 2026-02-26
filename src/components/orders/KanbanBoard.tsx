import { useMemo } from 'react';
import { KanbanColumn } from './KanbanColumn';
import type { EstadoOrdenTrabajo, CanalVenta } from '../../types/database';

interface OrdenData {
  id: string;
  numero_orden: string | null;
  estado: EstadoOrdenTrabajo;
  cliente?: {
    nombre_fantasia: string;
    numero_documento: string;
  };
  canal_venta: CanalVenta | null;
  fecha_creacion: string;
  total: number;
}

interface KanbanBoardProps {
  ordenes: OrdenData[];
}

interface ColumnConfig {
  estado: EstadoOrdenTrabajo;
  titulo: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const columnsConfig: ColumnConfig[] = [
  {
    estado: 'pendiente',
    titulo: 'Pendiente',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
  },
  {
    estado: 'en_proceso',
    titulo: 'En Proceso',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  },
  {
    estado: 'finalizada',
    titulo: 'Finalizada',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  },
  {
    estado: 'entregada',
    titulo: 'Entregada',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-300',
  },
];

export function KanbanBoard({ ordenes }: KanbanBoardProps) {
  const ordenesPorEstado = useMemo(() => {
    const grupos: Record<EstadoOrdenTrabajo, OrdenData[]> = {
      borrador: [],
      pendiente: [],
      en_proceso: [],
      finalizada: [],
      entregada: [],
      cancelada: [],
    };

    ordenes.forEach((orden) => {
      if (grupos[orden.estado]) {
        grupos[orden.estado].push(orden);
      }
    });

    return grupos;
  }, [ordenes]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columnsConfig.map((config) => (
        <div key={config.estado} className="flex-shrink-0 w-80">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-280px)] min-h-[500px] flex flex-col">
            <KanbanColumn
              estado={config.estado}
              titulo={config.titulo}
              ordenes={ordenesPorEstado[config.estado]}
              color={config.color}
              bgColor={config.bgColor}
              borderColor={config.borderColor}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
