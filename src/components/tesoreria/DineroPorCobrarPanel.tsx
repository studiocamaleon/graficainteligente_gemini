import { useMemo, useState } from 'react';
import { DollarSign, Users, UserCheck, CheckCircle2, Factory } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { useOrdenesPorCobrar } from '../../hooks/useTesoreria';

export function DineroPorCobrarPanel() {
  const [tipoFiltro, setTipoFiltro] = useState<'cc' | 'sin_cc' | undefined>();
  const [etapaFiltro, setEtapaFiltro] = useState<'all' | 'ready' | 'not_ready'>('all');
  const { ordenes, loading: loadingOrdenes } = useOrdenesPorCobrar(tipoFiltro);

  const isReadyToCollect = (estado?: string | null) => {
    const normalized = String(estado || '').toLowerCase();
    return normalized === 'finalizada' || normalized === 'entregada';
  };

  const resumenSaldos = useMemo(() => {
    let totalPendiente = 0;
    let totalCC = 0;
    let totalSinCC = 0;
    let cantidadCC = 0;
    let cantidadSinCC = 0;
    let totalFinalizadas = 0;
    let totalEntregadasCC = 0;
    let countFinalizadas = 0;
    let countEntregadasCC = 0;

    for (const orden of ordenes) {
      const saldo = Number(orden.saldo_pendiente || 0);
      const estado = String(orden.estado || '').toLowerCase();
      const isCC = Boolean(orden.tiene_cuenta_corriente);

      totalPendiente += saldo;
      if (isCC) {
        totalCC += saldo;
        cantidadCC += 1;
      } else {
        totalSinCC += saldo;
        cantidadSinCC += 1;
      }

      if (estado === 'finalizada') {
        totalFinalizadas += saldo;
        countFinalizadas += 1;
      }

      if (estado === 'entregada' && isCC) {
        totalEntregadasCC += saldo;
        countEntregadasCC += 1;
      }
    }

    return {
      totalPendiente,
      totalCC,
      totalSinCC,
      cantidadCC,
      cantidadSinCC,
      totalFinalizadas,
      totalEntregadasCC,
      countFinalizadas,
      countEntregadasCC,
    };
  }, [ordenes]);

  const resumenEtapas = useMemo(() => {
    let totalReady = 0;
    let totalNotReady = 0;
    let countReady = 0;
    let countNotReady = 0;

    for (const orden of ordenes) {
      if (isReadyToCollect(orden.estado)) {
        totalReady += Number(orden.saldo_pendiente || 0);
        countReady += 1;
      } else {
        totalNotReady += Number(orden.saldo_pendiente || 0);
        countNotReady += 1;
      }
    }

    return {
      totalReady,
      totalNotReady,
      countReady,
      countNotReady,
    };
  }, [ordenes]);

  const ordenesFiltradas = useMemo(() => {
    if (etapaFiltro === 'all') return ordenes;
    if (etapaFiltro === 'ready') return ordenes.filter((o) => isReadyToCollect(o.estado));
    return ordenes.filter((o) => !isReadyToCollect(o.estado));
  }, [ordenes, etapaFiltro]);

  const getAntiguedadBadge = (dias: number) => {
    if (dias <= 7) {
      return { variant: 'success' as const, label: `${dias}d` };
    } else if (dias <= 15) {
      return { variant: 'warning' as const, label: `${dias}d` };
    } else {
      return { variant: 'error' as const, label: `${dias}d` };
    }
  };

  const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/70 px-4 py-3">
        <p className="text-sm text-slate-700">
          Incluye finalizadas y entregadas con saldo (cuenta corriente). El total listo para cobrar se desglosa para reconciliar operación vs cobranza.
        </p>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total por Cobrar</p>
              <p className="text-2xl font-bold text-slate-900">
                {loadingOrdenes ? '...' : formatMoney(resumenSaldos.totalPendiente)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Saldo pendiente total (no todo es cobrable hoy)</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <DollarSign className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </Card>

        <Card
          className="cursor-pointer border-emerald-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => setEtapaFiltro(etapaFiltro === 'ready' ? 'all' : 'ready')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Listo para Cobrar</p>
              <p className="text-2xl font-bold text-emerald-900">
                {formatMoney(resumenEtapas.totalReady)}
              </p>
              <p className="mt-1 text-xs text-emerald-700">{resumenEtapas.countReady} órdenes finalizadas/entregadas</p>
              <p className="mt-1 text-[11px] text-emerald-800">
                Finalizadas: {formatMoney(resumenSaldos.totalFinalizadas)} | Entregadas CC: {formatMoney(resumenSaldos.totalEntregadasCC)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          {etapaFiltro === 'ready' && (
            <Badge variant="success" className="mt-2 text-xs">Filtrado</Badge>
          )}
        </Card>

        <Card
          className="cursor-pointer border-indigo-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => setEtapaFiltro(etapaFiltro === 'not_ready' ? 'all' : 'not_ready')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Aún no Finalizado</p>
              <p className="text-2xl font-bold text-indigo-900">
                {formatMoney(resumenEtapas.totalNotReady)}
              </p>
              <p className="mt-1 text-xs text-indigo-700">{resumenEtapas.countNotReady} órdenes en proceso</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
              <Factory className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          {etapaFiltro === 'not_ready' && (
            <Badge variant="info" className="mt-2 text-xs">Filtrado</Badge>
          )}
        </Card>

        <Card
          className="cursor-pointer border-blue-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => setTipoFiltro(tipoFiltro === 'cc' ? undefined : 'cc')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">Cuenta Corriente</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatMoney(resumenSaldos.totalCC)}
              </p>
              <p className="mt-1 text-xs text-blue-600">{resumenSaldos.cantidadCC} órdenes</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          {tipoFiltro === 'cc' && (
            <Badge variant="info" className="mt-2 text-xs">Filtrado</Badge>
          )}
        </Card>

        <Card
          className="cursor-pointer border-emerald-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          onClick={() => setTipoFiltro(tipoFiltro === 'sin_cc' ? undefined : 'sin_cc')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Clientes Directos</p>
              <p className="text-2xl font-bold text-green-900">
                {formatMoney(resumenSaldos.totalSinCC)}
              </p>
              <p className="mt-1 text-xs text-emerald-600">{resumenSaldos.cantidadSinCC} órdenes</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
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
            {tipoFiltro === 'cc' && 'Mostrando solo clientes con cuenta corriente. '}
            {tipoFiltro === 'sin_cc' && 'Mostrando solo clientes directos. '}
            {!tipoFiltro && 'Mostrando todos los tipos de cliente. '}
            {etapaFiltro === 'ready' && 'Solo órdenes listas para cobrar.'}
            {etapaFiltro === 'not_ready' && 'Solo órdenes aún no finalizadas.'}
            {etapaFiltro === 'all' && 'Incluye listas para cobrar y aún en producción.'}
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
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa Cobro</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pagado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Antigüedad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingOrdenes ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Cargando órdenes...
                  </td>
                </tr>
              ) : ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    No hay órdenes para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                ordenesFiltradas.map((orden) => {
                  const antiguedadBadge = getAntiguedadBadge(orden.dias_transcurridos);
                  const readyToCollect = isReadyToCollect(orden.estado);
                  const estadoNormalizado = String(orden.estado || '').toLowerCase();
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
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {estadoNormalizado === 'finalizada' ? (
                          <Badge variant="success">Finalizada</Badge>
                        ) : estadoNormalizado === 'entregada' && orden.tiene_cuenta_corriente ? (
                          <Badge variant="info">Entregada CC</Badge>
                        ) : readyToCollect ? (
                          <Badge variant="success">Entregada</Badge>
                        ) : (
                          <Badge variant="warning">No finalizado</Badge>
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
