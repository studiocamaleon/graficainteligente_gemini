import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Tabs } from '../../ui/Tabs';
import { ProductoUVForm } from './ProductoUVForm';
import { MaterialesUVEditor } from './MaterialesUVEditor';
import { PreciosUVMatrizEditor } from './PreciosUVMatrizEditor';
import type {
  ProductoImpresionUVRigido,
  CreateProductoUVInput,
  UpdateProductoUVInput,
} from '../../../hooks/useProductosImpresionUVRigidos';

interface ProductoUVModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto?: ProductoImpresionUVRigido;
  onSave: (data: CreateProductoUVInput | UpdateProductoUVInput) => Promise<void>;
  isLoading?: boolean;
}

export function ProductoUVModal({
  isOpen,
  onClose,
  producto,
  onSave,
  isLoading,
}: ProductoUVModalProps) {
  const [activeTab, setActiveTab] = useState('general');

  const isEditing = !!producto;

  const tabs = [
    {
      id: 'general',
      label: 'General',
      content: (
        <ProductoUVForm
          producto={producto}
          onSubmit={onSave}
          onCancel={onClose}
          isLoading={isLoading}
        />
      ),
    },
    ...(isEditing
      ? [
          {
            id: 'materiales',
            label: 'Materiales',
            content: <MaterialesUVEditor productoUvId={producto.id} />,
          },
          {
            id: 'precios',
            label: 'Precios Impresión',
            content: <PreciosUVMatrizEditor productoUvId={producto.id} />,
          },
        ]
      : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? `Editar Producto UV: ${producto.nombre}`
          : 'Nuevo Producto de Impresión UV'
      }
      size="2xl"
    >
      <div className="p-6">
        {isEditing ? (
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        ) : (
          <ProductoUVForm
            onSubmit={onSave}
            onCancel={onClose}
            isLoading={isLoading}
          />
        )}
      </div>
    </Modal>
  );
}
