import { useState, useMemo, useCallback } from 'react';
import { Zap, Plus, Edit2, Power, Eye, Trash2, FileText } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { CategoryColorList } from '../../../components/ui/CategoryColorList';
import { CollapsibleFilters } from '../../../components/ui/CollapsibleFilters';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ServicioForm, ServicioFormData } from '../../../components/abm-core/ServicioForm';

import { useServicios, useServicio } from '../../../hooks/useServicios';
import { useCategorias } from '../../../hooks/useCategorias';
import { useEstaciones } from '../../../hooks/useEstaciones';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useServiciosYAcabadosExport } from '../../../hooks/useServiciosYAcabadosExport';

import type { TipoImpactoPrecio } from '../../../types/database';

const tipoImpactoLabels: Record<TipoImpactoPrecio, string> = {
  sin_impacto: 'Sin Impacto',
  precio_fijo: 'Precio Fijo',
  por_unidad: 'Por Unidad',
  por_minuto: 'Por Minuto',
  porcentual: 'Porcentual',
  por_mt2: 'Por m²',
  por_mt_lineal: 'Por Metro Lineal',
  fijo_porcentual: 'Fijo + Porcentual',
  fijo_mt2: 'Fijo + Por m²',
  fijo_mt_lineal: 'Fijo + Por Metro Lineal',
  fijo_minuto: 'Fijo + Por Minuto',
  por_mt2_manual: 'Por m² (Manual)',
  fijo_mt2_manual: 'Fijo + Por m² (Manual)',
};


