import { useState } from 'react';
import { Search, Filter, Eye, FileText } from 'lucide-react';
import { useLiquidaciones } from '../../../hooks/useLiquidaciones';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { EstadoLiquidacion } from '../../../types/database';
import dayjs from 'dayjs';

export default function LiquidacionesView() {
  const [estadoFilter, setEstadoFilter] = useState<EstadoLiquidacion | ''>('');
  const [page, setPage] = useState(1);

  const { liquidaciones, totalCount, loading } = useLiquidaciones({
    estado: estadoFilter || undefined,
    page,
    itemsPerPage: 25,
  });

  const getEstadoBadge = (estado: EstadoLiquidacion) => {
    const badges: Record<EstadoLiquidacion, { color: string; text: string }> = {
      pendiente: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      pagada_parcial: { color: 'bg-blue-100 text-blue-800', text: 'Pago Parcial' },
      pagada_total: { color: 'bg-green-100 text-green-800', text: 'Pagada' },
      vencida: { color: 'bg-red-100 text-red-800', text: 'Vencida' },
      cancelada: { color: 'bg-gray-100 text-gray-800', text: 'Cancelada' },
    };

    const badge = badges[estado];
    return <Badge className={badge.color}>{badge.text}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-64 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Filter className="w-5 h-5 text-gray-400" />
          </div>
          <Select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as EstadoLiquidacion | '')}
            className="pl-10"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada_parcial">Pago Parcial</option>
            <option value="pagada_total">Pagada</option>
            <option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
          ))}
        </div>
      ) : liquidaciones.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay liquidaciones"
          description={
            estadoFilter
              ? 'No se encontraron liquidaciones con el estado seleccionado'
              : 'Aún no se han generado liquidaciones'
          }
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° Liquidación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Emisión
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pagado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {liquidaciones.map((liq) => (
                  <tr key={liq.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{liq.numero_liquidacion}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {dayjs(liq.fecha_emision).format('DD/MM/YYYY')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {liq.fecha_vencimiento
                          ? dayjs(liq.fecha_vencimiento).format('DD/MM/YYYY')
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${liq.total_general.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-green-600 font-medium">
                        ${liq.total_pagado.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div
                        className={`text-sm font-bold ${
                          liq.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        ${liq.saldo_pendiente.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getEstadoBadge(liq.estado)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => console.log('Ver detalle:', liq.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalCount > 25 && (
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="text-sm text-gray-700">
                Mostrando {liquidaciones.length} de {totalCount} liquidaciones
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
