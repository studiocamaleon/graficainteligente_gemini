import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { getArgentinaDate } from '../../utils/dates';
import { useIngresosPeriodo } from '../../hooks/useTesoreria';
import { useEgresos } from '../../hooks/useEgresos';
import { RegistrarIngresoModal } from './RegistrarIngresoModal';
import { RegistrarEgresoModal } from './RegistrarEgresoModal';
import { useIngresos } from '../../hooks/useIngresos';
import { useCajas } from '../../hooks/useCajas';
import { MovimientosFiltersBar, type MovimientoTipoFiltro } from '../tesoreria-v2/MovimientosFiltersBar';
import { formatMovimientoFecha, formatMovimientoMonto } from '../tesoreria-v2/movimientos-formatters';
import { normalizeMedioKey, normalizeMedioLabel } from '../tesoreria-v2/movimientos-normalizers';

interface MovimientosPanelProps {
  onMovimientoRegistrado?: () => void;
}

type TipoMovimiento = 'ingreso' | 'egreso';

interface MovimientoUnificadoV2 {
  id: string;
  tipo: TipoMovimiento;
  fecha: string;
  created_at?: string;
  concepto: string;
  categoria: string;
  caja_id: string | null;
  caja_nombre: string;
  medio_key: string;
  medio_nombre: string;
  monto: number;
}

