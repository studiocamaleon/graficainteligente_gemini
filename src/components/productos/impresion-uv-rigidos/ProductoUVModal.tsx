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
    { id: 'general', label: 'General' },
    ...(isEditing
      ? [
          { id: 'materiales', label: 'Materiales' },
          { id: 'precios', label: 'Precios Impresión' },
        ]
      : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <ProductoUVForm
            producto={producto}
            onSubmit={onSave}
            onCancel={onClose}
            isLoading={isLoading}
          />
        );
      case 'materiales':
        return isEditing ? <MaterialesUVEditor productoUvId={producto.id} /> : null;
      case 'precios':
        return isEditing ? <PreciosUVMatrizEditor productoUvId={producto.id} /> : null;
      default:
        return null;
    }
  };

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
      <div>
        {isEditing && (
          <div className="border-b border-gray-200">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
        )}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </Modal>
  );
}
