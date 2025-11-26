import { Routes, Route, Navigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import ReporteVentas from './reportes/ReporteVentas';

export default function ReportesView() {
  const tabs = [
    {
      id: 'ventas',
      label: 'Ventas',
      icon: TrendingUp,
      path: '/app/finanzas/reportes/ventas',
    },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} />

      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/reportes/ventas" replace />} />
        <Route path="/ventas" element={<ReporteVentas />} />
      </Routes>
    </div>
  );
}
