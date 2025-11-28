import { useState } from 'react';
import { Plus, Wallet, Filter } from 'lucide-react';
import { useCajas, useCajaMutations } from '../../../hooks/useCajas';
import { CajaCard } from '../../../components/cajas/CajaCard';
import { CajaForm, CajaFormData } from '../../../components/cajas/CajaForm';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useToast } from '../../../contexts/ToastContext';
import { usePageHeader } from '../../../hooks/usePageHeader';
import type { CajaConMediosCobro } from '../../../types/medios-cobro';

type FilterTab = 'todas' | 'efectivo' | 'banco' | 'virtual';

export default function Cajas() {
  const { cajas, loading, refetch } = useCajas();
  const { crearCaja, actualizarCaja, eliminarCaja, verificarDependenciasCaja } = useCajaMutations();
  const { dialogState, isLoading: isDialogLoading, closeDialog, handleConfirm, showConfirm } = useConfirmDialog();
  const { showSuccess, showError } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingCaja, setEditingCaja] = useState<CajaConMediosCobro | undefined>();
  const [activeTab, setActiveTab] = useState<FilterTab>('todas');
  const [showInactive, setShowInactive] = useState(false);

  usePageHeader('Gestiona tus cajas y saldos');

  const filteredCajas = cajas.filter((caja) => {
    if (activeTab !== 'todas') {
      const tipoFiltro = activeTab === 'virtual' ? 'pasarela' : activeTab;
      if (caja.tipo !== tipoFiltro) return false;
    }
    if (!showInactive && !caja.is_active) return false;
    return true;
  });

  const handleCreate = () => {
    setEditingCaja(undefined);
    setShowForm(true);
  };

  const handleEdit = (caja: CajaConMediosCobro) => {
    setEditingCaja(caja);
    setShowForm(true);
  };

  const handleSubmit = async (data: CajaFormData) => {
    try {
      if (editingCaja) {
        await actualizarCaja(editingCaja.id, {
          nombre: data.nombre,
          tipo: data.tipo,
          moneda: data.moneda,
          es_principal: data.es_principal,
          is_active: data.is_active,
          notas: data.notas,
        });
        showSuccess('Caja actualizada correctamente');
      } else {
        await crearCaja({
          nombre: data.nombre,
          tipo: data.tipo,
          moneda: data.moneda,
          saldo_inicial: data.saldo_inicial,
          es_principal: data.es_principal,
          is_active: data.is_active,
          notas: data.notas,
        });
        showSuccess('Caja creada correctamente');
      }
      setShowForm(false);
      setEditingCaja(undefined);
      refetch();
    } catch (error) {
      console.error('Error saving caja:', error);
      showError(
        error instanceof Error ? error.message : 'Error al guardar la caja'
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // 1. Verificar dependencias antes de intentar eliminar
      const dependencias = await verificarDependenciasCaja(id);

      // 2. Si tiene medios de cobro asociados, no permitir eliminar
      if (!dependencias.puedeEliminar) {
        await showConfirm({
          title: 'No se puede eliminar la caja',
          message: `Esta caja tiene ${dependencias.mediosCobro} medio(s) de cobro asociado(s).\n\nPara eliminar esta caja, primero debes reasignar los medios de cobro a otra caja desde el módulo de Configuración > Medios de Cobro.${dependencias.movimientos > 0 ? `\n\nNota: Esta caja tiene ${dependencias.movimientos} movimiento(s) registrado(s) en el historial.` : ''}`,
          confirmText: 'Entendido',
          variant: 'warning'
        });
        return; // No continuar con la eliminación
      }

      // 3. Confirmar eliminación normal
      const mensaje = dependencias.movimientos > 0
        ? `¿Estás seguro de que deseas eliminar esta caja?\n\nTiene ${dependencias.movimientos} movimiento(s) registrado(s) que se mantendrán como historial.\n\nEsta acción no se puede deshacer.`
        : '¿Estás seguro de que deseas eliminar esta caja?\n\nEsta acción no se puede deshacer.';

      const confirmed = await showConfirm({
        title: 'Eliminar Caja',
        message: mensaje,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
      });

      if (confirmed) {
        await eliminarCaja(id);
        showSuccess('Caja eliminada correctamente');
        refetch();
      }
    } catch (error) {
      console.error('Error deleting caja:', error);

      // Manejo específico de error de constraint
      if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
        showError('No se puede eliminar la caja porque tiene medios de cobro o movimientos asociados. Reasigna los medios de cobro primero.');
      } else {
        showError(
          error instanceof Error ? error.message : 'Error al eliminar la caja'
        );
      }
    }
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'banco', label: 'Bancos' },
    { id: 'virtual', label: 'Virtuales' },
  ];

  const handleHeaderAction = () => {
    handleCreate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Cajas</h1>
          <p className="text-sm text-gray-600 mt-1">
            Administra tus cajas de efectivo, cuentas bancarias y billeteras virtuales
          </p>
        </div>
        <Button variant="primary" onClick={handleHeaderAction}>
          <Plus className="w-5 h-5" />
          Nueva Caja
        </Button>
      </div>

      {/* Tabs y Filtros */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-1">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          {showInactive ? 'Ocultar inactivas' : 'Mostrar inactivas'}
        </Button>
      </div>

      {/* Lista de Cajas */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando cajas...</p>
        </div>
      ) : filteredCajas.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No hay cajas"
          description={
            activeTab === 'todas'
              ? 'Crea tu primera caja para comenzar a gestionar tu flujo de efectivo'
              : `No hay cajas del tipo "${activeTab}"`
          }
          action={
            <Button variant="primary" onClick={handleCreate}>
              <Plus className="w-5 h-5" />
              Crear Primera Caja
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCajas.map((caja) => (
            <CajaCard
              key={caja.id}
              caja={caja}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal de Formulario */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingCaja(undefined);
        }}
        title={editingCaja ? 'Editar Caja' : 'Nueva Caja'}
        size="lg"
      >
        <CajaForm
          caja={editingCaja}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingCaja(undefined);
          }}
        />
      </Modal>

      {/* Dialog de Confirmación */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
        isLoading={isDialogLoading}
      />
    </div>
  );
}
