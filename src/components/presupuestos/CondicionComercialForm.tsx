import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import type {
  CondicionComercial,
  CreateCondicionComercialData,
  UpdateCondicionComercialData,
} from '../../types/presupuestos';

interface CondicionComercialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCondicionComercialData | UpdateCondicionComercialData) => Promise<void>;
  condicion?: CondicionComercial | null;
  isLoading?: boolean;
}

export function CondicionComercialForm({
  isOpen,
  onClose,
  onSubmit,
  condicion,
  isLoading = false,
}: CondicionComercialFormProps) {
  const [formData, setFormData] = useState({
    nombre: '',
    contenido: '',
    es_default: false,
    is_active: true,
    orden: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (condicion) {
      setFormData({
        nombre: condicion.nombre,
        contenido: condicion.contenido,
        es_default: condicion.es_default,
        is_active: condicion.is_active,
        orden: condicion.orden,
      });
    } else {
      setFormData({
        nombre: '',
        contenido: '',
        es_default: false,
        is_active: true,
        orden: 0,
      });
    }
    setErrors({});
  }, [condicion, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.contenido.trim()) {
      newErrors.contenido = 'El contenido es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleClose = () => {
    setFormData({
      nombre: '',
      contenido: '',
      es_default: false,
      is_active: true,
      orden: 0,
    });
    setErrors({});
    onClose();
  };

  const templateExamples = [
    {
      name: 'Condiciones Estándar',
      content: `CONDICIONES COMERCIALES

1. Validez de la oferta: 15 días corridos desde la fecha de emisión.

2. Forma de pago: 50% de seña al momento de confirmar, saldo contra entrega.

3. Plazo de entrega: A confirmar según disponibilidad de materiales.

4. Garantía: Los trabajos tienen garantía de 30 días por defectos de fabricación.

5. El presupuesto no incluye diseño ni maquetación de archivos.

6. Los archivos deben ser entregados en formato PDF de alta calidad.

7. Una vez iniciado el trabajo, no se aceptan cancelaciones.

8. Los colores pueden variar levemente respecto a los visualizados en pantalla.`,
    },
    {
      name: 'Condiciones Básicas',
      content: `- Validez: 10 días
- Pago: 50% seña + 50% contra entrega
- Plazo de entrega: Según disponibilidad
- Garantía: 30 días por defectos de fabricación
- No incluye diseño
- Archivos: PDF de alta calidad`,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={condicion ? 'Editar Condición Comercial' : 'Nueva Condición Comercial'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Template *
          </label>
          <Input
            value={formData.nombre}
            onChange={(e) =>
              setFormData({ ...formData, nombre: e.target.value })
            }
            placeholder="Ej: Condiciones Estándar, Condiciones VIP, etc."
            error={errors.nombre}
            disabled={isLoading}
          />
          {errors.nombre && (
            <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
          )}
        </div>

        {/* Contenido */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Contenido *
            </label>
            <div className="text-xs text-gray-500">
              {formData.contenido.length} caracteres
            </div>
          </div>
          <textarea
            value={formData.contenido}
            onChange={(e) =>
              setFormData({ ...formData, contenido: e.target.value })
            }
            placeholder="Escribe las condiciones comerciales que se mostrarán en los presupuestos..."
            rows={12}
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm ${
              errors.contenido
                ? 'border-red-300'
                : 'border-gray-300'
            }`}
          />
          {errors.contenido && (
            <p className="mt-1 text-sm text-red-600">{errors.contenido}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Puedes usar saltos de línea y formato básico de texto
          </p>
        </div>

        {/* Templates de ejemplo */}
        {!condicion && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">
              Templates de ejemplo:
            </p>
            <div className="space-y-2">
              {templateExamples.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      nombre: template.name,
                      contenido: template.content,
                    })
                  }
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Usar "{template.name}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Opciones */}
        <div className="space-y-4 bg-gray-50 rounded-lg p-4">
          {/* Es default */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Marcar como predeterminada
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Se seleccionará automáticamente al crear nuevos presupuestos
              </p>
            </div>
            <Switch
              checked={formData.es_default}
              onChange={(checked) =>
                setFormData({ ...formData, es_default: checked })
              }
              disabled={isLoading}
            />
          </div>

          {/* Es activa */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Condición activa
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Solo las condiciones activas aparecerán en el selector
              </p>
            </div>
            <Switch
              checked={formData.is_active}
              onChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
              disabled={isLoading}
            />
          </div>

          {/* Orden */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Orden de visualización
            </label>
            <Input
              type="number"
              value={formData.orden}
              onChange={(e) =>
                setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })
              }
              placeholder="0"
              disabled={isLoading}
              min={0}
            />
            <p className="mt-1 text-xs text-gray-500">
              Las condiciones se ordenarán de menor a mayor
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {condicion ? 'Actualizar' : 'Crear'} Condición
          </Button>
        </div>
      </form>
    </Modal>
  );
}
