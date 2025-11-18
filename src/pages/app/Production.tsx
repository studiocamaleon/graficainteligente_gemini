import { Factory } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePageHeader } from '../../hooks/usePageHeader';

export function Production() {
  usePageHeader('Control de producción y seguimiento');

  return (
    <div>
      <Card padding="none">
        <EmptyState
          icon={Factory}
          title="Sin trabajos en producción"
          description="Aquí verás el estado de todos los trabajos en proceso de producción"
        />
      </Card>
    </div>
  );
}
