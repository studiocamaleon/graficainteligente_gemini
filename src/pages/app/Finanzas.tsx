import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Wallet, Users, FileText, BarChart3 } from 'lucide-react';
import TesoreriaView from './finanzas/TesoreriaView';
import CuentasCorrientesView from './finanzas/CuentasCorrientesView';
import LiquidacionesView from './finanzas/LiquidacionesView';
import ReportesView from './finanzas/ReportesView';
import { usePageHeader } from '../../hooks/usePageHeader';
import { Tabs } from '../../components/ui/Tabs';

export default function Finanzas() {
  usePageHeader('Gestión financiera y contable');
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'tesoreria', label: 'Tesorería', icon: Wallet },
    { id: 'cuentas-corrientes', label: 'Cuentas Corrientes', icon: Users },
    { id: 'liquidaciones', label: 'Liquidaciones', icon: FileText },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  ];

  const currentTab = location.pathname.split('/')[3] || 'tesoreria';

  const handleTabChange = (tabId: string) => {
    navigate(`/app/finanzas/${tabId}`);
  };

  return (
    <div className="space-y-6">
      <Tabs
        tabs={tabs}
        activeTab={currentTab}
        onChange={handleTabChange}
      />

      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/tesoreria" replace />} />
        <Route path="/tesoreria" element={<TesoreriaView />} />
        <Route path="/cuentas-corrientes" element={<CuentasCorrientesView />} />
        <Route path="/liquidaciones" element={<LiquidacionesView />} />
        <Route path="/reportes/*" element={<ReportesView />} />
      </Routes>
    </div>
  );
}
