import { useState, useMemo, useCallback } from 'react';
import { Percent, Plus, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useCentroCopiadoRangosPrecioImpresion } from '../../../hooks/useCentroCopiadoRangosPrecioImpresion';
import { RangoPrecioImpresionForm } from '../../../components/centro-copiado/RangoPrecioImpresionForm';
import type { CentroCopiadoRangoPrecioImpresion } from '../../../types/database';

export function RangosPrecio() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRango, setSelectedRango] = useState<CentroCopiadoRangoPrecioImpresion | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const {
    rangos,
    loading,
    createRango,
    updateRango,
    deleteRango,
    fetchRangos,
  } = useCentroCopiadoRangosPrecioImpresion();

  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
  } = useConfirmDialog();

  const handleOpenCreateModal = useCallback(() => {
    setSelectedRango(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () => (
      <Button variant="primary" onClick={handleOpenCreateModal}>
        <Plus className="w-5 h-5" />
        Nuevo Rango
      </Button>
    ),
    [handleOpenCreateModal]
  );

  usePageHeader('Configura los rangos de cantidad de hojas para el sistema de precios escalonados', headerAction);

  const handleEdit = (rango: CentroCopiadoRangoPrecioImpresion) => {
    setSelectedRango(rango);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDelete = async (rango: CentroCopiadoRangoPrecioImpresion) => {
    confirmDelete(rango.nombre, async () => {
      const success = await deleteRango(rango.id);
      if (success) {
        await fetchRangos();
      }
    });
  };

  const handleSubmit = async (data: any) => {
    if (modalMode === 'create') {
      const result = await createRango(data);
      if (result) {
        setIsModalOpen(false);
        await fetchRangos();
      }
    } else if (selectedRango) {
      const result = await updateRango(selectedRango.id, data);
      if (result) {
        setIsModalOpen(false);
        await fetchRangos();
      }
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando rangos...</p>
          </div>
        </Card>
      );
    }

    if (rangos.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={Percent}
              title="No hay rangos de precio configurados"
              description="Comienza creando rangos de cantidad de hojas para aplicar precios escalonados. Por ejemplo: 1-50 hojas, 51-100 hojas, 101-500 hojas, etc."
            />
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <div className="p-6">
          <Table
            columns={[
              {
                key: 'orden',
                header: 'Orden',
                render: (rango: CentroCopiadoRangoPrecioImpresion) => (
                  <Badge variant="secondary">{rango.orden}</Badge>
                )
              },
              {
                key: 'nombre',
                header: 'Nombre del Rango',
                render: (rango: CentroCopiadoRangoPrecioImpresion) => (
                  <span className="font-medium">{rango.nombre}</span>
                )
              },
              {
                key: 'rango',
                header: 'Cantidad de Hojas',
                render: (rango: CentroCopiadoRangoPrecioImpresion) => (
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">
                      {rango.hojas_desde} - {rango.hojas_hasta || '∞'}
                    </Badge>
                  </div>
                )
              },
              {
                key: 'actions',
                header: 'Acciones',
                render: (rango: CentroCopiadoRangoPrecioImpresion) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(rango)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rango)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
            data={rangos}
            keyExtractor={(rango) => rango.id}
          />
        </div>
      </Card>
    );
  };

  const maxOrden = rangos.length > 0 ? Math.max(...rangos.map(r => r.orden), 0) : 0;

  return (
    <div className="space-y-6">
      {renderContent()}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Nuevo Rango de Precio' : 'Editar Rango de Precio'}
      >
        <RangoPrecioImpresionForm
          rango={modalMode === 'edit' ? selectedRango || undefined : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          maxOrden={maxOrden}
        />
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
