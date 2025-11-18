import { Package } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { EmptyState } from '../../../../components/ui/EmptyState';

export function PreciosPlotterCorteTab() {
  return (
    <Card>
      <div className="p-12">
        <EmptyState
          icon={Package}
          title="Gestión de Precios"
          description="La funcionalidad de gestión de precios para productos de plotter de corte estará disponible próximamente. Podrás configurar precios por ancho y rangos de cantidad."
        />
      </div>
    </Card>
  );
}
