import { Users, Activity, Clock, TrendingUp, Target, Award } from 'lucide-react';
import { KpiCard } from '../productivity/KpiCard';
import type { ResumenActividadEquipo } from '../../types/database';

interface ResumenEquipoKPIsProps {
  resumen: ResumenActividadEquipo;
  loading?: boolean;
}

export function ResumenEquipoKPIs({ resumen, loading }: ResumenEquipoKPIsProps) {
  const formatHoras = (horas: number) => {
    return `${horas.toFixed(1)}h`;
  };

  const formatMinutos = (minutos: number) => {
    return `${Math.round(minutos)} min`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        title="Pasos Ejecutados"
        value={resumen.total_pasos_ejecutados.toString()}
        icon={Activity}
        color="blue"
        loading={loading}
      />

      <KpiCard
        title="Operadores Activos"
        value={resumen.total_operadores_activos.toString()}
        icon={Users}
        color="green"
        loading={loading}
      />

      <KpiCard
        title="Promedio por Operador"
        value={resumen.promedio_pasos_por_operador.toFixed(1)}
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
        value={`${resumen.tasa_completitud_equipo.toFixed(0)}%`}
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
