import { useState, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { RangoPrecioForm, RangoPrecioFormData } from '../../../components/abm-core/RangoPrecioForm';
import { useRangosPrecio, RangoPrecio } from '../../../hooks/useRangosPrecio';
import { useAuth } from '../../../hooks/useAuth';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

export function RangosPrecio() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRango, setSelectedRango] = useState<RangoPrecio | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const { rangos, loading, error, createRango, updateRango, deleteRango, fetchRangos } = useRangosPrecio();
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
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Rango
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestiona los rangos de cantidades para tablas de precio', headerAction);

  const filteredRangos = useMemo(() => {
    if (!searchTerm) return rangos;

    const search = searchTerm.toLowerCase();
    return rangos.filter((rango) => rango.nombre.toLowerCase().includes(search));
  }, [rangos, searchTerm]);

  const handleEdit = (rango: RangoPrecio) => {
    setSelectedRango(rango);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (rango: RangoPrecio) => {
    setSelectedRango(rango);
    setIsDetailModalOpen(true);
  };

  const handleDelete = async (rango: RangoPrecio) => {
    if (!canEdit) return;

    confirmDelete(rango.nombre, async () => {
      const success = await deleteRango(rango.id);
      if (success) {
        await fetchRangos();
      }
    });
  };

  const handleSubmit = async (data: RangoPrecioFormData) => {
    try {
      if (modalMode === 'create') {
        const newRango = await createRango(data);
        if (newRango) {
          setIsModalOpen(false);
          await fetchRangos();
        }
      } else if (selectedRango) {
        const updated = await updateRango(selectedRango.id, data);
        if (updated) {
          setIsModalOpen(false);
          await fetchRangos();
        }
      }
    } catch (error) {
      console.error('Error submitting rango:', error);
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (rango: RangoPrecio) => (
        <div className="font-medium text-gray-900">{rango.nombre}</div>
      ),
    },
    {
      key: 'unidad_medida',
      header: 'Unidad de Medida',
      render: (rango: RangoPrecio) => {
        const labels = {
          unidades: 'Unidades',
          mt2: 'MT²',
          mt_lineal: 'MT Lineal'
        };
        return <Badge variant="info">{labels[rango.unidad_medida]}</Badge>;
      },
    },
    {
      key: 'rangos',
      header: 'Cantidad de Rangos',
      render: (rango: RangoPrecio) => (
        <Badge variant="secondary">{rango.rangos.length} rango{rango.rangos.length !== 1 ? 's' : ''}</Badge>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (rango: RangoPrecio) => (
        <Badge variant={rango.is_active ? 'success' : 'secondary'}>
          {rango.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (rango: RangoPrecio) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(rango)}>
            <Eye className="w-4 h-4" />
          </Button>
          {canEdit && (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleEdit(rango)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(rango)}>
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </>
          )}
        </div>
      ),
      width: '150px',
    },
  ];

  if (error) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <SearchInput onChange={setSearchTerm} placeholder="Buscar rangos..." />
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          data={filteredRangos}
          keyExtractor={(rango) => rango.id}
          isLoading={loading}
          emptyMessage="No hay rangos de precio registrados"
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Crear Rango de Precio' : 'Editar Rango de Precio'}
        size="lg"
      >
        <RangoPrecioForm
          initialData={selectedRango}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          loading={loading}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles del Rango de Precio"
        size="lg"
      >
        {selectedRango && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Nombre</h3>
              <p className="text-base text-gray-900">{selectedRango.nombre}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Unidad de Medida</h3>
              <div className="inline-flex">
                <Badge variant="info">
                  {selectedRango.unidad_medida === 'unidades' && 'Unidades'}
                  {selectedRango.unidad_medida === 'mt2' && 'MT² (Metros Cuadrados)'}
                  {selectedRango.unidad_medida === 'mt_lineal' && 'MT Lineal (Metros Lineales)'}
                </Badge>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Rangos Configurados</h3>
              <div className="space-y-3">
                {selectedRango.rangos
                  .sort((a, b) => a.min - b.min)
                  .map((rango, index, array) => {
                    const getUnidadLabel = () => {
                      switch(selectedRango.unidad_medida) {
                        case 'mt2': return 'mt²';
                        case 'mt_lineal': return 'mt lineales';
                        case 'unidades': return 'unidades';
                        default: return 'unidades';
                      }
                    };

                    const formatRango = () => {
                      const isIlimitado = rango.max === null;
                      const isUltimo = index === array.length - 1;

                      if (isIlimitado) {
                        return `${rango.min} o más ${getUnidadLabel()}`;
                      }

                      if (isUltimo) {
                        return `${rango.min} a ${rango.max} ${getUnidadLabel()}`;
                      }

                      // Para rangos intermedios, mostrar el rango real (hasta .99)
                      const maxReal = (rango.max! - 0.01).toFixed(2);
                      return `${rango.min} a ${maxReal} ${getUnidadLabel()}`;
                    };

                    const getDescripcion = () => {
                      const isIlimitado = rango.max === null;
                      const isUltimo = index === array.length - 1;

                      if (isIlimitado) {
                        return `Desde ${rango.min} en adelante (sin límite superior)`;
                      }

                      if (isUltimo) {
                        return `Desde ${rango.min} hasta ${rango.max} (ambos valores inclusive)`;
                      }

                      // Para rangos intermedios, explicar que va hasta valores menores al máximo
                      const maxReal = (rango.max! - 0.01).toFixed(2);
                      return `Desde ${rango.min} hasta valores menores a ${rango.max} (por ejemplo, hasta ${maxReal})`;
                    };

                    return (
                      <div
                        key={index}
                        className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <span className="text-xs text-gray-500">Rango {index + 1}</span>
                            <div className="text-base font-medium text-gray-900">
                              {formatRango()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {getDescripcion()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
