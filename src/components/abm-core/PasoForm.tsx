import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Paso, EtapaPaso } from '../../types/database';

interface PasoFormProps {
  paso?: Paso;
  onSubmit: (data: PasoFormData) => Promise<void>;
  onCancel: () => void;
}

export interface PasoFormData {
  nombre: string;
  etapa: EtapaPaso;
  estacion_id: string;
}

const ETAPAS: { value: EtapaPaso; label: string }[] = [
  { value: 'Pre-prensa', label: 'Pre-prensa' },
  { value: 'Produccion', label: 'Producción' },
  { value: 'Terminacion', label: 'Terminación' },
  { value: 'Instalacion', label: 'Instalación' },
  { value: 'Entrega', label: 'Entrega' },
];

export function PasoForm({ paso, onSubmit, onCancel }: PasoFormProps) {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estaciones, setEstaciones] = useState<{ value: string; label: string }[]>([]);

  const [formData, setFormData] = useState<PasoFormData>({
    nombre: paso?.nombre || '',
    etapa: paso?.etapa || 'Produccion',
    estacion_id: paso?.estacion_id || '',
  });

  useEffect(() => {
    const fetchEstaciones = async () => {
      if (!company) return;

      const { data, error } = await supabase
        .from('estaciones_trabajo')
        .select('id, nombre')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('nombre');

      if (error) {
        console.error('Error fetching estaciones:', error);
        return;
      }

      setEstaciones(data.map(e => ({ value: e.id, label: e.nombre })));
    };

    fetchEstaciones();
  }, [company]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.etapa) {
      newErrors.etapa = 'La etapa es requerida';
    }

    if (!formData.estacion_id) {
      newErrors.estacion_id = 'La estación es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Nombre del Paso"
          value={formData.nombre}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, nombre: e.target.value }));
            if (errors.nombre) {
              setErrors(prev => ({ ...prev, nombre: '' }));
            }
          }}
          error={errors.nombre}
          required
          placeholder="Ej: Diseño, Impresión, Corte, etc."
        />

        <Select
          label="Etapa"
          value={formData.etapa}
          onChange={(value) => {
            setFormData(prev => ({ ...prev, etapa: value as EtapaPaso }));
            if (errors.etapa) {
              setErrors(prev => ({ ...prev, etapa: '' }));
            }
          }}
          options={ETAPAS}
          error={errors.etapa}
          required
        />

        <SearchableSelect
          label="Estación de Trabajo"
          value={formData.estacion_id}
          onChange={(value) => {
            setFormData(prev => ({ ...prev, estacion_id: value }));
            if (errors.estacion_id) {
              setErrors(prev => ({ ...prev, estacion_id: '' }));
            }
          }}
          options={estaciones}
          placeholder="Seleccionar estación..."
          error={errors.estacion_id}
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {paso ? 'Actualizar Paso' : 'Crear Paso'}
        </Button>
      </div>
    </form>
  );
}