interface IngresoMovimiento {
  id: string;
  fecha: string;
  created_at?: string;
  caja_id?: string | null;
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
  caja_id?: string | null;
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
  const [filtroCajaId, setFiltroCajaId] = useState<string>('all');
  const [filtroMedioKey, setFiltroMedioKey] = useState<string>('all');
  const [filtroTipo, setFiltroTipo] = useState<MovimientoTipoFiltro>('all');
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showEgresoModal, setShowEgresoModal] = useState(false);

  const { resumenPorTipo, refetch: refetchCajas } = useCajas();
  const { ingresos, loading: loadingIngresos, refetch: refetchIngresosPeriodo } = useIngresosPeriodo(
    fechaDesde,
    fechaHasta
  );
  const { createIngreso } = useIngresos();
  const {
    egresos,
    loading: loadingEgresos,
    refetch: refetchEgresos,
    createEgreso,
  } = useEgresos({
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
  });

  const loading = loadingIngresos || loadingEgresos;

  const movimientos = useMemo<MovimientoUnificadoV2[]>(() => {
    const ingresosMapeados: MovimientoUnificadoV2[] = ((ingresos || []) as IngresoMovimiento[]).map((ingreso) => {
      const medioNombre = normalizeMedioLabel(ingreso.medio_cobro?.nombre);
      return {
        id: `ing-${ingreso.id}`,
        tipo: 'ingreso',
        fecha: ingreso.fecha,
        created_at: ingreso.created_at,
        concepto: ingreso.concepto || 'Ingreso',
        categoria:
          ingreso.referencia_tipo === 'ingreso_manual'
            ? ingreso.tipo_ingreso_nombre || 'Ingreso manual'
            : 'Pago de venta',
        caja_id: ingreso.caja_id || null,
        caja_nombre: ingreso.caja?.nombre || 'Sin caja',
        medio_key: normalizeMedioKey(medioNombre),
        medio_nombre: medioNombre,
        monto: Number(ingreso.monto || 0),
      };
    });

    const egresosMapeados: MovimientoUnificadoV2[] = ((egresos || []) as EgresoMovimiento[]).map((egreso) => {
      const medioNombre = normalizeMedioLabel(egreso.medio_pago);
      return {
        id: `egr-${egreso.id}`,
        tipo: 'egreso',
        fecha: egreso.fecha,
        created_at: egreso.created_at,
        concepto: egreso.concepto || 'Egreso',
        categoria: egreso.tipo_egreso?.nombre || 'Egreso',
        caja_id: egreso.caja_id || null,
        caja_nombre: egreso.caja?.nombre || 'Sin caja',
        medio_key: normalizeMedioKey(medioNombre),
        medio_nombre: medioNombre,
        monto: Number(egreso.monto || 0),
      };
    });

    return [...ingresosMapeados, ...egresosMapeados].sort((a, b) => {
      const fechaComp = b.fecha.localeCompare(a.fecha);
      if (fechaComp !== 0) return fechaComp;
      return new Date(b.created_at || b.fecha).getTime() - new Date(a.created_at || a.fecha).getTime();
    });
  }, [egresos, ingresos]);

  const cajaOptions = useMemo(() => {
    const cajas = resumenPorTipo.flatMap((grupo) => grupo.cajas);
    return [
      { value: 'all', label: 'Todas las cajas' },
      ...cajas.map((caja) => ({ value: caja.id, label: caja.nombre })),
    ];
  }, [resumenPorTipo]);

  const medioOptions = useMemo(() => {
    const unique = new Map<string, string>();
    movimientos.forEach((mov) => {
      if (!unique.has(mov.medio_key)) {
        unique.set(mov.medio_key, mov.medio_nombre);
      }
    });

    return [
      { value: 'all', label: 'Todos los medios' },
      ...Array.from(unique.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    ];
  }, [movimientos]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((mov) => {
      if (filtroTipo !== 'all' && mov.tipo !== filtroTipo) return false;
      if (filtroCajaId !== 'all' && mov.caja_id !== filtroCajaId) return false;
      if (filtroMedioKey !== 'all' && mov.medio_key !== filtroMedioKey) return false;
      return true;
    });
  }, [movimientos, filtroTipo, filtroCajaId, filtroMedioKey]);

  const totalIngresosFiltrados = useMemo(
    () => movimientosFiltrados.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0),
    [movimientosFiltrados]
  );

  const totalEgresosFiltrados = useMemo(
    () => movimientosFiltrados.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0),
    [movimientosFiltrados]
  );

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

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) {
      setUltimaSemana();
      return;
    }
    setFechaDesde(startDate);
    setFechaHasta(endDate);
  };

  const refetchAll = async () => {
    await Promise.all([refetchIngresosPeriodo(), refetchEgresos(), refetchCajas()]);
    onMovimientoRegistrado?.();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_12%_12%,#d9f4ff_0%,#ffffff_42%,#f8fafc_100%)] p-5 shadow-md">
        <h3 className="text-xl font-semibold text-slate-900">Movimientos de Tesorería</h3>
        <p className="mt-1 text-sm text-slate-600">
          Registro unificado de ingresos y egresos con filtros operativos.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ingresos</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              $ {formatMovimientoMonto(totalIngresosFiltrados)}
            </p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Egresos</p>
            <p className="mt-1 text-xl font-bold text-rose-700">
              $ {formatMovimientoMonto(totalEgresosFiltrados)}
            </p>
          </div>
        </div>
      </div>

      <MovimientosFiltersBar
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onDateRangeChange={handleDateRangeChange}
        onPresetHoy={setHoy}
        onPreset7Dias={setUltimaSemana}
        onPreset10Dias={setUltimos10Dias}
        onPreset30Dias={setUltimoMes}
        filtroCajaId={filtroCajaId}
        onFiltroCajaIdChange={setFiltroCajaId}
        cajaOptions={cajaOptions}
        filtroMedioKey={filtroMedioKey}
        onFiltroMedioKeyChange={setFiltroMedioKey}
        medioOptions={medioOptions}
        filtroTipo={filtroTipo}
        onFiltroTipoChange={setFiltroTipo}
        onCrearIngreso={() => setShowIngresoModal(true)}
        onCrearEgreso={() => setShowEgresoModal(true)}
      />

      <Card className="overflow-hidden border-slate-200 bg-white shadow-md">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Detalle de Movimientos</h3>
          <p className="mt-1 text-sm text-slate-500">
            {formatMovimientoFecha(fechaDesde)} - {formatMovimientoFecha(fechaHasta)} · {movimientosFiltrados.length} movimientos
          </p>
        </div>

        <div className="overflow-x-auto rounded-b-xl border-t border-slate-200">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-slate-200">
              <tr>
                <th className="px-6 py-3 text-left">Fecha</th>
                <th className="px-6 py-3 text-left">Tipo</th>
                <th className="px-6 py-3 text-left">Concepto</th>
                <th className="px-6 py-3 text-left">Caja</th>
                <th className="px-6 py-3 text-left">Medio</th>
                <th className="px-6 py-3 text-right">Monto</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Cargando movimientos...</td>
                </tr>
              ) : movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No hay movimientos con los filtros seleccionados</td>
                </tr>
              ) : (
                movimientosFiltrados.map((mov, idx) => (
                  <tr key={mov.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-800">{formatMovimientoFecha(mov.fecha)}</td>
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
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <p className="font-medium">{mov.concepto}</p>
                      <p className="text-xs text-slate-500">{mov.categoria}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{mov.caja_nombre}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{mov.medio_nombre}</td>
                    <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${
                      mov.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {mov.tipo === 'ingreso' ? '+' : '-'}$ {formatMovimientoMonto(Math.abs(mov.monto))}
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
