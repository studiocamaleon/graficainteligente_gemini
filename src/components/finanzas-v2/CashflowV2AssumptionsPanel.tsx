import { SlidersHorizontal } from 'lucide-react';
import { Card } from '../ui/card';
import { Tooltip } from '../ui/Tooltip';
import type { CashflowV2AssumptionsDelta, CashflowV2Basis } from '../../types/finanzas-cashflow-v2';

interface CashflowV2AssumptionsPanelProps {
  basis: CashflowV2Basis;
  onBasisChange: (basis: CashflowV2Basis) => void;
  assumptions: CashflowV2AssumptionsDelta;
  onAssumptionsChange: (patch: Partial<CashflowV2AssumptionsDelta>) => void;
  onAssumptionsCommit?: () => void;
}

function RangeField({
  label,
  help,
  value,
  min = 0,
  max = 50,
  step = 5,
  onChange,
  onCommit,
}: {
  label: string;
  help: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const formattedValue = `${value > 0 ? '+' : ''}${value}%`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
          <Tooltip content={help} icon />
        </div>
        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{formattedValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-cyan-200 via-blue-200 to-indigo-200"
      />
    </div>
  );
}

export function CashflowV2AssumptionsPanel({
  basis,
  onBasisChange,
  assumptions,
  onAssumptionsChange,
  onAssumptionsCommit,
}: CashflowV2AssumptionsPanelProps) {
  return (
    <Card className="relative z-20 overflow-visible border-slate-200 bg-white/80 shadow-xl backdrop-blur">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Supuestos de simulación</h3>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Base de cobro</p>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => onBasisChange('total')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                basis === 'total' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Totales
            </button>
            <button
              type="button"
              onClick={() => onBasisChange('cobrable')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                basis === 'cobrable' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cobrables
            </button>
          </div>
          <p className="text-xs text-slate-500">
            En Cobrables, solo el WIP vencido exige estado finalizada/entregada.
          </p>
        </div>

        <RangeField
          label="Cobro WIP vencido"
          help="Ajuste relativo sobre el escenario base para el cobro de WIP vencido. 0% mantiene la base."
          value={assumptions.delta_wip_overdue_collectable}
          onChange={(v) => onAssumptionsChange({ delta_wip_overdue_collectable: v })}
          min={-50}
          max={50}
          onCommit={onAssumptionsCommit}
        />

        <RangeField
          label="Cumplimiento WIP futuro"
          help="Ajuste relativo sobre el cumplimiento esperado de WIP futuro. 0% mantiene la base."
          value={assumptions.delta_wip_future_completion}
          onChange={(v) => onAssumptionsChange({ delta_wip_future_completion: v })}
          min={-50}
          max={50}
          onCommit={onAssumptionsCommit}
        />

        <RangeField
          label="Ajuste ingresos"
          help="Factor global para estresar o potenciar ingresos proyectados."
          value={assumptions.delta_ingresos}
          onChange={(v) => onAssumptionsChange({ delta_ingresos: v })}
          min={-50}
          max={50}
          onCommit={onAssumptionsCommit}
        />

        <RangeField
          label="Ajuste egresos"
          help="Factor global para estresar o moderar egresos proyectados."
          value={assumptions.delta_egresos}
          onChange={(v) => onAssumptionsChange({ delta_egresos: v })}
          min={-50}
          max={50}
          onCommit={onAssumptionsCommit}
        />

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-slate-700">Incluir vencidos</p>
            <p className="text-xs text-slate-500">Suma cobros/deudas vencidas al flujo diario.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onAssumptionsChange({ include_overdue: !assumptions.include_overdue });
              onAssumptionsCommit?.();
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              assumptions.include_overdue ? 'bg-cyan-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                assumptions.include_overdue ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}
