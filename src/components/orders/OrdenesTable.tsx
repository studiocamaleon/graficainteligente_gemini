import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Eye,
    MoreVertical,
    Calendar,
    AlertCircle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { OrdenTrabajoWithRelations } from '../../hooks/useOrdenesTrabajo';
import dayjs from 'dayjs';

interface OrdenesTableProps {
    ordenes: OrdenTrabajoWithRelations[];
}

export function OrdenesTable({ ordenes }: OrdenesTableProps) {
    const navigate = useNavigate();

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Orden / Cliente
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fechas
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Items
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total
                            </th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Acciones</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {ordenes.map((orden) => {
                            const porcentajePagado = orden.total > 0
                                ? ((orden.total_pagado || 0) / orden.total) * 100
                                : 0;
                            const estadoPago = porcentajePagado >= 100 ? 'pagado' : porcentajePagado > 0 ? 'parcial' : 'pendiente';

                            return (
                                <tr key={orden.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => navigate(`/app/orders/${orden.id}`)}>
                                                #{orden.numero_orden}
                                            </span>
                                            <span className="text-sm text-gray-900 font-medium mt-0.5">
                                                {orden.cliente?.nombre_fantasia || 'Cliente Desconocido'}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {orden.cliente?.numero_documento}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <OrderStatusBadge estado={orden.estado} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center text-xs text-gray-500">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                Creación: {dayjs(orden.fecha_creacion).format('DD/MM/YY')}
                                            </div>
                                            {orden.fecha_estimada_entrega && (
                                                <div className={`flex items-center text-xs ${dayjs(orden.fecha_estimada_entrega).isBefore(dayjs(), 'day') && orden.estado !== 'entregada'
                                                    ? 'text-red-600 font-medium'
                                                    : 'text-gray-500'
                                                    }`}>
                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                    Entrega: {dayjs(orden.fecha_estimada_entrega).format('DD/MM/YY')}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {orden.items_count} items
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-900">
                                                ${Number(orden.total).toLocaleString('es-AR')}
                                            </span>
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${estadoPago === 'pagado' ? 'bg-green-100 text-green-800' :
                                                    estadoPago === 'parcial' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                    {estadoPago === 'pagado' ? 'Pagado' :
                                                        estadoPago === 'parcial' ? 'Parcial' : 'Impago'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => navigate(`/app/orders/${orden.id}`)}
                                        >
                                            <Eye className="w-4 h-4 text-gray-500" />
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
