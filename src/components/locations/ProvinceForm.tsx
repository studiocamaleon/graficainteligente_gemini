import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Province, ProvinceFormData } from '../../types/database';
import { useLocations } from '../../hooks/useLocations';

interface ProvinceFormProps {
  province?: Province;
  onSubmit: (data: ProvinceFormData) => void | Promise<void>;
  onCancel: () => void;
}

export function ProvinceForm({ province, onSubmit, onCancel }: ProvinceFormProps) {
  const { countries, loading: loadingCountries } = useLocations();

  const [formData, setFormData] = useState<ProvinceFormData>({
    country_id: province?.country_id || '',
    name: province?.name || '',
    code: province?.code || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ProvinceFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProvinceFormData, string>> = {};

    if (!formData.country_id) {
      newErrors.country_id = 'El país es requerido';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onSubmit(formData);
    }
  };

  const countryOptions = countries.map((country) => ({
    value: country.id,
    label: country.name,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Select
          label="País"
          value={formData.country_id}
          onChange={(value) => setFormData({ ...formData, country_id: value })}
          options={[
            { value: '', label: 'Seleccionar país...' },
            ...countryOptions,
          ]}
          error={errors.country_id}
          required
          disabled={loadingCountries}
        />
      </div>

      <div>
        <Input
          label="Nombre de la Provincia/Estado"
          value={formData.name}
          onChange={(value) => setFormData({ ...formData, name: value })}
          error={errors.name}
          required
          placeholder="Buenos Aires"
        />
      </div>

      <div>
        <Input
          label="Código (opcional)"
          value={formData.code}
          onChange={(value) => setFormData({ ...formData, code: value.toUpperCase() })}
          placeholder="BA"
          maxLength={10}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          {province ? 'Actualizar' : 'Crear'} Provincia
        </Button>
      </div>
    </form>
  );
}
