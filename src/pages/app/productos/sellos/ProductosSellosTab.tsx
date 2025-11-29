import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Power } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Table } from '../../../../components/ui/Table';
import { Badge } from '../../../../components/ui/Badge';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ProductoSelloModal } from '../../../../components/productos/sellos/ProductoSelloModal';
import { useProductosSellos, useProductoSelloActions } from '../../../../hooks/useProductosSellos';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';
import { useAuth } from '../../../../hooks/useAuth';
import type { CreateProductoSelloData, ProductoSelloConRelaciones } from '../../../../types/database';

interface ProductosSellosTabProps {
  triggerCreate?: number;
}

const getTipoProductoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    sello: 'Sello',
    repuesto: 'Repuesto',
    polimero: 'Polímero',
    tinta: 'Tinta',
    accesorios: 'Accesorios',
  };
  return labels[tipo] || tipo;
};

export function ProductosSellosTab({ triggerCreate }: ProductosSellosTabProps) {
  const { profile } = useAuth();
  const isOperador = ['operador_diseno', 'operador_taller'].includes(profile?.role || '');

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<ProductoSelloConRelaciones | undefined>();

  const { productos, isLoading, refetch } = useProductosSellos({ search });
  const { createProducto, updateProducto, deleteProducto, toggleActive, isLoading: isActioning } =
    useProductoSelloActions();
  const { showConfirm } = useConfirmDialog();

  useEffect(() => {
    if (triggerCreate) {
      handleOpenCreate();
    }
  }, [triggerCreate]);

  const handleOpenCreate = () => {
    setSelectedProducto(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (producto: ProductoSelloConRelaciones) => {
    setSelectedProducto(producto);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProducto(undefined);
  };

  const handleSubmit = async (data: CreateProductoSelloData) => {
    if (selectedProducto) {
      const success = await updateProducto(selectedProducto.id, data);
      if (success) {
        handleCloseModal();
        refetch();
      }
    } else {
      const result = await createProducto(data);
      if (result) {
        handleCloseModal();
        refetch();
      }
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar Producto',
      message: `¿Estás seguro de que deseas eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const success = await deleteProducto(id);
      if (success) {
        refetch();
      }
    }
  };

  const handleToggleActive = async (id: string, nombre: string, currentStatus: boolean) => {
    const action = currentStatus ? 'desactivar' : 'activar';
    const confirmed = await showConfirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Producto`,
      message: `¿Estás seguro de que deseas ${action} el producto "${nombre}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      const success = await toggleActive(id, !currentStatus);
      if (success) {
        refetch();
      }
    }
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (producto: any) => (
        <div className="font-medium text-gray-900">{producto.nombre}</div>
      ),
    },
    {
      key: 'tipo_producto',
      header: 'Tipo',
      render: (producto: any) => (
        <Badge variant="default" className="bg-violet-600 text-white">
          {getTipoProductoLabel(producto.tipo_producto)}
        </Badge>
      ),
    },
    {
      key: 'marca',
      header: 'Marca',
      render: (producto: any) => (
        <span className="text-sm text-gray-600">{producto.marca || '-'}</span>
      ),
    },
    {
      key: 'medidas',
      header: 'Medidas',
      render: (producto: any) => {
        if (producto.medida_ancho && producto.medida_alto) {
          return (
            <span className="text-sm text-gray-600">
              {producto.medida_ancho} x {producto.medida_alto} mm
            </span>
          );
        }
        return <span className="text-sm text-gray-400">-</span>;
      },
    },
    {
      key: 'impuesto_iva',
      header: 'IVA',
      render: (producto: any) => (
        <span className="text-sm text-gray-600">{producto.impuesto_iva}%</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: (producto: any) => (
        <Badge variant={producto.is_active ? 'success' : 'default'}>
          {producto.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (producto: any) => (
        <div className="flex items-center gap-2">
          {!isOperador && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenEdit(producto)}
                disabled={isActioning}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleToggleActive(producto.id, producto.nombre, producto.is_active)}
                disabled={isActioning}
              >
                <Power
                  className={`w-4 h-4 ${producto.is_active ? 'text-green-600' : 'text-gray-400'}`}
                />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(producto.id, producto.nombre)}
                disabled={isActioning}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <div className="p-12 flex justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mb-4"></div>
            <p className="text-sm text-gray-500">Cargando productos...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Buscar productos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {productos.length === 0 ? (
            <EmptyState
              icon={Plus}
              title={search ? 'No se encontraron productos' : 'No hay productos de sellos'}
              description={
                search
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza creando tu primer producto de sello'
              }
            />
          ) : (
            <Table columns={columns} data={productos} keyExtractor={(producto) => producto.id} />
          )}
        </div>
      </Card>

      <ProductoSelloModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        producto={selectedProducto}
        onSubmit={handleSubmit}
        isLoading={isActioning}
      />
    </>
  );
}
