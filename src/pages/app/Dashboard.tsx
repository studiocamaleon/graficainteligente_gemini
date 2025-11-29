import { Package, Clock, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useDashboardData } from '../../hooks/useDashboardData';
import { DashboardStatCard } from '../../components/dashboard/DashboardStatCard';
import { TasaCumplimientoCard } from '../../components/dashboard/TasaCumplimientoCard';
import { ProximasEntregasTable } from '../../components/dashboard/ProximasEntregasTable';
import { ActividadRecienteList } from '../../components/dashboard/ActividadRecienteList';
import { Button } from '../../components/ui/Button';

export function Dashboard() {
  usePageHeader('Centro de Control');
  const { loading, stats, tasaCumplimiento, proximasEntregas, actividadReciente, refresh } = useDashboardData();

  const getTasaColor = () => {
    if (!tasaCumplimiento) return 'text-gray-600';
    const tasa = Number(tasaCumplimiento.tasa_cumplimiento);
    if (tasa >= 95) return 'text-green-600';
    if (tasa >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTasaBgColor = () => {
    if (!tasaCumplimiento) return 'bg-gray-100';
    const tasa = Number(tasaCumplimiento.tasa_cumplimiento);
    if (tasa >= 95) return 'bg-green-100';
    if (tasa >= 85) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <Button
          onClick={refresh}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStatCard
          label="Órdenes Pendientes"
          value={stats.ordenesPendientes}
          icon={Package}
          color="text-blue-600"
          bgColor="bg-blue-100"
          loading={loading}
        />
        <DashboardStatCard
          label="Órdenes en Proceso"
          value={stats.ordenesEnProceso}
          icon={Clock}
          color="text-orange-600"
          bgColor="bg-orange-100"
          loading={loading}
        />
        <DashboardStatCard
          label="Tasa de Cumplimiento"
          value={tasaCumplimiento ? `${Number(tasaCumplimiento.tasa_cumplimiento).toFixed(1)}%` : '0%'}
          icon={TrendingUp}
          color={getTasaColor()}
          bgColor={getTasaBgColor()}
          subtitle="Meta: 95%"
          loading={loading}
        />
        <DashboardStatCard
          label="Entregas Hoy"
          value={stats.entregasHoy}
          icon={AlertCircle}
          color="text-red-600"
          bgColor="bg-red-100"
          loading={loading}
        />
      </div>

      <TasaCumplimientoCard data={tasaCumplimiento} loading={loading} />

      <ProximasEntregasTable entregas={proximasEntregas} loading={loading} />

      <div className="grid lg:grid-cols-2 gap-6">
        <ActividadRecienteList actividades={actividadReciente} loading={loading} />

        <div className="hidden lg:block">
        </div>
      </div>
    </div>
  );
}
