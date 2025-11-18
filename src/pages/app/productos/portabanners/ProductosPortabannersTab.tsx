import { useState, useEffect, useRef } from 'react';
import { Package, Plus, Eye, Pencil, Power, Trash2 } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Table } from '../../../../components/ui/Table';
import { SearchInput } from '../../../../components/ui/SearchInput';
import { Select } from '../../../../components/ui/Select';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { useProductosPortabanners, useProductoPortabanner } from '../../../../hooks/useProductosPortabanners';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';
import { ProductoPortabannerModal } from '../../../../components/productos/portabanners/ProductoPortabannerModal';
import { ProductoPortabannerDetalle } from '../../../../components/productos/portabanners/ProductoPortabannerDetalle';
import type { ProductoPortabanner, ProductoPortabannerConRelaciones } from '../../../../types/database';

interface ProductosPortabannersTabProps {
  triggerCreate?: number;
}

export function ProductosPortabannersTab({ triggerCreate = 0 }: ProductosPortabannersTabProps) {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<ProductoPortabannerConRelaciones | null>(null);
  const [waitingToEdit, setWaitingToEdit] = useState(false);
  const lastTriggerRef = useRef<number>(triggerCreate);

  const filters = {
    search: search || undefined,
    isActive: filterActive === 'all' ? undefined : filterActive === 'active',
  };

  const { productos, isLoading, refetch } = useProductosPortabanners(filters);
  const {
    toggleStatus,
    deleteProducto,
    producto: productoCompleto,
    refetch: refetchProducto,
    isLoading: isLoadingProducto,
  } = useProductoPortabanner(selectedProducto?.id);

  useEffect(() => {
    if (triggerCreate && triggerCreate > 0 && triggerCreate !== lastTriggerRef.current) {
      lastTriggerRef.current = triggerCreate;
      setIsCreateModalOpen(true);
    }
  }, [triggerCreate]);

  useEffect(() => {
    if (waitingToEdit && productoCompleto && !isLoadingProducto) {
      setIsEditModalOpen(true);
      setWaitingToEdit(false);
    }
  }, [waitingToEdit, productoCompleto, isLoadingProducto]);

  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const handleVerDetalle = async (producto: ProductoPortabanner) => {
    setSelectedProducto(producto as ProductoPortabannerConRelaciones);
    await refetchProducto();
    setIsDetalleModalOpen(true);
  };

  const handleEditar = (producto: ProductoPortabanner) => {
    setSelectedProducto(producto as ProductoPortabannerConRelaciones);
    setWaitingToEdit(true);
  };

  const handleToggleStatus = (id: string, nombre: string, isActive: boolean) => {
    const action = isActive ? 'desactivar' : 'activar';
    confirmAction({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Producto`,
      message: `¿Estás seguro de que quieres ${action} el producto "${nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: isActive ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          await toggleStatus(id);
          refetch();
        } catch (error) {
          console.error('Error toggling status:', error);
        }
      },
    });
  };

  const handleEliminar = (id: string, nombre: string) => {
    confirmDelete(nombre, async () => {
      try {
        await deleteProducto(id);
        refetch();
      } catch (error) {
        console.error('Error deleting producto:', error);
      }
    });
  };

  const handleSuccess = () => {
    refetch();
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setWaitingToEdit(false);
    setSelectedProducto(null);
  };

  const handleCloseDetalle = () => {
    setIsDetalleModalOpen(false);
    setSelectedProducto(null);
  };

  const handleEditFromDetalle = () => {
    setIsDetalleModalOpen(false);
    setIsEditModalOpen(true);
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (producto: ProductoPortabanner) => (
        <span className="font-medium text-gray-900">{producto.nombre}</span>
      ),
    },
    {
      key: 'medida',
      header: 'Medida',
      render: (producto: ProductoPortabanner) => (
        <span className="text-sm text-gray-600">
          {producto.ancho_cm} x {producto.alto_cm} cm
        </span>
      ),
    },
    {
      key: 'tintas',
      header: 'Tintas',
      render: (producto: ProductoPortabanner) => (
        <div className="flex flex-wrap gap-1">
          {producto.tintas.slice(0, 2).map((tinta) => (
            <Badge key={tinta} variant="secondary" size="sm">
              {tinta}
            </Badge>
          ))}
          {producto.tintas.length > 2 && (
            <Badge variant="secondary" size="sm">
              +{producto.tintas.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'impuesto',
      header: 'IVA',
      render: (producto: ProductoPortabanner) => (
        <span className="text-sm text-gray-900">{producto.impuesto_iva}%</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (producto: ProductoPortabanner) => (
        <Badge variant={producto.is_active ? 'success' : 'secondary'}>
          {producto.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (producto: ProductoPortabanner) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVerDetalle(producto)}
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditar(producto)}
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(producto.id, producto.nombre, producto.is_active)}
            title={producto.is_active ? 'Desactivar' : 'Activar'}
            className={
              producto.is_active
                ? 'text-yellow-600 hover:text-yellow-700'
                : 'text-green-600 hover:text-green-700'
            }
          >
            <Power className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEliminar(producto.id, producto.nombre)}
            title="Eliminar"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre..."
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={filterActive} onChange={setFilterActive}>
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : productos.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Package}
              title={
                search || filterActive !== 'all'
                  ? 'No se encontraron productos'
                  : 'No hay productos creados'
              }
              description={
                search || filterActive !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza creando tu primer producto portabanner'
              }
              action={
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Producto
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table columns={columns} data={productos} keyExtractor={(producto) => producto.id} />
          </div>
        )}

        {!isLoading && productos.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando {productos.length} producto{productos.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </Card>

      <ProductoPortabannerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {productoCompleto && (
        <>
          <ProductoPortabannerModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setWaitingToEdit(false);
              setSelectedProducto(null);
            }}
            producto={productoCompleto}
            onSuccess={handleSuccess}
          />

          <ProductoPortabannerDetalle
            isOpen={isDetalleModalOpen}
            onClose={handleCloseDetalle}
            producto={productoCompleto}
            onEdit={handleEditFromDetalle}
            canEdit={true}
          />
        </>
      )}

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
    </>
  );
}
