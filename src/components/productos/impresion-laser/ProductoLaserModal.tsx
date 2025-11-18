import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ProductoLaserForm } from './ProductoLaserForm';
import { useProductoImpresionLaser, type ProductoLaserConRelaciones, type CreateProductoLaserData } from '../../../hooks/useProductosImpresionLaser';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';

interface ProductoLaserModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoLaserConRelaciones;
  onSuccess: () => void;
}

export function ProductoLaserModal({
  isOpen,
  onClose,
  producto,
  onSuccess,
}: ProductoLaserModalProps) {
  const { createProducto, updateProducto, isLoading } = useProductoImpresionLaser(producto?.id);
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

  const handleSubmit = async (data: CreateProductoLaserData) => {
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
          <ProductoLaserForm
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
