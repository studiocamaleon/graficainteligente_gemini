import { useState, useEffect, useRef } from 'react';
import { Package, Plus, Eye, Pencil, Power, Trash2 } from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Table } from '../../../../components/ui/Table';
import { SearchInput } from '../../../../components/ui/SearchInput';
import { Select } from '../../../../components/ui/Select';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { useProductosPlotterCorte, useProductoPlotterCorte } from '../../../../hooks/useProductosPlotterCorte';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';
import { useAuth } from '../../../../hooks/useAuth';
import { ProductoPlotterCorteModal } from '../../../../components/productos/plotter-corte/ProductoPlotterCorteModal';
import { ProductoPlotterCorteDetalle } from '../../../../components/productos/plotter-corte/ProductoPlotterCorteDetalle';
import type { ProductoPlotterCorte, ProductoPlotterCorteConRelaciones } from '../../../../types/database';

interface ProductosPlotterCorteTabProps {
  triggerCreate?: number;
}

export function ProductosPlotterCorteTab({ triggerCreate = 0 }: ProductosPlotterCorteTabProps) {
  const { profile } = useAuth();
  const isOperador = ['operador_diseno', 'operador_taller'].includes(profile?.role || '');

  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<ProductoPlotterCorteConRelaciones | null>(null);
  const [waitingToEdit, setWaitingToEdit] = useState(false);
  const lastTriggerRef = useRef<number>(triggerCreate);

  const filters = {
    search: search || undefined,
    isActive: filterActive === 'all' ? undefined : filterActive === 'active',
  };

  const { productos, isLoading, refetch } = useProductosPlotterCorte(filters);
  const {
    toggleStatus,
    deleteProducto,
    producto: productoCompleto,
    refetch: refetchProducto,
    isLoading: isLoadingProducto,
  } = useProductoPlotterCorte(selectedProducto?.id);

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

  const handleVerDetalle = async (producto: ProductoPlotterCorte) => {
    setSelectedProducto(producto as ProductoPlotterCorteConRelaciones);
    await refetchProducto();
    setIsDetalleModalOpen(true);
  };

  const handleEditar = (producto: ProductoPlotterCorte) => {
    setSelectedProducto(producto as ProductoPlotterCorteConRelaciones);
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
      render: (producto: ProductoPlotterCorte) => (
        <span className="font-medium text-gray-900">{producto.nombre}</span>
      ),
    },
    {
      key: 'anchos',
      header: 'Anchos',
      render: (producto: ProductoPlotterCorte) => (
        <span className="text-sm text-gray-600">
          {producto.anchos_disponibles.sort((a, b) => a - b).join(', ')} cm
        </span>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (producto: ProductoPlotterCorte) => (
        <Badge variant="secondary">{producto.color}</Badge>
      ),
    },
    {
      key: 'marca',
      header: 'Marca',
      render: (producto: ProductoPlotterCorte) => (
        <span className="text-sm text-gray-600">{producto.marca || 'Sin marca'}</span>
      ),
    },
    {
      key: 'impuesto',
      header: 'IVA',
      render: (producto: ProductoPlotterCorte) => (
        <span className="text-sm text-gray-900">{producto.impuesto_iva}%</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (producto: ProductoPlotterCorte) => (
        <Badge variant={producto.is_active ? 'success' : 'secondary'}>
          {producto.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (producto: ProductoPlotterCorte) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleVerDetalle(producto)}
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {!isOperador && (
            <>
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
            </>
          )}
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
                  : 'Comienza creando tu primer producto de plotter de corte'
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

      <ProductoPlotterCorteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {productoCompleto && (
        <>
          <ProductoPlotterCorteModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setWaitingToEdit(false);
              setSelectedProducto(null);
            }}
            producto={productoCompleto}
            onSuccess={handleSuccess}
          />

          <ProductoPlotterCorteDetalle
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
