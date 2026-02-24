import { Navigate, Route, Routes } from 'react-router-dom';
import { usePageHeader } from '../../hooks/usePageHeader';
import DocumentationDashboardGuide from './documentacion/DocumentationDashboardGuide';
import DocumentationOrdenesTrabajoGuide from './documentacion/DocumentationOrdenesTrabajoGuide';
import DocumentationProduccionGuide from './documentacion/DocumentationProduccionGuide';
import DocumentationServiciosAcabadosGuide from './documentacion/DocumentationServiciosAcabadosGuide';

export default function Documentation() {
  usePageHeader('Ayuda y guías de uso');

  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DocumentationDashboardGuide />} />
      <Route path="ordenes-trabajo" element={<DocumentationOrdenesTrabajoGuide />} />
      <Route path="produccion" element={<DocumentationProduccionGuide />} />
      <Route path="servicios-acabados" element={<DocumentationServiciosAcabadosGuide />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
