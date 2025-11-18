import { Puzzle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePageHeader } from '../../hooks/usePageHeader';

export function Integrations() {
  usePageHeader('Conecta con otras plataformas');

  return (
    <div>
      <Card padding="none">
        <EmptyState
          icon={Puzzle}
          title="Integraciones disponibles"
          description="Conecta tu cuenta con otras herramientas para automatizar procesos"
        />
      </Card>
    </div>
  );
}
