import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/card';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useOrdenesTrabajo } from '../../../hooks/useOrdenesTrabajo';
import { KanbanBoard } from '../../../components/orders/KanbanBoard';
import { OrdenesTable } from '../../../components/orders/OrdenesTable';
import { usePermissions } from '../../../hooks/usePermissions';
import { useAuth } from '../../../hooks/useAuth';

export function OrdersListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { hasPermission } = usePermissions();
  const { profile } = useAuth();

  const canCreate = hasPermission('orders', 'create');
  const canViewFinancials = profile?.role !== 'operador_taller';
  const metricsGridClass = canViewFinancials
    ? 'grid grid-cols-1 md:grid-cols-6 gap-4'
    : 'grid grid-cols-1 md:grid-cols-5 gap-4';

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const { ordenes, metrics, loading, totalCount } = useOrdenesTrabajo({
    searchTerm,
    page,
    itemsPerPage,
  });

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const headerAction = useMemo(
    () => canCreate ? (
      <Button variant="primary" onClick={() => navigate('/app/orders/crear-ot')}>
        <Plus className="w-5 h-5 mr-2" />
        Nueva Orden
      </Button>
    ) : null,
    [navigate, canCreate]
  );

  usePageHeader('Gestiona tus órdenes y proyectos', headerAction);

  return (
    <div className="space-y-6">
      <div className={metricsGridClass}>
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">Total Órdenes</div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalOrdenes}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs text-gray-600 mb-1">Órdenes del Mes</div>
            <div className="text-2xl font-bold text-indigo-600">{metrics.totalOrdenesMes}</div>
          </div>
        </Card>

        {canViewFinancials && (
          <Card>
            <div className="p-4">
              <div className="text-xs text-gray-600 mb-1">Total Facturado</div>
              <div className="text-2xl font-bold text-green-600">
                ${metrics.totalFacturado.toLocaleString('es-AR')}
              </div>
            </div>
          </Card>
        )}

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por orden, cliente, razón social, teléfono o CUIT/DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'list'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                  title="Vista Lista"
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'kanban'
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                  title="Vista Tablero"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{totalCount}</span> órdenes
              </div>
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
              {canCreate && (
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/orders/crear-ot')}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Orden
                </Button>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'list' ? (
                <OrdenesTable ordenes={ordenes} />
              ) : (
                <div className="grid grid-cols-1 w-full">
                  <KanbanBoard ordenes={ordenes} />
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

        </div>
      </Card>
    </div>
  );
}
