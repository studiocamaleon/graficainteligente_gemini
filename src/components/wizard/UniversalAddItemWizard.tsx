import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { X } from 'lucide-react';
import { UniversalProductSearchStep } from './steps/UniversalProductSearchStep';
import type { UniversalProductSearchResult } from '../../hooks/wizard/useUniversalProductSearch';

interface UniversalAddItemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAgregar: (itemData: any) => Promise<void>;
}

export function UniversalAddItemWizard({ isOpen, onClose, onAgregar }: UniversalAddItemWizardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<UniversalProductSearchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setSearchTerm('');
    setSelectedProduct(null);
    onClose();
  };

  const handleSelectProduct = (product: UniversalProductSearchResult) => {
    setSelectedProduct(product);
    // Por ahora, mostrar la información del producto seleccionado
    console.log('Producto seleccionado:', product);
  };

  const handleAgregar = async () => {
    if (!selectedProduct) return;

    setIsSubmitting(true);
    try {
      // Por ahora, crear un item básico
      const itemData = {
        producto_id: selectedProduct.id,
        producto_nombre: selectedProduct.nombre,
        categoria: selectedProduct.categoria,
        categoria_id: selectedProduct.categoria_id,
        cantidad: 1,
        configuracion: {
          categoria: selectedProduct.categoria,
        },
        precio_base: selectedProduct.precio_desde || 0,
        precio_servicios: 0,
        precio_acabados: 0,
        precio_unitario_final: selectedProduct.precio_desde || 0,
        precio_total: selectedProduct.precio_desde || 0,
      };

      await onAgregar(itemData);
      handleClose();
    } catch (error) {
      console.error('Error agregando item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Agregar Item a la Orden"
      size="xl"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Agregar Item a la Orden</h2>
            <p className="text-sm text-gray-600 mt-1">
              Busca y configura el producto que deseas agregar
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {!selectedProduct ? (
            <UniversalProductSearchStep
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSelectProduct={handleSelectProduct}
            />
          ) : (
            <div className="space-y-6">
              {/* Producto seleccionado */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedProduct.nombre}</h3>
                    <p className="text-sm text-gray-600">{selectedProduct.categoria}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedProduct(null)}
                  >
                    Cambiar
                  </Button>
                </div>
              </div>

              {/* Mensaje informativo */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Funcionalidad en desarrollo:</strong> La configuración completa del producto
                  estará disponible próximamente. Por ahora, se agregará el producto con configuración básica.
                </p>
              </div>

              {/* Información del producto */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Configuración disponible:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedProduct.config_disponible.tiene_medidas && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Medidas</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_cantidad && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Cantidad</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_material && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Material</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_tecnologia && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Tecnología</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_tintas && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Tintas</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_caras_impresion && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Caras de impresión</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_espesor && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Espesor</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_color && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Color</span>
                    </div>
                  )}
                  {selectedProduct.config_disponible.tiene_marca && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Marca</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          {selectedProduct && (
            <Button
              onClick={handleAgregar}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Agregando...' : 'Agregar Item'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
