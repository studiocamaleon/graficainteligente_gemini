import { Package } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';

export function PreciosPortabannersTab() {
  return (
    <Card>
      <div className="p-12">
        <EmptyState
          icon={Package}
          title="Gestión de Precios de Portabanners"
          description="La configuración de precios para productos portabanners estará disponible próximamente. Por ahora, puedes crear y gestionar tus productos en la pestaña Productos."
        />
      </div>
    </Card>
  );
}
