import { Radio } from 'lucide-react';
import { Select } from '../../ui/Select';
import type { PerformanceOption, PerformancePeriod } from '../../../hooks/useProductionPerformance';

interface PerformanceFiltersBarProps {
  period: PerformancePeriod;
  estacionId: string | null;
  userId: string | null;
  estaciones: PerformanceOption[];
  usuarios: PerformanceOption[];
  loading?: boolean;
  isRealtimeConnected?: boolean;
  onPeriodChange: (period: PerformancePeriod) => void;
  onEstacionChange: (estacionId: string | null) => void;
  onUserChange: (userId: string | null) => void;
}

export function PerformanceFiltersBar({
  period,
  estacionId,
  userId,
  estaciones,
  usuarios,
  loading = false,
  isRealtimeConnected = false,
  onPeriodChange,
  onEstacionChange,
  onUserChange,
}: PerformanceFiltersBarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <Select
          label="Período"
          value={period}
          onChange={(value) => onPeriodChange(value as PerformancePeriod)}
        >
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </Select>

        <Select
          label="Estación"
          value={estacionId || ''}
          onChange={(value) => onEstacionChange(value || null)}
        >
          <option value="">Todas las estaciones</option>
          {estaciones.map((estacion) => (
            <option key={estacion.id} value={estacion.id}>
              {estacion.label}
            </option>
          ))}
        </Select>

        <Select
          label="Usuario"
          value={userId || ''}
          onChange={(value) => onUserChange(value || null)}
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map((user) => (
            <option key={user.id} value={user.id}>
              {user.label}
            </option>
          ))}
        </Select>

        <div className="flex flex-col justify-end gap-2 pb-0.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Radio className={`h-3 w-3 ${isRealtimeConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
            {isRealtimeConnected ? 'Tiempo real activo' : 'Reconectando realtime'}
          </div>
        </div>
      </div>
    </div>
  );
}
