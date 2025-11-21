import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ProductoTalonarioForm } from './ProductoTalonarioForm';
import { useProductoTalonario, type ProductoTalonarioConRelaciones, type CreateProductoTalonarioData } from '../../../hooks/useProductosTalonarios';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

interface ProductoTalonarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoTalonarioConRelaciones;
  onSuccess: () => void;
}

export function ProductoTalonarioModal({
  isOpen,
  onClose,
  producto,
  onSuccess,
}: ProductoTalonarioModalProps) {
  const { createProducto, updateProducto, isLoading } = useProductoTalonario(producto?.id);
  const [hasChanges, setHasChanges] = useState(false);
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  useEffect(() => {
    if (!isOpen) {
      setHasChanges(false);
    }
  }, [isOpen]);

  const handleSubmit = async (data: CreateProductoTalonarioData) => {
    try {
      if (producto) {
        await updateProducto(producto.id, data);
      } else {
        await createProducto(data);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving producto:', error);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      confirmAction({
        title: 'Cambios sin guardar',
        message: '¿Estás seguro de que quieres cerrar? Los cambios no guardados se perderán.',
        confirmText: 'Cerrar sin guardar',
        cancelText: 'Continuar editando',
        variant: 'warning',
        onConfirm: () => {
          onClose();
        },
      });
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={producto ? 'Editar Producto' : 'Nuevo Producto'}
        size="xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4">
          <ProductoTalonarioForm
            producto={producto}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            isLoading={isLoading}
            onFormChange={() => setHasChanges(true)}
          />
        </div>
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
    </>
  );
}
