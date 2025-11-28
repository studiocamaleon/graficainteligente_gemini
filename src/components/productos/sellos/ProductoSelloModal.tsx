import { Modal } from '../../ui/Modal';
import { ProductoSelloForm } from './ProductoSelloForm';
import type { ProductoSelloConRelaciones, CreateProductoSelloData } from '../../../types/database';

interface ProductoSelloModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoSelloConRelaciones;
  onSubmit: (data: CreateProductoSelloData) => Promise<void>;
  isLoading?: boolean;
}

export function ProductoSelloModal({
  isOpen,
  onClose,
  producto,
  onSubmit,
  isLoading = false,
}: ProductoSelloModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={producto ? 'Editar Producto de Sello' : 'Nuevo Producto de Sello'}
      size="lg"
    >
      <ProductoSelloForm
        key={producto?.id || 'new'}
        producto={producto}
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isLoading}
      />
    </Modal>
  );
}
