import { useNavigate } from 'react-router-dom';
import { Package, Clock, TrendingUp, AlertCircle, RefreshCw, Truck, Calendar, FileText } from 'lucide-react';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useDashboardData } from '../../hooks/useDashboardData';
import { DashboardStatCard } from '../../components/dashboard/DashboardStatCard';
import { TasaCumplimientoCard } from '../../components/dashboard/TasaCumplimientoCard';
import { ProximasEntregasTable } from '../../components/dashboard/ProximasEntregasTable';
import { ActividadRecienteList } from '../../components/dashboard/ActividadRecienteList';
import { OrdenesPorDiaChart } from '../../components/dashboard/OrdenesPorDiaChart';
import { Button } from '../../components/ui/Button';

import { WelcomeIntro } from '../../components/dashboard/WelcomeIntro';

export function Dashboard() {
  const navigate = useNavigate();
  usePageHeader('Centro de Control');
  const { loading, error, stats, tasaCumplimiento, proximasEntregas, actividadReciente, ordenesPorDia, refresh } = useDashboardData();

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
      <WelcomeIntro loading={loading} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate('/app/pending-deliveries')}
            variant="success"
            size="sm"
          >
            <Truck className="w-4 h-4 mr-2" />
            Gestionar Entregas
          </Button>
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
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Órdenes de Trabajo</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <DashboardStatCard
            label="Visitas Hoy"
            value={stats.visitasHoy}
            icon={Calendar}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
            onClick={() => navigate('/app/presupuestos/visitas')}
          />
          <DashboardStatCard
            label="Pendientes"
            value={stats.ordenesPendientes}
            icon={Package}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
          />
          <DashboardStatCard
            label="En Proceso"
            value={stats.ordenesEnProceso}
            icon={Clock}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
          />
          <DashboardStatCard
            label="Cumplimiento"
            value={tasaCumplimiento ? `${Number(tasaCumplimiento.tasa_cumplimiento).toFixed(1)}%` : '0%'}
            icon={TrendingUp}
            color={getTasaColor()}
            bgColor={getTasaBgColor()}
            loading={loading}
          />
          <DashboardStatCard
            label="Entregas Hoy"
            value={stats.entregasHoy}
            icon={AlertCircle}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Centro de Copiado</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardStatCard
            label="Pendientes"
            value={stats.copiadoPendientes}
            icon={FileText}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
          />
          <DashboardStatCard
            label="En Proceso"
            value={stats.copiadoEnProceso}
            icon={Clock}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
          />
          <DashboardStatCard
            label="Entregas Hoy"
            value={stats.copiadoEntregasHoy}
            icon={AlertCircle}
            color="text-slate-700"
            bgColor="bg-slate-100"
            loading={loading}
          />
        </div>
      </section>

      <div className="grid lg:grid-cols-7 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <OrdenesPorDiaChart data={ordenesPorDia} />
          <ProximasEntregasTable entregas={proximasEntregas} loading={loading} />
        </div>

        <div className="lg:col-span-3 space-y-6">
          <TasaCumplimientoCard data={tasaCumplimiento} loading={loading} />
          <ActividadRecienteList actividades={actividadReciente} loading={loading} />
        </div>
      </div>
    </div>
  );
}
