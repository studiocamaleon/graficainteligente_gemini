import { useMemo, useState } from 'react';
import { Banknote, Landmark, Wallet, LayoutGrid, Table2 } from 'lucide-react';
import { CajaSummaryCard } from './CajaSummaryCard';
import type { ResumenCajaPorTipo, CajaConMediosCobro } from '../../types/medios-cobro';
import { ArqueoCajaModal } from './ArqueoCajaModal';
import { TransferirCajaModal } from './TransferirCajaModal';
import { CajaMovimientosModal } from './CajaMovimientosModal';
import { RegistrarEgresoModal } from './RegistrarEgresoModal';
import { useEgresos } from '../../hooks/useEgresos';
import { SearchInput } from '../ui/SearchInput';
import { Button } from '../ui/Button';

interface ResumenCajasProps {
  resumenPorTipo: ResumenCajaPorTipo[];
  totalSaldo: number;
  loading?: boolean;
  onCajaClick?: (cajaId: string) => void;
  onRefresh?: () => void;
}

type CajasViewMode = 'cards' | 'table';
type CajasSort = 'saldo_desc' | 'saldo_asc' | 'nombre_asc' | 'nombre_desc' | 'movimientos_desc';

const TIPO_LABELS = {
  efectivo: 'Efectivo',
  banco: 'Bancos',
  pasarela: 'Pasarelas de Pago',
};

const TIPO_ICONS = {
  efectivo: Banknote,
  banco: Landmark,
  pasarela: Wallet,
};

const TIPO_COLORS = {
  efectivo: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  banco: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
  pasarela: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    icon: 'text-purple-600',
  },
};

function CajasTotalHeader({ totalSaldo, totalCajas }: { totalSaldo: number; totalCajas: number }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.3)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Saldo consolidado</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
            ${totalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-400">Tesorería operativa en tiempo real</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-right backdrop-blur">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">Cajas activas</p>
          <p className="text-2xl font-semibold text-white">{totalCajas}</p>
        </div>
      </div>
    </div>
  );
}

