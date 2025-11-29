import { Routes, Route, Navigate } from 'react-router-dom';
import TesoreriaView from './finanzas/TesoreriaView';
import CuentasCorrientesView from './finanzas/CuentasCorrientesView';
import ReportesView from './finanzas/ReportesView';
import { usePageHeader } from '../../hooks/usePageHeader';
import { ProtectedModuleRoute } from '../../components/auth/ProtectedModuleRoute';

export default function Finanzas() {
  usePageHeader('Gestión financiera y contable');

  return (
    <div className="space-y-6">
      <Routes>
        <Route path="/" element={<Navigate to="/app/finanzas/tesoreria" replace />} />
        <Route
          path="/tesoreria"
          element={
            <ProtectedModuleRoute moduleId="finance-tesoreria">
              <TesoreriaView />
            </ProtectedModuleRoute>
          }
        />
        <Route
          path="/cuentas-corrientes"
          element={
            <ProtectedModuleRoute moduleId="finance-cuentas-corrientes">
              <CuentasCorrientesView />
            </ProtectedModuleRoute>
          }
        />
        <Route
          path="/reportes/*"
          element={
            <ProtectedModuleRoute moduleId="finance-reportes">
              <ReportesView />
            </ProtectedModuleRoute>
          }
        />
      </Routes>
    </div>
  );
}
