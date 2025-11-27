import { Routes, Route, Navigate } from 'react-router-dom';
import TesoreriaView from './finanzas/TesoreriaView';
import CuentasCorrientesView from './finanzas/CuentasCorrientesView';
import ReportesView from './finanzas/ReportesView';
import { usePageHeader } from '../../hooks/usePageHeader';

export default function Finanzas() {
  usePageHeader('Gestión financiera y contable');

  return (
    <div className="space-y-6">
      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/tesoreria" replace />} />
        <Route path="/tesoreria" element={<TesoreriaView />} />
        <Route path="/cuentas-corrientes" element={<CuentasCorrientesView />} />
        <Route path="/reportes/*" element={<ReportesView />} />
      </Routes>
    </div>
  );
}
