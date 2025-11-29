import { PausasAnalyticsDashboard } from '../../../components/pausas/PausasAnalyticsDashboard';

export function PausasView() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Analítica de Pausas
        </h2>
        <p className="text-sm text-gray-600">
          Visualiza métricas, tendencias y análisis detallado del sistema de pausas
          en producción.
        </p>
      </div>

      <PausasAnalyticsDashboard />
    </div>
  );
}
