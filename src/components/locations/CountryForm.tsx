import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Country, CountryFormData } from '../../types/database';

interface CountryFormProps {
  country?: Country;
  onSubmit: (data: CountryFormData) => void | Promise<void>;
  onCancel: () => void;
}

export function CountryForm({ country, onSubmit, onCancel }: CountryFormProps) {
  const [formData, setFormData] = useState<CountryFormData>({
    name: country?.name || '',
    iso_code: country?.iso_code || '',
    phone_code: country?.phone_code || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CountryFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CountryFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.iso_code.trim()) {
      newErrors.iso_code = 'El código ISO es requerido';
    } else if (formData.iso_code.trim().length !== 2) {
      newErrors.iso_code = 'El código ISO debe tener 2 caracteres';
    }

    if (!formData.phone_code.trim()) {
      newErrors.phone_code = 'El código telefónico es requerido';
    } else if (!formData.phone_code.startsWith('+')) {
      newErrors.phone_code = 'El código telefónico debe comenzar con +';
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Input
          label="Nombre del País"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          placeholder="Argentina"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Código ISO (2 letras)"
          value={formData.iso_code}
          onChange={(e) => setFormData({ ...formData, iso_code: e.target.value.toUpperCase() })}
          error={errors.iso_code}
          required
          placeholder="AR"
          maxLength={2}
        />

        <Input
          label="Código Telefónico"
          value={formData.phone_code}
          onChange={(e) => setFormData({ ...formData, phone_code: e.target.value })}
          error={errors.phone_code}
          required
          placeholder="+54"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          {country ? 'Actualizar' : 'Crear'} País
        </Button>
      </div>
    </form>
  );
}
