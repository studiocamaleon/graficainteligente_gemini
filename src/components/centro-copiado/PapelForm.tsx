import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { useMateriales } from '../../hooks/useMateriales';
import type { CentroCopiadoPapelFormData } from '../../types/database';

interface PapelFormProps {
  onSubmit: (data: CentroCopiadoPapelFormData) => Promise<void>;
  onCancel: () => void;
}

export function PapelForm({ onSubmit, onCancel }: PapelFormProps) {
  const { materiales, loading: loadingMateriales } = useMateriales();
  const [formData, setFormData] = useState<CentroCopiadoPapelFormData>({
    material_id: '',
    variante_nombre: '',
    espesor: null,
    unidad_espesor: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variantesDisponibles, setVariantesDisponibles] = useState<string[]>([]);
  const [espesoresDisponibles, setEspesoresDisponibles] = useState<number[]>([]);

  const selectedMaterial = materiales.find(m => m.id === formData.material_id);

  useEffect(() => {
    if (selectedMaterial) {
      const variantes = selectedMaterial.variantes as any[];
      setVariantesDisponibles(variantes.map(v => v.nombre));
      setFormData(prev => ({ ...prev, variante_nombre: '', espesor: null }));
    }
  }, [selectedMaterial]);

  useEffect(() => {
    if (selectedMaterial && formData.variante_nombre) {
      const variantes = selectedMaterial.variantes as any[];
      const variante = variantes.find(v => v.nombre === formData.variante_nombre);
      if (variante && variante.espesores) {
        setEspesoresDisponibles(variante.espesores);
        setFormData(prev => ({
          ...prev,
          unidad_espesor: selectedMaterial.unidad_espesor,
          espesor: null
        }));
      }
    }
  }, [formData.variante_nombre, selectedMaterial]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.material_id) {
      newErrors.material_id = 'Selecciona un material';
    }

    if (!formData.variante_nombre) {
      newErrors.variante_nombre = 'Selecciona una variante';
    }

    if (selectedMaterial?.aplica_espesor && !formData.espesor) {
      newErrors.espesor = 'Selecciona un espesor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Material"
        value={formData.material_id}
        onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
        error={errors.material_id}
        required
        disabled={loadingMateriales}
      >
        <option value="">Seleccionar material...</option>
        {materiales.map((material) => (
          <option key={material.id} value={material.id}>
            {material.nombre}
          </option>
        ))}
      </Select>

      {formData.material_id && (
        <Select
          label="Variante"
          value={formData.variante_nombre}
          onChange={(e) => setFormData({ ...formData, variante_nombre: e.target.value })}
          error={errors.variante_nombre}
          required
        >
          <option value="">Seleccionar variante...</option>
          {variantesDisponibles.map((variante) => (
            <option key={variante} value={variante}>
              {variante}
            </option>
          ))}
        </Select>
      )}

      {selectedMaterial?.aplica_espesor && formData.variante_nombre && espesoresDisponibles.length > 0 && (
        <Select
          label={`Espesor (${selectedMaterial.unidad_espesor})`}
          value={formData.espesor?.toString() || ''}
          onChange={(e) => setFormData({ ...formData, espesor: parseFloat(e.target.value) || null })}
          error={errors.espesor}
          required
        >
          <option value="">Seleccionar espesor...</option>
          {espesoresDisponibles.map((espesor) => (
            <option key={espesor} value={espesor}>
              {espesor} {selectedMaterial.unidad_espesor}
            </option>
          ))}
        </Select>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Agregando...' : 'Agregar Papel'}
        </Button>
      </div>
    </form>
  );
}
