import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { Badge } from '../ui/Badge';
import { formatDateDisplay, getArgentinaDate } from '../../utils/dates';
import { useIngresosPeriodo } from '../../hooks/useTesoreria';
import { useEgresos } from '../../hooks/useEgresos';
import { RegistrarIngresoModal } from './RegistrarIngresoModal';
import { RegistrarEgresoModal } from './RegistrarEgresoModal';
import { useIngresos } from '../../hooks/useIngresos';

interface MovimientosPanelProps {
  onMovimientoRegistrado?: () => void;
}

type TipoMovimiento = 'ingreso' | 'egreso';

interface MovimientoUnificado {
  id: string;
  tipo: TipoMovimiento;
  fecha: string;
  created_at?: string;
  concepto: string;
  categoria: string;
  cajaNombre?: string;
  medioNombre?: string;
  monto: number;
}

interface IngresoMovimiento {
  id: string;
  fecha: string;
  created_at?: string;
  concepto?: string;
  referencia_tipo?: string;
  tipo_ingreso_nombre?: string;
  monto?: number;
  caja?: { nombre?: string };
  medio_cobro?: { nombre?: string };
}

interface EgresoMovimiento {
  id: string;
  fecha: string;
  created_at?: string;
  concepto?: string;
  medio_pago?: string;
  monto?: number;
  caja?: { nombre?: string };
  tipo_egreso?: { nombre?: string };
}

