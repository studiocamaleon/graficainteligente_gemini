import { Percent } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';

export function RangosPrecio() {
  usePageHeader('Configura los rangos de cantidad de hojas para el sistema de precios escalonados');

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-12">
          <EmptyState
            icon={Percent}
            title="Rangos de Precio para Impresión"
            description="Aquí podrás configurar los rangos de cantidad de hojas (ej: 1-50, 51-100, 101-500, etc.) para aplicar precios escalonados. Funcionalidad en desarrollo."
          />
        </div>
      </Card>
    </div>
  );
}
