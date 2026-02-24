import { Navigate, Route, Routes } from 'react-router-dom';
import { usePageHeader } from '../../hooks/usePageHeader';
import DocumentationDashboardGuide from './documentacion/DocumentationDashboardGuide';
import DocumentationOrdenesTrabajoGuide from './documentacion/DocumentationOrdenesTrabajoGuide';
import DocumentationProduccionGuide from './documentacion/DocumentationProduccionGuide';
import DocumentationServiciosAcabadosGuide from './documentacion/DocumentationServiciosAcabadosGuide';
import DocumentationReglasInternasPage from './documentacion/DocumentationReglasInternasPage';
import DocumentationReglasInternasAdminPage from './documentacion/DocumentationReglasInternasAdminPage';

export default function Documentation() {
  usePageHeader('Ayuda y guías de uso');

  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DocumentationDashboardGuide />} />
      <Route path="ordenes-trabajo" element={<DocumentationOrdenesTrabajoGuide />} />
      <Route path="produccion" element={<DocumentationProduccionGuide />} />
      <Route path="servicios-acabados" element={<DocumentationServiciosAcabadosGuide />} />
      <Route path="reglas-internas" element={<DocumentationReglasInternasPage />} />
      <Route path="reglas-internas/admin" element={<DocumentationReglasInternasAdminPage />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
