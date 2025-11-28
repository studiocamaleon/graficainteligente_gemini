import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { ProductoPlotterCorteForm } from './ProductoPlotterCorteForm';
import { useProductoPlotterCorte } from '../../../hooks/useProductosPlotterCorte';
import type { ProductoPlotterCorteConRelaciones } from '../../../types/database';

interface ProductoPlotterCorteModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoPlotterCorteConRelaciones;
  onSuccess: () => void;
}

export function ProductoPlotterCorteModal({
  isOpen,
  onClose,
  producto,
  onSuccess,
}: ProductoPlotterCorteModalProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { createProducto, updateProducto, isLoading } = useProductoPlotterCorte();

  const handleSubmit = async (data: any) => {
    try {
      if (producto) {
        await updateProducto(producto.id, data);
      } else {
        await createProducto(data);
      }
      setHasUnsavedChanges(false);
      onSuccess();
    } catch (error) {
      console.error('Error al guardar producto:', error);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        '¿Estás seguro de que quieres cerrar? Los cambios no guardados se perderán.'
      );
      if (!confirm) return;
    }
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleFormChange = () => {
    setHasUnsavedChanges(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={producto ? 'Editar Producto Plotter de Corte' : 'Nuevo Producto Plotter de Corte'}
      maxWidth="4xl"
    >
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <ProductoPlotterCorteForm
          key={producto?.id || 'new'}
          producto={producto}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          isLoading={isLoading}
          onFormChange={handleFormChange}
        />
      </div>
    </Modal>
  );
}
