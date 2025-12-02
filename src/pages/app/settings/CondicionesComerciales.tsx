import { useState } from 'react';
import { Plus, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { useCondicionesComerciales } from '../../../hooks/useCondicionesComerciales';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { CondicionComercialCard } from '../../../components/presupuestos/CondicionComercialCard';
import { CondicionComercialForm } from '../../../components/presupuestos/CondicionComercialForm';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import type {
  CondicionComercial,
  CreateCondicionComercialData,
  UpdateCondicionComercialData,
} from '../../../types/presupuestos';

export default function CondicionesComerciales() {
  const {
    condiciones,
    loading,
    error,
    createCondicion,
    updateCondicion,
    deleteCondicion,
    duplicarCondicion,
    toggleActivo,
    marcarComoDefault,
  } = useCondicionesComerciales();

  const { showConfirm } = useConfirmDialog();

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCondicion, setEditingCondicion] = useState<CondicionComercial | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtrar condiciones por búsqueda
  const filteredCondiciones = condiciones.filter((condicion) =>
    condicion.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers
  const handleCreate = () => {
    setEditingCondicion(null);
    setShowForm(true);
  };

  const handleEdit = (condicion: CondicionComercial) => {
    setEditingCondicion(condicion);
    setShowForm(true);
  };

  const handleSubmit = async (
    data: CreateCondicionComercialData | UpdateCondicionComercialData
  ) => {
    setIsSubmitting(true);
    try {
      if (editingCondicion) {
        await updateCondicion(editingCondicion.id, data);
        showSuccess('Condición actualizada correctamente');
      } else {
        await createCondicion(data as CreateCondicionComercialData);
        showSuccess('Condición creada correctamente');
      }
      setShowForm(false);
      setEditingCondicion(null);
    } catch (err) {
      console.error('Error submitting:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const condicion = condiciones.find((c) => c.id === id);
    if (!condicion) return;

    const confirmed = await showConfirm({
      title: 'Eliminar condición comercial',
      message: `¿Estás seguro de eliminar "${condicion.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (confirmed) {
      const success = await deleteCondicion(id);
      if (success) {
        showSuccess('Condición eliminada correctamente');
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    const result = await duplicarCondicion(id);
    if (result) {
      showSuccess('Condición duplicada correctamente');
    }
  };

  const handleToggleActivo = async (id: string) => {
    const success = await toggleActivo(id);
    if (success) {
      showSuccess('Estado actualizado correctamente');
    }
  };

  const handleMarcarDefault = async (id: string) => {
    const condicion = condiciones.find((c) => c.id === id);
    if (!condicion) return;

    const confirmed = await showConfirm({
      title: 'Marcar como predeterminada',
      message: `¿Deseas marcar "${condicion.nombre}" como la condición predeterminada? Se desmarcará la actual.`,
      confirmText: 'Marcar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const success = await marcarComoDefault(id);
      if (success) {
        showSuccess('Condición marcada como predeterminada');
      }
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Estadísticas
  const stats = {
    total: condiciones.length,
    activas: condiciones.filter((c) => c.is_active).length,
    inactivas: condiciones.filter((c) => !c.is_active).length,
    default: condiciones.find((c) => c.es_default)?.nombre || 'Ninguna',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Condiciones Comerciales"
        description="Gestiona los templates de condiciones comerciales para tus presupuestos"
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Activas</p>
          <p className="text-2xl font-bold text-green-600">{stats.activas}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Inactivas</p>
          <p className="text-2xl font-bold text-gray-400">{stats.inactivas}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Predeterminada</p>
          <p className="text-sm font-semibold text-gray-900 truncate">
            {stats.default}
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="w-full sm:w-96">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar condiciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Create Button */}
        <Button onClick={handleCreate}>
          <Plus className="w-5 h-5 mr-2" />
          Nueva Condición
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCondiciones.length === 0 && !searchTerm && (
        <EmptyState
          title="No hay condiciones comerciales"
          description="Crea tu primera condición comercial para empezar a utilizarla en tus presupuestos"
          icon={AlertCircle}
          action={{
            label: 'Crear Condición',
            onClick: handleCreate,
          }}
        />
      )}

      {/* Empty Search Results */}
      {!loading && filteredCondiciones.length === 0 && searchTerm && (
        <EmptyState
          title="No se encontraron resultados"
          description={`No hay condiciones que coincidan con "${searchTerm}"`}
          icon={Search}
        />
      )}

      {/* Condiciones List */}
      {!loading && filteredCondiciones.length > 0 && (
        <div className="space-y-4">
          {filteredCondiciones.map((condicion) => (
            <CondicionComercialCard
              key={condicion.id}
              condicion={condicion}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onToggleActivo={handleToggleActivo}
              onMarcarDefault={handleMarcarDefault}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      <CondicionComercialForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingCondicion(null);
        }}
        onSubmit={handleSubmit}
        condicion={editingCondicion}
        isLoading={isSubmitting}
      />
    </div>
  );
}
