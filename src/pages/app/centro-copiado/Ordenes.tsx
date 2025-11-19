import { FileText } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

export function Ordenes() {
  usePageHeader('Gestiona las órdenes de copiado independientes o vinculadas a órdenes de trabajo');

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-12">
          <EmptyState
            icon={FileText}
            title="Órdenes de Copiado"
            description="Aquí podrás gestionar las órdenes de copiado. Las órdenes pueden crearse de forma independiente o vincularse a una orden de trabajo principal. Funcionalidad en desarrollo."
          />
        </div>
      </Card>
    </div>
  );
}
