import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { ProductoMaterialesRigidosForm } from './ProductoMaterialesRigidosForm';
import { useProductosMaterialesRigidos } from '../../../hooks/useProductosMaterialesRigidos';
import type { ProductoMaterialesRigidosFormData, ProductoMaterialesRigidosConRelaciones } from '../../../hooks/useProductosMaterialesRigidos';

interface ProductoMaterialesRigidosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  producto?: ProductoMaterialesRigidosConRelaciones;
}

export function ProductoMaterialesRigidosModal({
  isOpen,
  onClose,
  onSuccess,
  producto,
}: ProductoMaterialesRigidosModalProps) {
  const { createProducto, updateProducto } = useProductosMaterialesRigidos();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: ProductoMaterialesRigidosFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      if (producto) {
        await updateProducto(producto.id, formData);
      } else {
        await createProducto(formData);
      }
      onSuccess();
    } catch (err) {
      console.error('Error al guardar producto:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el producto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={producto ? 'Editar Producto de Materiales Rígidos' : 'Nuevo Producto de Materiales Rígidos'}
      size="xl"
    >
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-1">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <ProductoMaterialesRigidosForm
          producto={producto}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          isLoading={isLoading}
        />
      </div>
    </Modal>
  );
}