export function Servicios() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [estacionFilter, setEstacionFilter] = useState<string>('all');
  const [tipoImpactoFilter, setTipoImpactoFilter] = useState<string>('all');
  const [independienteFilter, setIndependienteFilter] = useState<string>('all');
  const [nivelesFilter, setNivelesFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const [categoriaSearchTerm, setCategoriaSearchTerm] = useState('');
  const [estacionSearchTerm, setEstacionSearchTerm] = useState('');

  const { categorias } = useCategorias({
    searchTerm: categoriaSearchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  const { estaciones } = useEstaciones({
    searchTerm: estacionSearchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  const handleOpenCreateModal = useCallback(() => {
    setSelectedServicio(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  /* Export Logic */
  const { handleExport, isExporting } = useServiciosYAcabadosExport();

  const headerAction = useMemo(
    () => (
      <div className="flex gap-2">

        {canEdit && (
          <Button variant="primary" onClick={handleOpenCreateModal}>
            <Plus className="w-5 h-5 ml-1" />
            Nuevo Servicio
          </Button>
        )}
      </div>
    ),
    [canEdit, handleOpenCreateModal, handleExport, isExporting]
  );

  usePageHeader('Administra servicios adicionales con precios y configuración flexible', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const categoriaIdFilter = categoriaFilter === 'all' ? null : categoriaFilter;
  const estacionIdFilter = estacionFilter === 'all' ? null : estacionFilter;
  const tipoImpactoFilterValue = tipoImpactoFilter === 'all' ? null : (tipoImpactoFilter as TipoImpactoPrecio);
  const independienteFilterValue = independienteFilter === 'all' ? null : independienteFilter === 'si';
  const nivelesFilterValue = nivelesFilter === 'all' ? null : nivelesFilter === 'con_niveles';

  const activeFiltersCount = [
    searchTerm,
    categoriaFilter !== 'all',
    estacionFilter !== 'all',
    tipoImpactoFilter !== 'all',
    independienteFilter !== 'all',
    nivelesFilter !== 'all',
    statusFilter !== 'all'
  ].filter(Boolean).length;

  const { servicios, totalCount, loading, refetch } = useServicios({
    searchTerm: debouncedSearch,
    categoriaId: categoriaIdFilter,
    estacionId: estacionIdFilter,
    tipoImpacto: tipoImpactoFilterValue,
    disponibleIndependiente: independienteFilterValue,
    tieneNiveles: nivelesFilterValue,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
  });

  const { createServicio, updateServicio, toggleServicioStatus, deleteServicio, loading: mutationLoading } = useServicio();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleEdit = (servicio: any) => {
    setSelectedServicio(servicio);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (servicio: any) => {
    setSelectedServicio(servicio);
    setIsDetailModalOpen(true);
  };

  const handleToggleStatus = async (servicio: any) => {
    if (!canEdit) return;

    const action = servicio.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} el servicio "${servicio.nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: servicio.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleServicioStatus(servicio.id, servicio.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleDelete = async (servicio: any) => {
    if (!canEdit) return;

    confirmDelete(servicio.nombre, async () => {
      const success = await deleteServicio(servicio.id);
      if (success) {
        refetch();
      }
    });
  };

  const handleSubmit = async (data: ServicioFormData) => {
    try {
      if (modalMode === 'create') {
        await createServicio(data);
        setIsModalOpen(false);
        refetch();
      } else if (selectedServicio) {
        await updateServicio(selectedServicio.id, data);
        setIsModalOpen(false);
        refetch();
      }
    } catch (error) {
      console.error('Error submitting servicio:', error);
      throw error;
    }
  };

  const categoriaOptions = [
    { value: 'all', label: 'Todas las categorías' },
    ...categorias.map((cat) => ({ value: cat.id, label: cat.nombre })),
  ];

  const estacionOptions = [
    { value: 'all', label: 'Todas las estaciones' },
    ...estaciones.map((est) => ({ value: est.id, label: est.nombre })),
  ];

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (servicio: any) => <div className="font-medium text-gray-900">{servicio.nombre}</div>,
      width: '200px',
    },
    {
      key: 'categorias',
      header: 'Categorías',
      render: (servicio: any) => (
        <CategoryColorList categories={servicio.servicios_categorias || []} maxVisible={8} />
      ),
      width: '150px',
    },
    {
      key: 'estacion',
      header: 'Estación',
      render: (servicio: any) => (
        <span className="text-sm text-gray-600">{servicio.estacion?.nombre || '-'}</span>
      ),
      width: '250px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (servicio: any) => (
        <Badge variant={servicio.is_active ? 'primary' : 'secondary'} size="sm">
          {servicio.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (servicio: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(servicio)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(servicio)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(servicio)}
                className={`p-2 rounded-lg transition-colors ${servicio.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                  }`}
                title={servicio.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoading}
              >
                <Power className="w-4 h-4" />
              </button>

              {(profile?.role === 'super_admin' || profile?.role === 'admin') && (
                <button
                  onClick={() => handleDelete(servicio)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                  disabled={mutationLoading}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      ),
      width: '180px',
    },
  ];

  return (
    <div>
      <Card padding="none">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <CollapsibleFilters storageKey="servicios-filters" activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <SearchInput onChange={setSearchTerm} placeholder="Buscar por nombre..." />
              </div>

              <SearchableSelect
                value={categoriaFilter}
                onChange={setCategoriaFilter}
                onSearch={setCategoriaSearchTerm}
                options={categoriaOptions}
                placeholder="Filtrar por categoría..."
                emptyMessage="No se encontraron categorías"
              />

              <SearchableSelect
                value={estacionFilter}
                onChange={setEstacionFilter}
                onSearch={setEstacionSearchTerm}
                options={estacionOptions}
                placeholder="Filtrar por estación..."
                emptyMessage="No se encontraron estaciones"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                value={tipoImpactoFilter}
                onChange={setTipoImpactoFilter}
                options={[
                  { value: 'all', label: 'Todos los tipos' },
                  { value: 'precio_fijo', label: 'Precio Fijo' },
                  { value: 'por_unidad', label: 'Por Unidad' },
                  { value: 'porcentual', label: 'Porcentual' },
                  { value: 'por_mt2', label: 'Por m²' },
                ]}
              />

              <Select
                value={independienteFilter}
                onChange={setIndependienteFilter}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'si', label: 'Independientes' },
                  { value: 'no', label: 'No independientes' },
                ]}
              />

              <Select
                value={nivelesFilter}
                onChange={setNivelesFilter}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'con_niveles', label: 'Con niveles' },
                  { value: 'sin_niveles', label: 'Sin niveles' },
                ]}
              />

              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Todos los estados' },
                  { value: 'active', label: 'Solo activos' },
                  { value: 'inactive', label: 'Solo inactivos' },
                ]}
              />
            </div>
          </CollapsibleFilters>

          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{totalCount}</span> servicios
          </div>
        </div>

        <Table
          columns={columns}
          data={servicios}
          keyExtractor={(servicio) => servicio.id}
          emptyMessage="No se encontraron servicios"
          isLoading={loading}
          dense
        />

        {totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Nuevo Servicio' : 'Editar Servicio'}
        size="xl"
      >
        <ServicioForm
          servicio={selectedServicio || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles del Servicio"
        size="lg"
      >
        {selectedServicio && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre del Servicio</p>
                  <p className="font-medium text-lg">{selectedServicio.nombre}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Categorías</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedServicio.servicios_categorias && selectedServicio.servicios_categorias.length > 0 ? (
                        selectedServicio.servicios_categorias.map((cat: any, idx: number) => (
                          <Badge key={idx} variant="info">
                            {cat.categoria?.nombre || '-'}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estación</p>
                    <p className="font-medium">{selectedServicio.estacion?.nombre || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Disponible Independiente</p>
                    <Badge variant={selectedServicio.disponible_independiente ? 'primary' : 'secondary'}>
                      {selectedServicio.disponible_independiente ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <Badge variant={selectedServicio.is_active ? 'primary' : 'secondary'}>
                      {selectedServicio.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {selectedServicio.tiene_niveles_precio ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Niveles de Precio</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedServicio.niveles_precio
                        ?.sort((a: any, b: any) => a.orden - b.orden)
                        .map((nivel: any) => (
                          <tr key={nivel.id}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-medium text-gray-900">{nivel.nombre}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {tipoImpactoLabels[nivel.tipo_impacto as TipoImpactoPrecio]}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              ${nivel.valor_impacto}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Configuración de Precio</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tipo de Impacto</p>
                    <p className="font-medium">
                      {tipoImpactoLabels[selectedServicio.tipo_impacto as TipoImpactoPrecio] || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Valor</p>
                    <p className="font-medium">${selectedServicio.valor_impacto || 0}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Creado el</p>
                  <p className="font-medium">
                    {new Date(selectedServicio.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Última actualización</p>
                  <p className="font-medium">
                    {new Date(selectedServicio.updated_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
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
