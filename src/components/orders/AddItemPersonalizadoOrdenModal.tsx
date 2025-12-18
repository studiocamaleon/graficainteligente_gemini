import { useState, useEffect } from 'react';
import { X, DollarSign, Package, FileText, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface AddItemPersonalizadoOrdenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final: number | null;
    tiempo_produccion_dias?: number;
  }) => void;
  initialData?: any;
  isEditing?: boolean;
  mode?: 'orden' | 'presupuesto';
}

export function AddItemPersonalizadoOrdenModal({
  isOpen,
  onClose,
  onAdd,
  initialData,
  isEditing = false,
  mode = 'orden',
}: AddItemPersonalizadoOrdenModalProps) {
  const [formData, setFormData] = useState({
    producto_nombre: '',
    descripcion: '',
    cantidad: 1,
    precio_unitario_final: 0,
    tiempo_produccion_dias: 0,
  });

  const [cotizarDespues, setCotizarDespues] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    console.log('[PersonalizadoModal] isOpen:', isOpen, 'initialData:', initialData, 'isEditing:', isEditing);
    if (isOpen) {
      if (initialData && isEditing) {
        console.log('[PersonalizadoModal] Hydrating...');
        setFormData({
          producto_nombre: initialData.producto_nombre || '',
          descripcion: initialData.descripcion || '',
          cantidad: initialData.cantidad || 1,
          precio_unitario_final: initialData.precio_unitario_final || 0,
          tiempo_produccion_dias: initialData.tiempo_produccion_dias || 0,
        });
        setCotizarDespues(initialData.precio_unitario_final === null);
      } else {
        console.log('[PersonalizadoModal] Resetting form');
        setFormData({
          producto_nombre: '',
          descripcion: '',
          cantidad: 1,
          precio_unitario_final: 0,
          tiempo_produccion_dias: 0,
        });
        setCotizarDespues(false);
      }
      setErrors({});
    }
  }, [isOpen, initialData, isEditing]);

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

    // Solo validar precio si NO está marcado "Cotizar después"
    if (!cotizarDespues && formData.precio_unitario_final <= 0) {
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
      precio_unitario_final: cotizarDespues ? null : formData.precio_unitario_final,
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
    setCotizarDespues(false);
    setErrors({});
    onClose();
  };

  const calcularTotal = () => {
    return formData.cantidad * formData.precio_unitario_final;
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Editar Item Personalizado" : "Agregar Item Personalizado"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Advertencia importante */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 mb-1">
                Importante: Configuración de Ruta de Producción
              </p>
              <p className="text-sm text-yellow-700">
                Los items personalizados no tienen ruta de producción automática.
                Después de agregar este item, deberás ir a la pestaña{' '}
                <span className="font-semibold">"Rutas de Producción"</span> y
                configurar manualmente los pasos de producción.
              </p>
            </div>
          </div>
        </div>

        {/* Nombre del producto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción *
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <textarea
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
              placeholder="Describe las características, especificaciones o detalles del item..."
              rows={4}
              className={`
                w-full pl-10 pr-3 py-2 border rounded-lg
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${errors.descripcion ? 'border-red-300' : 'border-gray-300'}
              `}
            />
          </div>
          {errors.descripcion && (
            <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
          )}
        </div>

        {/* Cantidad y Precio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad *
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={formData.cantidad}
              onChange={(e) =>
                setFormData({ ...formData, cantidad: Number(e.target.value) })
              }
              error={errors.cantidad}
            />
            {errors.cantidad && (
              <p className="mt-1 text-sm text-red-600">{errors.cantidad}</p>
            )}
          </div>

          {/* Opción Cotizar Después (Solo Presupuesto) */}
          {mode === 'presupuesto' && (
            <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cotizarDespues}
                  onChange={(e) => setCotizarDespues(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Cotizar después</span>
                  <p className="text-xs text-gray-600">El precio quedará pendiente de definición.</p>
                </div>
              </label>
            </div>
          )}

          {!cotizarDespues && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Unitario *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.precio_unitario_final}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      precio_unitario_final: Number(e.target.value),
                    })
                  }
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
          )}
        </div>

        {/* Tiempo de producción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tiempo Estimado de Producción (días)
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={formData.tiempo_produccion_dias}
            onChange={(e) =>
              setFormData({
                ...formData,
                tiempo_produccion_dias: Number(e.target.value),
              })
            }
            placeholder="Opcional"
          />
          <p className="mt-1 text-xs text-gray-500">
            Ayuda a estimar la fecha de entrega
          </p>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Total:</span>
            <span className="text-xl font-bold text-gray-900">
              {cotizarDespues ? (
                <span className="text-yellow-600 text-base">Pendiente de Cotización</span>
              ) : (
                `$${calcularTotal().toFixed(2)}`
              )}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? 'Guardar Cambios' : 'Agregar Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}
