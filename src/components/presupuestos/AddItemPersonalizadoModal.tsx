import { useState, useEffect } from 'react';
import { X, DollarSign, Package, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface AddItemPersonalizadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final: number;
    tiempo_produccion_dias?: number;
  }) => void;
}

export function AddItemPersonalizadoModal({
  isOpen,
  onClose,
  onAdd,
}: AddItemPersonalizadoModalProps) {
  const [formData, setFormData] = useState({
    producto_nombre: '',
    descripcion: '',
    cantidad: 1,
    precio_unitario_final: 0,
    tiempo_produccion_dias: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form cuando se abre
      setFormData({
        producto_nombre: '',
        descripcion: '',
        cantidad: 1,
        precio_unitario_final: 0,
        tiempo_produccion_dias: 0,
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.producto_nombre.trim()) {
      newErrors.producto_nombre = 'El nombre es requerido';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    }

    if (formData.cantidad <= 0) {
      newErrors.cantidad = 'La cantidad debe ser mayor a 0';
    }

    if (formData.precio_unitario_final <= 0) {
      newErrors.precio_unitario_final = 'El precio debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onAdd({
      ...formData,
      tiempo_produccion_dias:
        formData.tiempo_produccion_dias > 0
          ? formData.tiempo_produccion_dias
          : undefined,
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      producto_nombre: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario_final: 0,
      tiempo_produccion_dias: 0,
    });
    setErrors({});
    onClose();
  };

  const calcularTotal = () => {
    return formData.cantidad * formData.precio_unitario_final;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Agregar Item Personalizado"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            Los items personalizados son productos o servicios que no están en tu
            catálogo. Deberás ingresar manualmente el precio y la descripción.
          </p>
        </div>

        {/* Nombre del producto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Producto/Servicio *
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={formData.producto_nombre}
              onChange={(e) =>
                setFormData({ ...formData, producto_nombre: e.target.value })
              }
              placeholder="Ej: Banner personalizado, Diseño de logo, etc."
              className="pl-10"
              error={errors.producto_nombre}
            />
          </div>
          {errors.producto_nombre && (
            <p className="mt-1 text-sm text-red-600">{errors.producto_nombre}</p>
          )}
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción *
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <textarea
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
              placeholder="Describe las características, medidas, materiales, etc."
              rows={4}
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                errors.descripcion ? 'border-red-300' : 'border-gray-300'
              }`}
            />
          </div>
          {errors.descripcion && (
            <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.descripcion.length} caracteres
          </p>
        </div>

        {/* Cantidad y Precio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad *
            </label>
            <Input
              type="number"
              value={formData.cantidad}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cantidad: parseInt(e.target.value) || 0,
                })
              }
              min={1}
              error={errors.cantidad}
            />
            {errors.cantidad && (
              <p className="mt-1 text-sm text-red-600">{errors.cantidad}</p>
            )}
          </div>

          {/* Precio unitario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio Unitario *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="number"
                value={formData.precio_unitario_final}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    precio_unitario_final: parseFloat(e.target.value) || 0,
                  })
                }
                min={0}
                step={0.01}
                className="pl-10"
                error={errors.precio_unitario_final}
              />
            </div>
            {errors.precio_unitario_final && (
              <p className="mt-1 text-sm text-red-600">
                {errors.precio_unitario_final}
              </p>
            )}
          </div>
        </div>

        {/* Tiempo de producción (opcional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tiempo de Producción (días)
          </label>
          <Input
            type="number"
            value={formData.tiempo_produccion_dias}
            onChange={(e) =>
              setFormData({
                ...formData,
                tiempo_produccion_dias: parseInt(e.target.value) || 0,
              })
            }
            min={0}
            placeholder="0"
          />
          <p className="mt-1 text-xs text-gray-500">
            Opcional. Días estimados para producir este item.
          </p>
        </div>

        {/* Total */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Total del Item:
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {formatCurrency(calcularTotal())}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit">Agregar Item</Button>
        </div>
      </form>
    </Modal>
  );
}
