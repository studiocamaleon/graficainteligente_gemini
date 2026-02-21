import { Routes, Route, Navigate } from 'react-router-dom';
import TesoreriaView from './finanzas/TesoreriaView';
import CuentasCorrientesView from './finanzas/CuentasCorrientesView';
import { FacturasView } from './finanzas/FacturasView';

import CuentasPorPagarPage from './tesoreria/CuentasPorPagarPage';
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
          path="/cuentas-por-pagar"
          element={
            <ProtectedModuleRoute moduleId="finance-cuentas-por-pagar">
              <CuentasPorPagarPage />
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
          path="/facturas"
          element={
            <ProtectedModuleRoute moduleId="finance-facturas">
              <FacturasView />
            </ProtectedModuleRoute>
          }
        />
        <Route path="/reportes/*" element={<Navigate to="/app/business-intelligence/v2/executive" replace />} />
      </Routes>
    </div>
  );
}
