import { TrendingUp } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePageHeader } from '../../hooks/usePageHeader';

export function Finance() {
  usePageHeader('Finanzas y contabilidad');

  return (
    <div>
      <Card padding="none">
        <EmptyState
          icon={TrendingUp}
          title="Módulo en desarrollo"
          description="Aquí podrás gestionar finanzas, facturación y reportes contables"
        />
      </Card>
    </div>
  );
}
