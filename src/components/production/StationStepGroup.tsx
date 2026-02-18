
import type { DragEvent } from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, CheckSquare, MinusSquare, Square, AlertTriangle, CalendarDays, CalendarClock } from 'lucide-react';
import type { StationStep } from '../../hooks/useProductionStations';
import { StationStepCard } from './StationStepCard';
import { Badge } from '../ui/Badge';

interface StationStepGroupProps {
  steps: StationStep[];
  onViewDetails: (step: StationStep) => void;
  selectedRutaIds: string[];
  deliveryStatusByRuta?: Record<string, 'overdue' | 'today' | 'tomorrow' | null>;
  mesaBadgeByRuta?: Record<string, { text: string; variant: 'mine' | 'other' } | null>;
  onToggleStepSelect: (step: StationStep) => void;
  onToggleGroupSelect: (steps: StationStep[]) => void;
  onStepDragStart?: (step: StationStep, event: DragEvent<HTMLDivElement>) => void;
  onStepDragEnd?: () => void;
}

export function StationStepGroup({
  steps,
  onViewDetails,
  selectedRutaIds,
  deliveryStatusByRuta = {},
  mesaBadgeByRuta = {},
  onToggleStepSelect,
  onToggleGroupSelect,
  onStepDragStart,
  onStepDragEnd,
}: StationStepGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (steps.length === 0) return null;

  // Usamos el primer paso como representante del grupo para los datos comunes
  const representative = steps[0];
  const selectedCount = steps.filter((step) => selectedRutaIds.includes(step.ruta_id)).length;
  const overdueCount = steps.filter((step) => deliveryStatusByRuta[step.ruta_id] === 'overdue').length;
  const todayCount = steps.filter((step) => deliveryStatusByRuta[step.ruta_id] === 'today').length;
  const tomorrowCount = steps.filter((step) => deliveryStatusByRuta[step.ruta_id] === 'tomorrow').length;
  const allSelected = selectedCount === steps.length;
  const partiallySelected = selectedCount > 0 && selectedCount < steps.length;

  return (
    <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden transition-all duration-200">
      <div
        className="p-3 bg-slate-50 cursor-pointer flex items-center justify-between hover:bg-slate-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleGroupSelect(steps);
            }}
            className="text-slate-500 hover:text-slate-700"
            title="Seleccionar grupo"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : partiallySelected ? (
              <MinusSquare className="w-4 h-4 text-slate-700" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <div className="bg-white p-2 rounded-full border border-slate-200 shadow-sm">
            <Layers className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">
              {representative.paso_nombre}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
              <span className="font-medium">Orden #{representative.numero_orden}</span>
              <span>•</span>
              <span className="truncate max-w-[150px]">{representative.cliente_nombre}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="blue" size="sm" className="shadow-none">
            {selectedCount > 0 ? `${selectedCount}/${steps.length}` : `${steps.length}`} items
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="error" size="sm" className="flex items-center gap-1 shadow-none" title="Incluye pasos vencidos">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overdueCount}
            </Badge>
          )}
          {todayCount > 0 && (
            <Badge variant="warning" size="sm" className="flex items-center gap-1 shadow-none" title="Incluye pasos para entregar hoy">
              <CalendarDays className="w-3.5 h-3.5" />
              {todayCount}
            </Badge>
          )}
          {tomorrowCount > 0 && (
            <Badge variant="info" size="sm" className="flex items-center gap-1 shadow-none" title="Incluye pasos para entregar mañana">
              <CalendarClock className="w-3.5 h-3.5" />
              {tomorrowCount}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3 bg-slate-50 border-t border-slate-200 animate-in slide-in-from-top-2">
          {steps.map((step) => (
            <StationStepCard
              key={step.ruta_id}
              {...step}
              selected={selectedRutaIds.includes(step.ruta_id)}
              deliveryStatus={deliveryStatusByRuta[step.ruta_id] ?? null}
              mesaBadgeText={mesaBadgeByRuta[step.ruta_id]?.text || null}
              mesaBadgeVariant={mesaBadgeByRuta[step.ruta_id]?.variant || 'other'}
              draggable
              onDragStart={(event) => onStepDragStart?.(step, event)}
              onDragEnd={onStepDragEnd}
              onToggleSelect={() => onToggleStepSelect(step)}
              onViewDetails={() => onViewDetails(step)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
