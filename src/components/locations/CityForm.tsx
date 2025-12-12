import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { City, CityFormData } from '../../types/database';
import { useLocations } from '../../hooks/useLocations';

interface CityFormProps {
  city?: City;
  onSubmit: (data: CityFormData) => void | Promise<void>;
  onCancel: () => void;
}

export function CityForm({ city, onSubmit, onCancel }: CityFormProps) {
  const { countries, provinces, loading: loadingLocations, fetchProvinces } = useLocations();
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');

  const [formData, setFormData] = useState<CityFormData>({
    province_id: city?.province_id || '',
    name: city?.name || '',
    postal_code: city?.postal_code || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CityFormData, string>>>({});

  useEffect(() => {
    if (city?.province_id) {
      const province = provinces.find((p) => p.id === city.province_id);
      if (province) {
        setSelectedCountryId(province.country_id);
        fetchProvinces(province.country_id);
      }
    }
  }, [city, provinces, fetchProvinces]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CityFormData, string>> = {};

    if (!formData.province_id) {
      newErrors.province_id = 'La provincia es requerida';
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

  const handleCountryChange = (countryId: string) => {
    setSelectedCountryId(countryId);
    setFormData({ ...formData, province_id: '' });
    if (countryId) {
      fetchProvinces(countryId);
    }
  };

  const countryOptions = countries.map((country) => ({
    value: country.id,
    label: country.name,
  }));

  const provinceOptions = provinces
    .filter((province) => province.country_id === selectedCountryId)
    .map((province) => ({
      value: province.id,
      label: province.name,
    }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Select
          label="País"
          value={selectedCountryId}
          onChange={handleCountryChange}
          options={[
            { value: '', label: 'Seleccionar país...' },
            ...countryOptions,
          ]}
          required
          disabled={loadingLocations}
        />
      </div>

      <div>
        <Select
          label="Provincia/Estado"
          value={formData.province_id}
          onChange={(value) => setFormData({ ...formData, province_id: value })}
          options={[
            { value: '', label: selectedCountryId ? 'Seleccionar provincia...' : 'Primero seleccione un país' },
            ...provinceOptions,
          ]}
          error={errors.province_id}
          required
          disabled={!selectedCountryId || loadingLocations}
        />
      </div>

      <div>
        <Input
          label="Nombre de la Ciudad"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          placeholder="Buenos Aires"
        />
      </div>

      <div>
        <Input
          label="Código Postal (opcional)"
          value={formData.postal_code}
          onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
          placeholder="C1000"
          maxLength={10}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          {city ? 'Actualizar' : 'Crear'} Ciudad
        </Button>
      </div>
    </form>
  );
}
