import { Users, Activity, Clock, TrendingUp, Target, Award } from 'lucide-react';
import { KpiCard } from '../productivity/KpiCard';
import type { ResumenActividadEquipo } from '../../types/database';

interface ResumenEquipoKPIsProps {
  resumen: ResumenActividadEquipo;
  loading?: boolean;
}

export function ResumenEquipoKPIs({ resumen, loading }: ResumenEquipoKPIsProps) {
  const formatHoras = (horas: number | null) => {
    if (horas === null || horas === undefined) return '0.0h';
    return `${horas.toFixed(1)}h`;
  };

  const formatMinutos = (minutos: number | null) => {
    if (minutos === null || minutos === undefined) return '0 min';
    return `${Math.round(minutos)} min`;
  };

  const safeToFixed = (value: number | null, decimals: number = 1): string => {
    if (value === null || value === undefined) return '0';
    return value.toFixed(decimals);
  };

  const safeToString = (value: number | null): string => {
    if (value === null || value === undefined) return '0';
    return value.toString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        title="Pasos Ejecutados"
        value={safeToString(resumen.total_pasos_ejecutados)}
        icon={Activity}
        color="blue"
        loading={loading}
      />

      <KpiCard
        title="Operadores Activos"
        value={safeToString(resumen.total_operadores_activos)}
        icon={Users}
        color="green"
        loading={loading}
      />

      <KpiCard
        title="Promedio por Operador"
        value={safeToFixed(resumen.promedio_pasos_por_operador, 1)}
        icon={Target}
        color="purple"
        loading={loading}
      />

      <KpiCard
        title="Tiempo Promedio"
        value={formatMinutos(resumen.tiempo_promedio_por_paso)}
        icon={Clock}
        color="orange"
        loading={loading}
      />

      <KpiCard
        title="Tasa de Completitud"
        value={`${safeToFixed(resumen.tasa_completitud_equipo, 0)}%`}
        icon={TrendingUp}
        color="green"
        loading={loading}
      />

      <KpiCard
        title="Horas Trabajadas"
        value={formatHoras(resumen.total_horas_trabajadas)}
        icon={Award}
        color="blue"
        loading={loading}
      />
    </div>
  );
}
