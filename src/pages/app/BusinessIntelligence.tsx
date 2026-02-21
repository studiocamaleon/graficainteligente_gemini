import { Navigate, Route, Routes } from 'react-router-dom';
import { usePageHeader } from '../../hooks/usePageHeader';
import { ProtectedModuleRoute } from '../../components/auth/ProtectedModuleRoute';
import BusinessIntelligenceV2 from './business-intelligence-v2/BusinessIntelligenceV2';

export default function BusinessIntelligence() {
  usePageHeader('Business Intelligence');

  return (
    <div className="space-y-6">
      <Routes>
        <Route path="/" element={<Navigate to="/app/business-intelligence/v2/executive" replace />} />
        <Route
          path="/v2/*"
          element={
            <ProtectedModuleRoute moduleId="finance-reportes">
              <BusinessIntelligenceV2 />
            </ProtectedModuleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/app/business-intelligence/v2/executive" replace />} />
      </Routes>
    </div>
  );
}
