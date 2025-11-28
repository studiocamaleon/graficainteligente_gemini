import { useState, useEffect } from 'react';
import { Edit2, Trash2, Search } from 'lucide-react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { SearchInput } from '../../../../components/ui/SearchInput';
import { ProductoUVModal } from '../../../../components/productos/impresion-uv-rigidos/ProductoUVModal';
import { useProductosImpresionUVRigidos } from '../../../../hooks/useProductosImpresionUVRigidos';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';
import type {
  CreateProductoUVInput,
  UpdateProductoUVInput,
} from '../../../../hooks/useProductosImpresionUVRigidos';

interface ProductosUVTabProps {
  triggerCreate?: number;
}

export function ProductosUVTab({ triggerCreate }: ProductosUVTabProps) {
  const {
    productos,
    loading,
    createProducto,
    updateProducto,
    deleteProducto,
  } = useProductosImpresionUVRigidos();

  const { showConfirm } = useConfirmDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (triggerCreate && triggerCreate > 0) {
      handleOpenCreateModal();
    }
  }, [triggerCreate]);

  const handleOpenCreateModal = () => {
    setEditingProducto(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (producto: any) => {
    setEditingProducto(producto);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProducto(null);
  };

  const handleSave = async (data: CreateProductoUVInput | UpdateProductoUVInput) => {
    setIsSaving(true);
    try {
      if (editingProducto) {
        await updateProducto(editingProducto.id, data as UpdateProductoUVInput);
      } else {
        await createProducto(data as CreateProductoUVInput);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving producto:', error);
      alert('Error al guardar el producto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    const confirmed = await showConfirm({
      title: 'Eliminar Producto',
      message: `¿Está seguro de eliminar el producto "${nombre}"?`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
      await deleteProducto(id);
    } catch (error) {
      console.error('Error deleting producto:', error);
      alert('Error al eliminar el producto');
    }
  };

  const filteredProductos = productos.filter((producto) =>
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar productos..."
          />
        </div>
      </div>

      {filteredProductos.length === 0 ? (
        <EmptyState
          icon={Search}
          title={searchTerm ? 'No se encontraron productos' : 'No hay productos'}
          description={
            searchTerm
              ? 'Intenta con otros términos de búsqueda'
              : 'Comienza creando tu primer producto de Impresión UV'
          }
          action={
            !searchTerm
              ? {
                  label: 'Crear Primer Producto',
                  onClick: handleOpenCreateModal,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProductos.map((producto) => (
            <Card key={producto.id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {producto.nombre}
                      </h3>
                      <Badge variant={producto.is_active ? 'success' : 'secondary'}>
                        {producto.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>

                    {producto.descripcion && (
                      <p className="text-sm text-gray-600 mb-3">
                        {producto.descripcion}
                      </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {producto.limite_ancho_cm && (
                        <div>
                          <span className="text-gray-600">Ancho máx:</span>{' '}
                          <span className="font-medium">
                            {producto.limite_ancho_cm} cm
                          </span>
                        </div>
                      )}
                      {producto.limite_alto_cm && (
                        <div>
                          <span className="text-gray-600">Alto máx:</span>{' '}
                          <span className="font-medium">
                            {producto.limite_alto_cm} cm
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600">Material cliente:</span>{' '}
                        <span className="font-medium">
                          {producto.material_cliente_permitido ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Servicios:</span>{' '}
                        <span className="font-medium">
                          {producto.servicios.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEditModal(producto)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(producto.id, producto.nombre)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProductoUVModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        producto={editingProducto}
        onSave={handleSave}
        isLoading={isSaving}
      />
    </div>
  );
}
