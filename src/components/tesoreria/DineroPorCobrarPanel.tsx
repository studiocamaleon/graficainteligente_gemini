import { useState } from 'react';
import { DollarSign, Users, UserCheck, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { useSaldosPendientes, useOrdenesPorCobrar } from '../../hooks/useTesoreria';

export function DineroPorCobrarPanel() {
  const { saldos, loading: loadingSaldos } = useSaldosPendientes();
  const [tipoFiltro, setTipoFiltro] = useState<'cc' | 'sin_cc' | undefined>();
  const { ordenes, loading: loadingOrdenes } = useOrdenesPorCobrar(tipoFiltro);

  const getAntiguedadBadge = (dias: number) => {
    if (dias <= 7) {
      return { variant: 'success' as const, label: `${dias}d` };
    } else if (dias <= 15) {
      return { variant: 'warning' as const, label: `${dias}d` };
    } else {
      return { variant: 'error' as const, label: `${dias}d` };
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 mb-1">Total por Cobrar</p>
              <p className="text-2xl font-bold text-orange-900">
                ${saldos.total_pendiente.toLocaleString('es-AR')}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-orange-500 opacity-50" />
          </div>
        </Card>

        <Card
          padding="md"
          className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setTipoFiltro(tipoFiltro === 'cc' ? undefined : 'cc')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 mb-1">Cuenta Corriente</p>
              <p className="text-2xl font-bold text-blue-900">
                ${saldos.total_cc.toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-blue-600 mt-1">{saldos.cantidad_ordenes_cc} órdenes</p>
            </div>
            <UserCheck className="w-10 h-10 text-blue-500 opacity-50" />
          </div>
          {tipoFiltro === 'cc' && (
            <Badge variant="info" className="mt-2 text-xs">Filtrado</Badge>
          )}
        </Card>

        <Card
          padding="md"
          className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setTipoFiltro(tipoFiltro === 'sin_cc' ? undefined : 'sin_cc')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 mb-1">Clientes Directos</p>
              <p className="text-2xl font-bold text-green-900">
                ${saldos.total_sin_cc.toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-green-600 mt-1">{saldos.cantidad_ordenes_sin_cc} órdenes</p>
            </div>
            <Users className="w-10 h-10 text-green-500 opacity-50" />
          </div>
          {tipoFiltro === 'sin_cc' && (
            <Badge variant="success" className="mt-2 text-xs">Filtrado</Badge>
          )}
        </Card>
      </div>

      {/* Tabla de Órdenes */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Detalle de Órdenes Pendientes</h3>
          <p className="text-sm text-gray-500 mt-1">
            {tipoFiltro === 'cc' && 'Mostrando solo clientes con cuenta corriente'}
            {tipoFiltro === 'sin_cc' && 'Mostrando solo clientes directos'}
            {!tipoFiltro && 'Mostrando todas las órdenes con saldo pendiente'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pagado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Antigüedad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingOrdenes ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Cargando órdenes...
                  </td>
                </tr>
              ) : ordenes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No hay órdenes pendientes de cobro
                  </td>
                </tr>
              ) : (
                ordenes.map((orden) => {
                  const antiguedadBadge = getAntiguedadBadge(orden.dias_transcurridos);
                  return (
                    <tr key={orden.orden_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{orden.numero_orden}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(orden.fecha_creacion).toLocaleDateString('es-AR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {orden.tipo_orden === 'trabajo' ? (
                          <Badge variant="primary">Trabajo</Badge>
                        ) : (
                          <Badge variant="secondary">Copiado</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{orden.cliente_nombre}</div>
                        <div className="text-xs text-gray-500">{orden.cliente_documento}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {orden.tiene_cuenta_corriente ? (
                          <Badge variant="info">CC</Badge>
                        ) : (
                          <Badge variant="neutral">Directo</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        ${orden.total.toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                        ${orden.pagado.toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                        ${orden.saldo_pendiente.toLocaleString('es-AR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Badge variant={antiguedadBadge.variant}>
                          {antiguedadBadge.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
