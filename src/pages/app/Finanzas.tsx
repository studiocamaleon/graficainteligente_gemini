import { Routes, Route, Navigate } from 'react-router-dom';
import { FileText, DollarSign } from 'lucide-react';
import { Tabs } from '../../components/ui/Tabs';
import CuentasCorrientesView from './finanzas/CuentasCorrientesView';
import LiquidacionesView from './finanzas/LiquidacionesView';
import { usePageHeader } from '../../hooks/usePageHeader';
import { useEffect } from 'react';

export default function Finanzas() {
  const { setPageInfo } = usePageHeader();

  useEffect(() => {
    setPageInfo({
      title: 'Finanzas',
      description: 'Gestión financiera y contable',
    });
  }, [setPageInfo]);

  const tabs = [
    {
      id: 'cuentas-corrientes',
      label: 'Cuentas Corrientes',
      icon: DollarSign,
      path: '/app/finanzas/cuentas-corrientes',
    },
    {
      id: 'liquidaciones',
      label: 'Liquidaciones',
      icon: FileText,
      path: '/app/finanzas/liquidaciones',
    },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} />

      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/cuentas-corrientes" replace />} />
        <Route path="/cuentas-corrientes" element={<CuentasCorrientesView />} />
        <Route path="/liquidaciones" element={<LiquidacionesView />} />
      </Routes>
    </div>
  );
}
