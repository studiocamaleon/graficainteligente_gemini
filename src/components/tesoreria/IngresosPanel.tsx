import { useState, useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { useIngresosPeriodo } from '../../hooks/useTesoreria';

export function IngresosPanel() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [fechaDesde, setFechaDesde] = useState<Date>(hoy);
  const [fechaHasta, setFechaHasta] = useState<Date>(hoy);

  const fechaDesdeStr = useMemo(() => {
    return fechaDesde instanceof Date && !isNaN(fechaDesde.getTime())
      ? fechaDesde.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
  }, [fechaDesde]);

  const fechaHastaStr = useMemo(() => {
    return fechaHasta instanceof Date && !isNaN(fechaHasta.getTime())
      ? fechaHasta.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
  }, [fechaHasta]);

  const { ingresos, totalIngresos, totalComisiones, loading } = useIngresosPeriodo(
    fechaDesdeStr,
    fechaHastaStr
  );

  const setHoy = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setFechaDesde(today);
    setFechaHasta(today);
  };

  const setAyer = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    setFechaDesde(yesterday);
    setFechaHasta(yesterday);
  };

  const setUltimaSemana = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    setFechaDesde(weekAgo);
    setFechaHasta(today);
  };

  const setUltimoMes = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    setFechaDesde(monthAgo);
    setFechaHasta(today);
  };

  return (
    <div className="space-y-6">
      {/* Filtros y Atajos */}
      <div className="space-y-4">
        {/* Botones de atajos de fecha */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={setHoy}
            className="text-xs"
          >
            Hoy
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={setAyer}
            className="text-xs"
          >
            Ayer
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={setUltimaSemana}
            className="text-xs"
          >
            Última Semana
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={setUltimoMes}
            className="text-xs"
          >
            Último Mes
          </Button>
        </div>

        {/* Selectores de fecha y totales */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
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

          {/* Card de totales más sutil */}
          <div className="flex gap-3">
            <div className="bg-white border border-green-200 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs text-gray-600">Ingresos del Período</p>
                  <p className="text-lg font-bold text-green-700">
                    ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  {totalComisiones > 0 && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Comisiones: -${totalComisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Ingresos */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Detalle de Ingresos</h3>
          <p className="text-sm text-gray-500 mt-1">
            {fechaDesde instanceof Date ? fechaDesde.toLocaleDateString('es-AR') : fechaDesdeStr} - {fechaHasta instanceof Date ? fechaHasta.toLocaleDateString('es-AR') : fechaHastaStr}
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
                      {ingreso.comision_aplicada && Number(ingreso.comision_aplicada) > 0
                        ? `-$${Number(ingreso.comision_aplicada).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
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
                    {totalComisiones > 0 ? `-$${totalComisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
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
