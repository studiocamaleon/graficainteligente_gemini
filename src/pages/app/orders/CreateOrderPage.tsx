import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePageHeader } from '../../../hooks/usePageHeader';

export function CreateOrderPage() {
  const navigate = useNavigate();

  usePageHeader('Crear nueva orden de trabajo');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => navigate('/app/orders/ordenes')}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a órdenes
        </Button>
      </div>

      <Card className="p-12">
        <EmptyState
          icon={Package}
          title="Módulo en Construcción"
          description="El módulo de creación de órdenes estará disponible próximamente. Primero necesitamos configurar el catálogo de productos."
        />
      </Card>
    </div>
  );
}
