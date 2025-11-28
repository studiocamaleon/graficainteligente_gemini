import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ProductoPortabannerForm } from './ProductoPortabannerForm';
import { useProductoPortabanner } from '../../../hooks/useProductosPortabanners';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import type {
  ProductoPortabannerConRelaciones,
  CreateProductoPortabannerData,
} from '../../../types/database';

interface ProductoPortabannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoPortabannerConRelaciones;
  onSuccess: () => void;
}

export function ProductoPortabannerModal({
  isOpen,
  onClose,
  producto,
  onSuccess,
}: ProductoPortabannerModalProps) {
  const { createProducto, updateProducto, isLoading } = useProductoPortabanner(producto?.id);
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

  const handleSubmit = async (data: CreateProductoPortabannerData) => {
    try {
      if (producto) {
        await updateProducto(producto.id, data);
      } else {
        await createProducto(data);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving producto portabanner:', error);
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
        title={producto ? 'Editar Producto Portabanner' : 'Nuevo Producto Portabanner'}
        size="xl"
      >
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4">
          <ProductoPortabannerForm
            key={producto?.id || 'new'}
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