function CajasTipoResumen({ resumenPorTipo }: { resumenPorTipo: ResumenCajaPorTipo[] }) {
  if (!resumenPorTipo.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {resumenPorTipo.map((resumen) => {
        const Icon = TIPO_ICONS[resumen.tipo];
        const colors = TIPO_COLORS[resumen.tipo];

        return (
          <div
            key={resumen.tipo}
            className={`rounded-xl border bg-white p-3.5 transition-all hover:shadow-sm ${colors.border}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={`${colors.bg} rounded-lg border p-1.5 ${colors.border}`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-semibold ${colors.text}`}>{TIPO_LABELS[resumen.tipo]}</h3>
                <p className="text-[11px] text-gray-500">
                  {resumen.cantidad_cajas} {resumen.cantidad_cajas === 1 ? 'caja' : 'cajas'}
                </p>
              </div>
            </div>
            <p className={`text-xl font-semibold ${colors.text}`}>
              ${resumen.total_saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

interface CajasToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTipo: 'todos' | 'efectivo' | 'banco' | 'pasarela';
  onTipoChange: (value: 'todos' | 'efectivo' | 'banco' | 'pasarela') => void;
  sortBy: CajasSort;
  onSortChange: (value: CajasSort) => void;
  viewMode: CajasViewMode;
  onViewModeChange: (value: CajasViewMode) => void;
  activeCount: number;
  totalCount: number;
  onClearFilters: () => void;
}

function CajasToolbar({
  search,
  onSearchChange,
  selectedTipo,
  onTipoChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  activeCount,
  totalCount,
  onClearFilters,
}: CajasToolbarProps) {
  return (
    <div className="sticky top-2 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_220px_auto]">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por nombre de caja, tipo o moneda..."
        />

        <select
          value={selectedTipo}
          onChange={(e) => onTipoChange(e.target.value as 'todos' | 'efectivo' | 'banco' | 'pasarela')}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="todos">Todos los tipos</option>
          <option value="efectivo">Efectivo</option>
          <option value="banco">Bancos</option>
          <option value="pasarela">Pasarelas</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as CajasSort)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="saldo_desc">Saldo (mayor a menor)</option>
          <option value="saldo_asc">Saldo (menor a mayor)</option>
          <option value="nombre_asc">Nombre (A-Z)</option>
          <option value="nombre_desc">Nombre (Z-A)</option>
          <option value="movimientos_desc">Más actividad hoy</option>
        </select>

        <div className="flex items-center justify-between gap-2 xl:justify-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              Tabla
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs">
            Limpiar
          </Button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
        <span>Mostrando {activeCount} de {totalCount} cajas</span>
        <span className="hidden sm:inline">Vista operativa de cajas y saldos</span>
      </div>
    </div>
  );
}

interface CajasTableViewProps {
  cajas: CajaConMediosCobro[];
  onArqueo: (caja: CajaConMediosCobro) => void;
  onTransferir: (caja: CajaConMediosCobro) => void;
  onHistory: (caja: CajaConMediosCobro) => void;
  onRetiro: (caja: CajaConMediosCobro) => void;
  onCajaClick?: (cajaId: string) => void;
}

function CajasTableView({ cajas, onArqueo, onTransferir, onHistory, onRetiro, onCajaClick }: CajasTableViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500">Caja</th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500">Tipo</th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 text-right">Saldo</th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 text-right">Ingresos hoy</th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 text-right">Egresos hoy</th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 text-right">Mov.</th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cajas.map((caja) => {
              const ingresosHoy = caja.ingresos_hoy || 0;
              const egresosHoy = caja.egresos_hoy || 0;
              const movimientosHoy = caja.movimientos_hoy || 0;
              return (
                <tr
                  key={caja.id}
                  className="transition-colors hover:bg-slate-50/70"
                  onClick={() => onCajaClick?.(caja.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">{caja.nombre}</div>
                    <div className="text-xs text-slate-500">{caja.moneda}</div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 capitalize">{caja.tipo}</td>
                  <td className="px-4 py-2.5 text-sm text-right font-semibold text-slate-900">
                    ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-emerald-700">
                    +${ingresosHoy.toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-rose-700">
                    -${egresosHoy.toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-slate-600">{movimientosHoy}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => onArqueo(caja)} className="px-2 py-1 text-[11px]">Arqueo</Button>
                      <Button size="sm" variant="ghost" onClick={() => onTransferir(caja)} className="px-2 py-1 text-[11px]">Transferir</Button>
                      <Button size="sm" variant="ghost" onClick={() => onHistory(caja)} className="px-2 py-1 text-[11px]">Historial</Button>
                      <Button size="sm" variant="ghost" onClick={() => onRetiro(caja)} className="px-2 py-1 text-[11px] text-rose-600">Retiro</Button>
                    </div>
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

function CajasLoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((k) => (
          <div key={k} className="h-32 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((k) => (
          <div key={k} className="h-44 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function CajasEmptyState() {
  return (
    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p className="font-medium">No hay cajas configuradas</p>
      <p className="text-sm mt-1">Las cajas se crean automáticamente al configurar medios de cobro</p>
    </div>
  );
}

function CajasAlertasOperativas({ cajas }: { cajas: CajaConMediosCobro[] }) {
  const cajasNegativas = cajas.filter((c) => Number(c.saldo_actual) < 0);
  const cajasSinActividad = cajas.filter((c) => (c.movimientos_hoy || 0) === 0);

  if (!cajas.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 md:p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-800">Alertas operativas</h4>
        <span className="text-xs text-slate-500">Control diario</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className={`rounded-lg border px-3 py-2 ${cajasNegativas.length ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-[11px] uppercase tracking-wide font-semibold ${cajasNegativas.length ? 'text-rose-700' : 'text-emerald-700'}`}>
            Cajas con saldo negativo
          </p>
          <p className={`text-lg font-bold ${cajasNegativas.length ? 'text-rose-800' : 'text-emerald-800'}`}>
            {cajasNegativas.length}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-700">Sin movimientos hoy</p>
          <p className="text-lg font-bold text-amber-800">{cajasSinActividad.length}</p>
        </div>
      </div>
    </div>
  );
}

export function ResumenCajas({ resumenPorTipo, totalSaldo, loading = false, onCajaClick, onRefresh }: ResumenCajasProps) {
  const totalCajas = resumenPorTipo.reduce((sum, r) => sum + r.cantidad_cajas, 0);
  const [search, setSearch] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<'todos' | 'efectivo' | 'banco' | 'pasarela'>('todos');
  const [sortBy, setSortBy] = useState<CajasSort>('saldo_desc');
  const [viewMode, setViewMode] = useState<CajasViewMode>('cards');
  const [selectedArqueoCaja, setSelectedArqueoCaja] = useState<CajaConMediosCobro | null>(null);
  const [selectedTransferCaja, setSelectedTransferCaja] = useState<CajaConMediosCobro | null>(null);
  const [selectedHistoryCaja, setSelectedHistoryCaja] = useState<CajaConMediosCobro | null>(null);
  const [selectedRetiroCaja, setSelectedRetiroCaja] = useState<CajaConMediosCobro | null>(null);
  const { createEgreso } = useEgresos();

  const flatCajas = useMemo(
    () => resumenPorTipo.flatMap((g) => g.cajas),
    [resumenPorTipo]
  );

  const filteredSortedCajas = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = [...flatCajas];

    if (selectedTipo !== 'todos') {
      rows = rows.filter((c) => c.tipo === selectedTipo);
    }

    if (term) {
      rows = rows.filter((c) => {
        const haystack = [c.nombre, c.tipo, c.moneda].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      });
    }

    rows.sort((a, b) => {
      if (sortBy === 'saldo_desc') return Number(b.saldo_actual) - Number(a.saldo_actual);
      if (sortBy === 'saldo_asc') return Number(a.saldo_actual) - Number(b.saldo_actual);
      if (sortBy === 'nombre_asc') return a.nombre.localeCompare(b.nombre, 'es');
      if (sortBy === 'nombre_desc') return b.nombre.localeCompare(a.nombre, 'es');
      return (b.movimientos_hoy || 0) - (a.movimientos_hoy || 0);
    });

    return rows;
  }, [flatCajas, search, selectedTipo, sortBy]);

  const filteredResumen = useMemo(() => {
    const grouped: Record<'efectivo' | 'banco' | 'pasarela', CajaConMediosCobro[]> = {
      efectivo: [],
      banco: [],
      pasarela: [],
    };
    filteredSortedCajas.forEach((c) => grouped[c.tipo].push(c));
    return (['efectivo', 'banco', 'pasarela'] as const)
      .filter((tipo) => grouped[tipo].length > 0)
      .map((tipo) => ({
        tipo,
        cajas: grouped[tipo],
        cantidad_cajas: grouped[tipo].length,
        total_saldo: grouped[tipo].reduce((acc, c) => acc + Number(c.saldo_actual), 0),
      }));
  }, [filteredSortedCajas]);

  if (loading) {
    return <CajasLoadingState />;
  }

  const handleArqueoTransferRequest = (caja: CajaConMediosCobro) => {
    setSelectedArqueoCaja(null);
    setSelectedTransferCaja(caja);
  };

  return (
    <div className="space-y-6">
      <CajasTotalHeader totalSaldo={totalSaldo} totalCajas={totalCajas} />
      <CajasTipoResumen resumenPorTipo={filteredResumen} />

      <CajasToolbar
        search={search}
        onSearchChange={setSearch}
        selectedTipo={selectedTipo}
        onTipoChange={setSelectedTipo}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeCount={filteredSortedCajas.length}
        totalCount={flatCajas.length}
        onClearFilters={() => {
          setSearch('');
          setSelectedTipo('todos');
          setSortBy('saldo_desc');
        }}
      />

      <CajasAlertasOperativas cajas={filteredSortedCajas} />

      {viewMode === 'cards' && filteredResumen.map((grupo) => {
        const Icon = TIPO_ICONS[grupo.tipo];
        const colors = TIPO_COLORS[grupo.tipo];

        return (
          <section key={grupo.tipo} className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${colors.icon}`} />
              <h4 className="font-medium text-gray-700">{TIPO_LABELS[grupo.tipo]}</h4>
              <span className="text-xs text-gray-500">
                ({grupo.cantidad_cajas} {grupo.cantidad_cajas === 1 ? 'caja' : 'cajas'})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grupo.cajas.map((caja) => (
                <div key={caja.id} className="cursor-pointer" onClick={() => onCajaClick?.(caja.id)}>
                  <CajaSummaryCard
                    caja={caja}
                    onClickArqueo={(c) => setSelectedArqueoCaja(c)}
                    onTransferir={(c) => setSelectedTransferCaja(c)}
                    onHistory={(c) => setSelectedHistoryCaja(c)}
                    onRetiro={(c) => setSelectedRetiroCaja(c)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {viewMode === 'table' && filteredSortedCajas.length > 0 && (
        <CajasTableView
          cajas={filteredSortedCajas}
          onArqueo={setSelectedArqueoCaja}
          onTransferir={setSelectedTransferCaja}
          onHistory={setSelectedHistoryCaja}
          onRetiro={setSelectedRetiroCaja}
          onCajaClick={onCajaClick}
        />
      )}

      {!filteredSortedCajas.length && <CajasEmptyState />}

      <ArqueoCajaModal
        isOpen={!!selectedArqueoCaja}
        onClose={() => setSelectedArqueoCaja(null)}
        caja={selectedArqueoCaja}
        onSuccess={() => onRefresh?.()}
        onTransferRequest={() => selectedArqueoCaja && handleArqueoTransferRequest(selectedArqueoCaja)}
      />

      <TransferirCajaModal
        isOpen={!!selectedTransferCaja}
        onClose={() => setSelectedTransferCaja(null)}
        cajaOrigen={selectedTransferCaja}
        onSuccess={() => onRefresh?.()}
      />

      {selectedHistoryCaja && (
        <CajaMovimientosModal
          isOpen={!!selectedHistoryCaja}
          onClose={() => setSelectedHistoryCaja(null)}
          caja={selectedHistoryCaja}
        />
      )}

      <RegistrarEgresoModal
        isOpen={!!selectedRetiroCaja}
        onClose={() => setSelectedRetiroCaja(null)}
        onSubmit={async (data) => {
          await createEgreso(data);
          onRefresh?.();
        }}
        onSuccess={() => {
          setSelectedRetiroCaja(null);
          onRefresh?.();
        }}
        lockedCajaId={selectedRetiroCaja?.id}
        lockedMedioPago="efectivo"
      />
    </div>
  );
}
