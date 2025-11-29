import { Routes, Route, Navigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import ReporteGeneral from './reportes/ReporteGeneral';

export default function ReportesView() {
  const tabs = [
    {
      id: 'general',
      label: 'General',
      icon: TrendingUp,
      path: '/app/finanzas/reportes/general',
    },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} />

      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/reportes/general" replace />} />
        <Route path="/general" element={<ReporteGeneral />} />
      </Routes>
    </div>
  );
}
