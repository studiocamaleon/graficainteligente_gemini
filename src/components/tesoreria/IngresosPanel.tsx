import { useState, useMemo } from 'react';
import { TrendingUp, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { Badge } from '../ui/Badge';
import { formatDateDisplay } from '../../utils/dates';
import { useIngresosPeriodo } from '../../hooks/useTesoreria';
import { useIngresos } from '../../hooks/useIngresos';
import { RegistrarIngresoModal } from './RegistrarIngresoModal';

interface IngresosPanelProps {
  onIngresoRegistrado?: () => void;
}

export function IngresosPanel({ onIngresoRegistrado }: IngresosPanelProps = {}) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [fechaDesde, setFechaDesde] = useState<string>(hoy.toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState<string>(hoy.toISOString().split('T')[0]);
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);

  const { ingresos, totalIngresos, totalComisiones, loading, refetch } = useIngresosPeriodo(
    fechaDesde,
    fechaHasta
  );

  const { createIngreso } = useIngresos();

  const setHoy = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setFechaDesde(todayStr);
    setFechaHasta(todayStr);
  };

  const setAyer = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    setFechaDesde(yesterdayStr);
    setFechaHasta(yesterdayStr);
  };

  const setUltimaSemana = () => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    setFechaDesde(weekAgo.toISOString().split('T')[0]);
    setFechaHasta(today.toISOString().split('T')[0]);
  };

  const setUltimoMes = () => {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    setFechaDesde(monthAgo.toISOString().split('T')[0]);
    setFechaHasta(today.toISOString().split('T')[0]);
  };

  const getTipoIngresoBadge = (ingreso: any) => {
    if (ingreso.referencia_tipo === 'ingreso_manual') {
      return (
        <Badge variant="success" className="bg-green-100 text-green-700 border-green-300">
          {ingreso.tipo_ingreso_nombre || 'Ingreso Manual'}
        </Badge>
      );
    }
    return (
      <Badge variant="info" className="bg-blue-100 text-blue-700 border-blue-300">
        Pago de Venta
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtros y Atajos */}
      <div className="space-y-4">
        {/* Botones de atajos de fecha */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
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

          <Button onClick={() => setShowRegistrarModal(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Registrar Ingreso
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

          {/* Card de totales */}
          <div className="flex gap-3">
            <div className="bg-white border border-green-200 rounded-lg px-6 py-3 shadow-sm min-w-[280px]">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Ingresos del Período</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  {totalComisiones > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Comisiones: -${totalComisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">{ingresos.length} movimientos</p>
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
            {formatDateDisplay(fechaDesde)} - {formatDateDisplay(fechaHasta)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Cargando ingresos...
                  </td>
                </tr>
              ) : ingresos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No hay ingresos en este período
                  </td>
                </tr>
              ) : (
                ingresos.map((ingreso) => (
                  <tr key={ingreso.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateDisplay(ingreso.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTipoIngresoBadge(ingreso)}
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
                  <td colSpan={5} className="px-6 py-3 text-right text-sm text-gray-900">
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

      {/* Modal de Registro */}
      <RegistrarIngresoModal
        isOpen={showRegistrarModal}
        onClose={() => setShowRegistrarModal(false)}
        onSuccess={() => {
          refetch();
          onIngresoRegistrado?.();
          setShowRegistrarModal(false);
        }}
        onSubmit={async (data) => {
          await createIngreso(data);
        }}
      />
    </div>
  );
}
