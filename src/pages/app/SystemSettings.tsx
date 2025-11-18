import { Wrench } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePageHeader } from '../../hooks/usePageHeader';

export function SystemSettings() {
  usePageHeader('Ajustes generales de la aplicación');

  return (
    <div>
      <Card padding="none">
        <EmptyState
          icon={Wrench}
          title="Configuración del sistema"
          description="Aquí podrás personalizar la configuración general de tu cuenta"
        />
      </Card>
    </div>
  );
}
