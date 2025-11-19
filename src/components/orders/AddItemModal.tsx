import { useState } from 'react';
import { X, Package } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';

interface AddItemModalProps {
  onClose: () => void;
  onAgregar: (item: any) => void;
}

export function AddItemModal({ onClose, onAgregar }: AddItemModalProps) {
  const [cantidad, setCantidad] = useState(1);

  const handleAgregar = () => {
    const nuevoItem = {
      producto_id: 'temp-producto',
      producto_nombre: 'Producto de Ejemplo',
      cantidad,
      configuracion: {
        tecnologia: 'Láser',
        material: 'Papel Bond',
        medidas: { ancho: 21, alto: 29.7 },
        caras_impresas: '1/0',
      },
      precio_base: 100,
      precio_servicios: 20,
      precio_acabados: 10,
      precio_unitario_final: 130,
      precio_total: 130 * cantidad,
    };

    onAgregar(nuevoItem);
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Agregar Item</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <EmptyState
          icon={Package}
          title="Wizard en Desarrollo"
          description="El wizard completo para configurar productos estará disponible próximamente. Por ahora, puedes agregar un item de ejemplo para probar la funcionalidad de la orden."
          action={
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad
                </label>
                <Input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                  className="w-32"
                />
              </div>

              <div className="flex items-center space-x-3">
                <Button onClick={handleAgregar} className="bg-blue-600 hover:bg-blue-700">
                  Agregar Item de Ejemplo
                </Button>
                <Button variant="secondary" onClick={onClose}>
                  Cancelar
                </Button>
              </div>
            </div>
          }
        />
      </div>
    </Modal>
  );
}
