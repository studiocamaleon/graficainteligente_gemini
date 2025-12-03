import { useState } from 'react';
import { DollarSign, Package, Hash } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ItemPendienteCotizacion } from '../../types/presupuestos';

interface AsignarPrecioModalProps {
  item: ItemPendienteCotizacion;
  onAsignar: (itemId: string, precioUnitario: number) => Promise<boolean>;
  onClose: () => void;
}

export function AsignarPrecioModal({
  item,
  onAsignar,
  onClose,
}: AsignarPrecioModalProps) {
  const [precioUnitario, setPrecioUnitario] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const precioTotal = precioUnitario
    ? (parseFloat(precioUnitario) * item.cantidad).toFixed(2)
    : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const precio = parseFloat(precioUnitario);
    if (isNaN(precio) || precio <= 0) {
      setError('Ingresa un precio válido mayor a 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await onAsignar(item.id, precio);
      if (success) {
        onClose();
      } else {
        setError('Error al asignar precio. Intenta nuevamente.');
      }
    } catch (err) {
      setError('Error inesperado al asignar precio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Asignar Precio"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información del item */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Producto</p>
              <p className="text-base font-semibold text-gray-900">
                {item.producto_nombre}
              </p>
            </div>
          </div>

          {item.descripcion && (
            <div className="flex items-start gap-3">
              <div className="w-5 h-5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Descripción</p>
                <p className="text-sm text-gray-600">{item.descripcion}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Cantidad</p>
              <p className="text-base font-semibold text-gray-900">
                {item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'}
              </p>
            </div>
          </div>
        </div>

        {/* Input de precio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Unitario
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign className="w-5 h-5 text-gray-400" />
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={precioUnitario}
              onChange={(e) => {
                setPrecioUnitario(e.target.value);
                setError(null);
              }}
              className="pl-10"
              placeholder="0.00"
              required
              autoFocus
            />
          </div>
        </div>

        {/* Cálculo de precio total */}
        {precioUnitario && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                Precio Total
              </span>
              <span className="text-lg font-bold text-blue-900">
                ${precioTotal}
              </span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              {item.cantidad} × ${parseFloat(precioUnitario).toFixed(2)}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !precioUnitario}>
            {loading ? 'Asignando...' : 'Asignar Precio'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
