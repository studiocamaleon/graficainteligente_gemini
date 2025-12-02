import { useState, useEffect } from 'react';
import { X, Route, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { usePasos } from '../../hooks/usePasos';
import { useAuth } from '../../hooks/useAuth';

interface AddPasoManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (paso: {
    etapa: string;
    paso_id: string;
    paso_nombre: string;
    orden: number;
  }) => void;
  itemNombre: string;
  currentStepsCount: number;
}

export function AddPasoManualModal({
  isOpen,
  onClose,
  onAdd,
  itemNombre,
  currentStepsCount,
}: AddPasoManualModalProps) {
  const { profile } = useAuth();
  const { pasos, loading: loadingPasos } = usePasos({ page: 1, itemsPerPage: 1000 });

  const [formData, setFormData] = useState({
    etapa: 'principal',
    paso_id: '',
    orden: currentStepsCount,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        etapa: 'principal',
        paso_id: '',
        orden: currentStepsCount,
      });
      setErrors({});
    }
  }, [isOpen, currentStepsCount]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.etapa) {
      newErrors.etapa = 'Selecciona una etapa';
    }

    if (!formData.paso_id) {
      newErrors.paso_id = 'Selecciona un paso';
    }

    if (formData.orden < 0) {
      newErrors.orden = 'El orden debe ser mayor o igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const pasoSeleccionado = pasos.find((p) => p.id === formData.paso_id);
    if (!pasoSeleccionado) return;

    onAdd({
      etapa: formData.etapa,
      paso_id: formData.paso_id,
      paso_nombre: pasoSeleccionado.nombre,
      orden: formData.orden,
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      etapa: 'principal',
      paso_id: '',
      orden: currentStepsCount,
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  // Filtrar pasos por etapa seleccionada si es necesario
  const pasosDisponibles = pasos.filter((p) => p.is_active);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Agregar Paso de Producción Manual"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Advertencia */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Route className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Configuración manual de ruta para: {itemNombre}
              </p>
              <p className="text-sm text-blue-700">
                Este paso se agregará a la ruta de producción del item personalizado.
                Puedes agregar múltiples pasos según sea necesario.
              </p>
            </div>
          </div>
        </div>

        {/* Etapa */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Etapa de Producción *
          </label>
          <Select
            value={formData.etapa}
            onChange={(value) => setFormData({ ...formData, etapa: value })}
            error={errors.etapa}
          >
            <option value="">Selecciona una etapa...</option>
            <option value="pre_prensa">Pre-prensa (Diseño, Revisión)</option>
            <option value="principal">Principal (Producción, Impresión)</option>
            <option value="post_prensa">Terminación (Acabados, Corte)</option>
            <option value="instalacion">Instalación</option>
          </Select>
          {errors.etapa && (
            <p className="mt-1 text-sm text-red-600">{errors.etapa}</p>
          )}
        </div>

        {/* Paso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paso de Producción *
          </label>
          <Select
            value={formData.paso_id}
            onChange={(value) => setFormData({ ...formData, paso_id: value })}
            error={errors.paso_id}
            disabled={loadingPasos}
          >
            <option value="">
              {loadingPasos ? 'Cargando pasos...' : 'Selecciona un paso...'}
            </option>
            {pasosDisponibles.map((paso) => (
              <option key={paso.id} value={paso.id}>
                {paso.nombre} ({paso.etapa})
              </option>
            ))}
          </Select>
          {errors.paso_id && (
            <p className="mt-1 text-sm text-red-600">{errors.paso_id}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {pasosDisponibles.length} pasos disponibles
          </p>
        </div>

        {/* Orden */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Orden de Ejecución
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={formData.orden}
            onChange={(e) =>
              setFormData({ ...formData, orden: Number(e.target.value) })
            }
            error={errors.orden}
          />
          {errors.orden && (
            <p className="mt-1 text-sm text-red-600">{errors.orden}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            El orden determina la secuencia de ejecución de los pasos
          </p>
        </div>

        {/* Advertencia sobre guardado */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              Los pasos manuales se guardarán al crear la orden. Asegúrate de configurar
              todos los pasos necesarios antes de guardar.
            </p>
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loadingPasos}>
            Agregar Paso
          </Button>
        </div>
      </form>
    </Modal>
  );
}
