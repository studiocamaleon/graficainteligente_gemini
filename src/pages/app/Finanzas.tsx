import { Routes, Route, Navigate } from 'react-router-dom';
import CuentasCorrientesView from './finanzas/CuentasCorrientesView';
import LiquidacionesView from './finanzas/LiquidacionesView';
import ReportesView from './finanzas/ReportesView';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function Finanzas() {
  usePageHeader('Gestión financiera y contable');

  return (
    <div className="space-y-6">
      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/cuentas-corrientes" replace />} />
        <Route path="/cuentas-corrientes" element={<CuentasCorrientesView />} />
        <Route path="/liquidaciones" element={<LiquidacionesView />} />
        <Route path="/reportes/*" element={<ReportesView />} />
      </Routes>
    </div>
  );
}
