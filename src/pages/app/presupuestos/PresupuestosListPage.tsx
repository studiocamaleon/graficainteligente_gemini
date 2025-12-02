import { useState } from 'react';
import { Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePresupuestos } from '../../../hooks/usePresupuestos';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { PresupuestoCard } from '../../../components/presupuestos/PresupuestoCard';
import { PresupuestoFilters } from '../../../components/presupuestos/PresupuestoFilters';
import { PresupuestosStats } from '../../../components/presupuestos/PresupuestosStats';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Pagination } from '../../../components/ui/Pagination';
import type { PresupuestosFilters as FiltersType } from '../../../types/presupuestos';

export default function PresupuestosListPage() {
  const navigate = useNavigate();
  const { showConfirm } = useConfirmDialog();

  const [filters, setFilters] = useState<FiltersType>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    order_by: 'fecha_creacion' as const,
    order_direction: 'desc' as const,
  });

  const {
    presupuestos,
    loading,
    error,
    total,
    deletePresupuesto,
    duplicarPresupuesto,
    enviarPresupuesto,
  } = usePresupuestos(filters, pagination);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handlers
  const handleCreate = () => {
    navigate('/app/presupuestos/nuevo');
  };

  const handleView = (id: string) => {
    navigate(`/app/presupuestos/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/app/presupuestos/${id}/editar`);
  };

  const handleDuplicate = async (id: string) => {
    const presupuesto = presupuestos.find((p) => p.id === id);
    if (!presupuesto) return;

    const confirmed = await showConfirm({
      title: 'Duplicar presupuesto',
      message: `¿Deseas crear una copia de "${presupuesto.numero_presupuesto}"? Se copiará con sus items.`,
      confirmText: 'Duplicar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const result = await duplicarPresupuesto(id);
      if (result) {
        showSuccess('Presupuesto duplicado correctamente');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const presupuesto = presupuestos.find((p) => p.id === id);
    if (!presupuesto) return;

    const confirmed = await showConfirm({
      title: 'Eliminar presupuesto',
      message: `¿Estás seguro de eliminar "${presupuesto.numero_presupuesto}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (confirmed) {
      const success = await deletePresupuesto(id);
      if (success) {
        showSuccess('Presupuesto eliminado correctamente');
      }
    }
  };

  const handleEnviar = async (id: string) => {
    const presupuesto = presupuestos.find((p) => p.id === id);
    if (!presupuesto) return;

    const confirmed = await showConfirm({
      title: 'Enviar presupuesto',
      message: `¿Deseas marcar "${presupuesto.numero_presupuesto}" como enviado? Esto generará el tracking público.`,
      confirmText: 'Enviar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const success = await enviarPresupuesto(id);
      if (success) {
        showSuccess('Presupuesto marcado como enviado');
      }
    }
  };

  const handleGenerarPDF = (id: string) => {
    // TODO: Implementar en Fase 7
    console.log('Generar PDF:', id);
    showSuccess('Función de PDF pendiente (Fase 7)');
  };

  const handleFiltersChange = (newFilters: FiltersType) => {
    setFilters(newFilters);
    setPagination({ ...pagination, page: 1 }); // Reset a página 1
  };

  const handleResetFilters = () => {
    setFilters({});
    setPagination({ ...pagination, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setPagination({ ...pagination, page });
  };

  const totalPages = Math.ceil(total / pagination.limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Gestiona tus presupuestos y cotizaciones"
        action={
          <Button onClick={handleCreate}>
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Presupuesto
          </Button>
        }
      />

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Dashboard */}
      {!loading && presupuestos.length > 0 && (
        <PresupuestosStats presupuestos={presupuestos} />
      )}

      {/* Filters */}
      <PresupuestoFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && presupuestos.length === 0 && Object.keys(filters).length === 0 && (
        <EmptyState
          title="No hay presupuestos"
          description="Crea tu primer presupuesto para empezar a cotizar productos"
          icon={AlertCircle}
          action={{
            label: 'Crear Presupuesto',
            onClick: handleCreate,
          }}
        />
      )}

      {/* Empty Search Results */}
      {!loading && presupuestos.length === 0 && Object.keys(filters).length > 0 && (
        <EmptyState
          title="No se encontraron resultados"
          description="Intenta ajustar los filtros de búsqueda"
          icon={AlertCircle}
          action={{
            label: 'Limpiar filtros',
            onClick: handleResetFilters,
          }}
        />
      )}

      {/* Presupuestos Grid */}
      {!loading && presupuestos.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {presupuestos.map((presupuesto) => (
              <PresupuestoCard
                key={presupuesto.id}
                presupuesto={presupuesto}
                onView={handleView}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onEnviar={handleEnviar}
                onGenerarPDF={handleGenerarPDF}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}

          {/* Results info */}
          <div className="text-sm text-gray-500 text-center">
            Mostrando {presupuestos.length} de {total} presupuestos
          </div>
        </>
      )}
    </div>
  );
}
