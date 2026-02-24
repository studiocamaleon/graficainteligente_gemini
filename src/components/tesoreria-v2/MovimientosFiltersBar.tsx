import { Filter, Plus } from 'lucide-react';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Button } from '../ui/Button';

export type MovimientoTipoFiltro = 'all' | 'ingreso' | 'egreso';

export interface FiltroOption {
  value: string;
  label: string;
}

interface MovimientosFiltersBarProps {
  fechaDesde: string;
  fechaHasta: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  onPresetHoy: () => void;
  onPreset7Dias: () => void;
  onPreset10Dias: () => void;
  onPreset30Dias: () => void;
  filtroCajaId: string;
  onFiltroCajaIdChange: (value: string) => void;
  cajaOptions: FiltroOption[];
  filtroMedioKey: string;
  onFiltroMedioKeyChange: (value: string) => void;
  medioOptions: FiltroOption[];
  filtroTipo: MovimientoTipoFiltro;
  onFiltroTipoChange: (value: MovimientoTipoFiltro) => void;
  onCrearIngreso: () => void;
  onCrearEgreso: () => void;
}

export function MovimientosFiltersBar({
  fechaDesde,
  fechaHasta,
  onDateRangeChange,
  onPresetHoy,
  onPreset7Dias,
  onPreset10Dias,
  onPreset30Dias,
  filtroCajaId,
  onFiltroCajaIdChange,
  cajaOptions,
  filtroMedioKey,
  onFiltroMedioKeyChange,
  medioOptions,
  filtroTipo,
  onFiltroTipoChange,
  onCrearIngreso,
  onCrearEgreso,
}: MovimientosFiltersBarProps) {
  return (
    <div className="relative z-30 space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-2">
          <button type="button" onClick={onPresetHoy} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
            Hoy
          </button>
          <button type="button" onClick={onPreset7Dias} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
            Últimos 7 días
          </button>
          <button type="button" onClick={onPreset10Dias} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
            Últimos 10 días
          </button>
          <button type="button" onClick={onPreset30Dias} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
            Últimos 30 días
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onCrearIngreso}>
            <Plus className="h-4 w-4" /> Ingreso
          </Button>
          <Button size="sm" onClick={onCrearEgreso}>
            <Plus className="h-4 w-4" /> Egreso
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Período</label>
          <DateRangePicker
            startDate={fechaDesde}
            endDate={fechaHasta}
            onChange={onDateRangeChange}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Caja</label>
          <select
            value={filtroCajaId}
            onChange={(e) => onFiltroCajaIdChange(e.target.value)}
            className="h-[46px] w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
          >
            {cajaOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Medio</label>
          <select
            value={filtroMedioKey}
            onChange={(e) => onFiltroMedioKeyChange(e.target.value)}
            className="h-[46px] w-full rounded-lg border-2 border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
          >
            {medioOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-2">
          <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Filter className="h-3.5 w-3.5" /> Tipo de movimiento
          </label>
          <div className="inline-flex h-[46px] w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              { value: 'all' as const, label: 'Todos' },
              { value: 'ingreso' as const, label: 'Ingresos' },
              { value: 'egreso' as const, label: 'Egresos' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFiltroTipoChange(option.value)}
                className={`flex-1 rounded-md px-3 text-xs font-semibold transition ${
                  filtroTipo === option.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
