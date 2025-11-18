import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useOrdenesTrabajo } from '../../../hooks/useOrdenesTrabajo';
import { KanbanBoard } from '../../../components/orders/KanbanBoard';

export function OrdersListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { ordenes, metrics, loading } = useOrdenesTrabajo({
    searchTerm,
    page: 1,
    itemsPerPage: 1000,
  });

  const headerAction = useMemo(
    () => (
      <Button variant="primary" onClick={() => navigate('/app/orders/crear-ot')}>
        <Plus className="w-5 h-5 mr-2" />
        Nueva Orden
      </Button>
    ),
    [navigate]
  );

  usePageHeader('Gestiona tus órdenes y proyectos', headerAction);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">Total Órdenes (Mes)</div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalOrdenes}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">Total Facturado</div>
            <div className="text-2xl font-bold text-green-600">
              ${metrics.totalFacturado.toLocaleString('es-AR')}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">Pendientes</div>
            <div className="text-2xl font-bold text-yellow-600">{metrics.ordenesPendientes}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">En Producción</div>
            <div className="text-2xl font-bold text-blue-600">{metrics.ordenesEnProduccion}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">Entregadas</div>
            <div className="text-2xl font-bold text-teal-600">{metrics.ordenesEntregadas}</div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por número de orden..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{ordenes.length}</span> órdenes
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Cargando órdenes...</p>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No se encontraron órdenes</p>
              <Button
                variant="primary"
                onClick={() => navigate('/app/orders/crear-ot')}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Orden
              </Button>
            </div>
          ) : (
            <KanbanBoard ordenes={ordenes} />
          )}
        </div>
      </Card>
    </div>
  );
}
