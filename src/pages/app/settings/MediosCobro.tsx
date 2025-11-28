import { useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { useMediosCobro } from '../../../hooks/useMediosCobro';
import { MedioCobro, MedioCobroFormData, TipoMedioCobro } from '../../../types/medios-cobro';
import { MedioCobroCard } from '../../../components/medios-cobro/MedioCobroCard';
import { MedioCobroForm } from '../../../components/medios-cobro/MedioCobroForm';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useToast } from '../../../contexts/ToastContext';

type FilterTab = 'todos' | 'pasarela' | 'bancario' | 'efectivo';

export default function MediosCobro() {
  const {
    mediosCobro,
    loading,
    createMedioCobro,
    updateMedioCobro,
    deleteMedioCobro,
    toggleActiveMedioCobro,
  } = useMediosCobro();
  const { showConfirm } = useConfirmDialog();
  const { showToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingMedio, setEditingMedio] = useState<MedioCobro | undefined>();
  const [activeTab, setActiveTab] = useState<FilterTab>('todos');

  const filteredMedios = mediosCobro.filter((medio) => {
    if (activeTab === 'todos') return true;
    return medio.tipo === activeTab;
  });

  const handleCreate = () => {
    setEditingMedio(undefined);
    setShowForm(true);
  };

  const handleEdit = (medio: MedioCobro) => {
    setEditingMedio(medio);
    setShowForm(true);
  };

  const handleSubmit = async (data: MedioCobroFormData) => {
    try {
      if (editingMedio) {
        await updateMedioCobro(editingMedio.id, data);
        showToast('Medio de cobro actualizado correctamente', 'success');
      } else {
        await createMedioCobro(data);
        showToast('Medio de cobro creado correctamente', 'success');
      }
      setShowForm(false);
      setEditingMedio(undefined);
    } catch (error) {
      console.error('Error saving medio:', error);
      showToast(
        error instanceof Error ? error.message : 'Error al guardar el medio de cobro',
        'error'
      );
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar Medio de Cobro',
      message: '¿Estás seguro de que deseas eliminar este medio de cobro? Si tiene pagos asociados, no podrá eliminarse.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      try {
        await deleteMedioCobro(id);
        showToast('Medio de cobro eliminado correctamente', 'success');
      } catch (error) {
        console.error('Error deleting medio:', error);
        showToast(
          error instanceof Error ? error.message : 'Error al eliminar el medio de cobro',
          'error'
        );
      }
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await toggleActiveMedioCobro(id);
      showToast('Estado actualizado correctamente', 'success');
    } catch (error) {
      console.error('Error toggling active:', error);
      showToast('Error al actualizar el estado', 'error');
    }
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'pasarela', label: 'Pasarelas' },
    { id: 'bancario', label: 'Bancarios' },
    { id: 'efectivo', label: 'Efectivo' },
  ];

  const getCountByType = (tipo: FilterTab) => {
    if (tipo === 'todos') return mediosCobro.length;
    return mediosCobro.filter((m) => m.tipo === tipo).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando medios de cobro...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Crear Medio de Cobro
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 py-4 text-sm font-medium border-b-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {getCountByType(tab.id)}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {filteredMedios.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No hay medios de cobro"
              description={
                activeTab === 'todos'
                  ? 'Comienza creando tu primer medio de cobro'
                  : `No hay medios de cobro del tipo "${activeTab}"`
              }
              action={
                activeTab === 'todos' ? (
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Medio de Cobro
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMedios.map((medio) => (
                <MedioCobroCard
                  key={medio.id}
                  medio={medio}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <MedioCobroForm
          medio={editingMedio}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingMedio(undefined);
          }}
        />
      )}
    </div>
  );
}
