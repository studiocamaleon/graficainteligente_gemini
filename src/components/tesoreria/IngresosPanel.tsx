import { useState } from 'react';
import { TrendingUp, Calendar, Filter } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { DatePicker } from '../ui/DatePicker';
import { useIngresosPeriodo } from '../../hooks/useTesoreria';

export function IngresosPanel() {
  const [fechaDesde, setFechaDesde] = useState<Date>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const [fechaHasta, setFechaHasta] = useState<Date>(new Date());

  const { ingresos, totalIngresos, loading } = useIngresosPeriodo(
    fechaDesde.toISOString().split('T')[0],
    fechaHasta.toISOString().split('T')[0]
  );

  return (
    <div className="space-y-6">
      {/* Filtros y Total */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div className="flex-1">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-700">Ingresos del Período</p>
            </div>
            <p className="text-3xl font-bold text-green-900">
              ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-600 mt-1">{ingresos.length} movimientos</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Desde</label>
            <DatePicker
              value={fechaDesde}
              onChange={(date) => date && setFechaDesde(date)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hasta</label>
            <DatePicker
              value={fechaHasta}
              onChange={(date) => date && setFechaHasta(date)}
            />
          </div>
        </div>
      </div>

      {/* Tabla de Ingresos */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Detalle de Ingresos</h3>
          <p className="text-sm text-gray-500 mt-1">
            {fechaDesde.toLocaleDateString('es-AR')} - {fechaHasta.toLocaleDateString('es-AR')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caja</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medio</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Cargando ingresos...
                  </td>
                </tr>
              ) : ingresos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No hay ingresos en este período
                  </td>
                </tr>
              ) : (
                ingresos.map((ingreso) => (
                  <tr key={ingreso.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(ingreso.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {ingreso.concepto}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ingreso.caja?.nombre}</div>
                      <div className="text-xs text-gray-500">{ingreso.caja?.tipo}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ingreso.medio_cobro ? (
                        <div>
                          <div className="text-sm text-gray-900">{ingreso.medio_cobro.nombre}</div>
                          {ingreso.medio_cobro.categoria && (
                            <div className="text-xs text-gray-500">{ingreso.medio_cobro.categoria}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      ${Number(ingreso.monto).toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                      {ingreso.comision_aplicada > 0
                        ? `-$${Number(ingreso.comision_aplicada).toLocaleString('es-AR')}`
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {ingresos.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={4} className="px-6 py-3 text-right text-sm text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-green-600">
                    ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-red-600">
                    -${ingresos.reduce((sum, i) => sum + Number(i.comision_aplicada || 0), 0).toLocaleString('es-AR')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