export function MovimientosPanel({ onMovimientoRegistrado }: MovimientosPanelProps = {}) {
  const hoyArgentina = getArgentinaDate();
  const [fechaDesde, setFechaDesde] = useState<string>(hoyArgentina.subtract(6, 'day').format('YYYY-MM-DD'));
  const [fechaHasta, setFechaHasta] = useState<string>(hoyArgentina.format('YYYY-MM-DD'));
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showEgresoModal, setShowEgresoModal] = useState(false);

  const { ingresos, totalIngresos, loading: loadingIngresos, refetch: refetchIngresosPeriodo } = useIngresosPeriodo(
    fechaDesde,
    fechaHasta
  );
  const { createIngreso } = useIngresos();
  const {
    egresos,
    total: totalEgresos,
    loading: loadingEgresos,
    refetch: refetchEgresos,
    createEgreso,
  } = useEgresos({
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  });

  const loading = loadingIngresos || loadingEgresos;

  const movimientos = useMemo<MovimientoUnificado[]>(() => {
    const ingresosMapeados: MovimientoUnificado[] = ((ingresos || []) as IngresoMovimiento[]).map((ingreso) => ({
      id: `ing-${ingreso.id}`,
      tipo: 'ingreso',
      fecha: ingreso.fecha,
      created_at: ingreso.created_at,
      concepto: ingreso.concepto || 'Ingreso',
      categoria:
        ingreso.referencia_tipo === 'ingreso_manual'
          ? ingreso.tipo_ingreso_nombre || 'Ingreso manual'
          : 'Pago de venta',
      cajaNombre: ingreso.caja?.nombre,
      medioNombre: ingreso.medio_cobro?.nombre,
      monto: Number(ingreso.monto || 0),
    }));

    const egresosMapeados: MovimientoUnificado[] = ((egresos || []) as EgresoMovimiento[]).map((egreso) => ({
      id: `egr-${egreso.id}`,
      tipo: 'egreso',
      fecha: egreso.fecha,
      created_at: egreso.created_at,
      concepto: egreso.concepto || 'Egreso',
      categoria: egreso.tipo_egreso?.nombre || 'Egreso',
      cajaNombre: egreso.caja?.nombre,
      medioNombre: egreso.medio_pago || '-',
      monto: Number(egreso.monto || 0),
    }));

    return [...ingresosMapeados, ...egresosMapeados].sort((a, b) => {
      // fecha es YYYY-MM-DD: ordenar lexicográficamente evita corrimientos por timezone.
      const fechaComp = b.fecha.localeCompare(a.fecha);
      if (fechaComp !== 0) return fechaComp;
      return new Date(b.created_at || b.fecha).getTime() - new Date(a.created_at || a.fecha).getTime();
    });
  }, [egresos, ingresos]);

  const saldoNeto = totalIngresos - totalEgresos;

  const setHoy = () => {
    const todayStr = getArgentinaDate().format('YYYY-MM-DD');
    setFechaDesde(todayStr);
    setFechaHasta(todayStr);
  };

  const setUltimaSemana = () => {
    const today = getArgentinaDate();
    setFechaDesde(today.subtract(6, 'day').format('YYYY-MM-DD'));
    setFechaHasta(today.format('YYYY-MM-DD'));
  };

  const setUltimos10Dias = () => {
    const today = getArgentinaDate();
    setFechaDesde(today.subtract(9, 'day').format('YYYY-MM-DD'));
    setFechaHasta(today.format('YYYY-MM-DD'));
  };

  const setUltimoMes = () => {
    const today = getArgentinaDate();
    setFechaDesde(today.subtract(29, 'day').format('YYYY-MM-DD'));
    setFechaHasta(today.format('YYYY-MM-DD'));
  };

  const refetchAll = async () => {
    await Promise.all([refetchIngresosPeriodo(), refetchEgresos()]);
    onMovimientoRegistrado?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={setHoy}>Hoy</Button>
          <Button variant="secondary" size="sm" onClick={setUltimaSemana}>Última Semana</Button>
          <Button variant="secondary" size="sm" onClick={setUltimos10Dias}>Últimos 10 días</Button>
          <Button variant="secondary" size="sm" onClick={setUltimoMes}>Último Mes</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowIngresoModal(true)}>
            <Plus className="h-4 w-4" /> Ingreso
          </Button>
          <Button size="sm" onClick={() => setShowEgresoModal(true)}>
            <Plus className="h-4 w-4" /> Egreso
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Desde</label>
          <DatePicker value={fechaDesde} onChange={(date) => date && setFechaDesde(date)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Hasta</label>
          <DatePicker value={fechaHasta} onChange={(date) => date && setFechaHasta(date)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-700">Ingresos</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase text-rose-700">Egresos</p>
          <p className="mt-1 text-xl font-bold text-rose-700">${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">Saldo neto</p>
          <p className={`mt-1 text-xl font-bold ${saldoNeto >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
            ${saldoNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Detalle de Movimientos</h3>
          <p className="mt-1 text-sm text-gray-500">
            {formatDateDisplay(fechaDesde)} - {formatDateDisplay(fechaHasta)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Concepto</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Caja</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Medio</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Cargando movimientos...</td>
                </tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay movimientos en este período</td>
                </tr>
              ) : (
                movimientos.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{formatDateDisplay(mov.fecha)}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {mov.tipo === 'ingreso' ? (
                        <Badge variant="success" className="flex w-fit items-center gap-1">
                          <ArrowUpRight className="h-3 w-3" /> Ingreso
                        </Badge>
                      ) : (
                        <Badge variant="danger" className="flex w-fit items-center gap-1">
                          <ArrowDownRight className="h-3 w-3" /> Egreso
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <p className="font-medium">{mov.concepto}</p>
                      <p className="text-xs text-gray-500">{mov.categoria}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{mov.cajaNombre || '-'}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{mov.medioNombre || '-'}</td>
                    <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${
                      mov.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {mov.tipo === 'ingreso' ? '+' : '-'}$
                      {Math.abs(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RegistrarIngresoModal
        isOpen={showIngresoModal}
        onClose={() => setShowIngresoModal(false)}
        onSuccess={async () => {
          setShowIngresoModal(false);
          await refetchAll();
        }}
        onSubmit={async (data) => {
          await createIngreso(data);
        }}
      />

      <RegistrarEgresoModal
        isOpen={showEgresoModal}
        onClose={() => setShowEgresoModal(false)}
        onSuccess={async () => {
          setShowEgresoModal(false);
          await refetchAll();
        }}
        onSubmit={createEgreso}
      />
    </div>
  );
}
