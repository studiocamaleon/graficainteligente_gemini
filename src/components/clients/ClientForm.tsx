import { useState, useEffect, FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import { useLocations } from '../../hooks/useLocations';
import type { Client, DocumentType, PaymentTerm } from '../../types/database';

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel: () => void;
}

export interface ClientFormData {
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: DocumentType;
  numero_documento: string;
  whatsapp: string;
  email: string;
  domicilio: string;
  country_id: string;
  province_id: string;
  city_id: string;
  codigo_postal: string;
  tiene_cuenta_corriente: boolean;
  acuerdo_pago: PaymentTerm | null;
  is_active: boolean;
}

const DOCUMENT_TYPES: DocumentType[] = ['DNI', 'CUIT', 'CUIL'];
const PAYMENT_TERMS: PaymentTerm[] = ['Semanal', 'Quincenal', 'Mensual'];

export function ClientForm({ client, onSubmit, onCancel }: ClientFormProps) {
  const { countries, provinces, cities, fetchProvinces, fetchCities } = useLocations();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ClientFormData>({
    nombre_fantasia: client?.nombre_fantasia || '',
    razon_social: client?.razon_social || '',
    tipo_documento: client?.tipo_documento || 'DNI',
    numero_documento: client?.numero_documento || '',
    whatsapp: client?.whatsapp || '',
    email: client?.email || '',
    domicilio: client?.domicilio || '',
    country_id: client?.country_id || '',
    province_id: client?.province_id || '',
    city_id: client?.city_id || '',
    codigo_postal: client?.codigo_postal || '',
    tiene_cuenta_corriente: client?.tiene_cuenta_corriente || false,
    acuerdo_pago: client?.acuerdo_pago || null,
    is_active: client?.is_active ?? true,
  });

  useEffect(() => {
    if (formData.country_id) {
      fetchProvinces(formData.country_id);
    }
  }, [formData.country_id]);

  useEffect(() => {
    if (formData.province_id) {
      fetchCities(formData.province_id);
    }
  }, [formData.province_id]);

  const formatWhatsApp = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('549')) {
      return cleaned;
    }
    if (cleaned.startsWith('54')) {
      return '549' + cleaned.substring(2);
    }
    if (cleaned.startsWith('15')) {
      return '549' + cleaned.substring(2);
    }
    if (cleaned.startsWith('0')) {
      return '549' + cleaned.substring(1);
    }
    if (cleaned.length > 0) {
      return '549' + cleaned;
    }
    return cleaned;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre_fantasia.trim()) {
      newErrors.nombre_fantasia = 'El nombre de fantasía es requerido';
    }

    if (!formData.razon_social.trim()) {
      newErrors.razon_social = 'La razón social es requerida';
    }

    if (!formData.numero_documento.trim()) {
      newErrors.numero_documento = 'El número de documento es requerido';
    } else {
      const doc = formData.numero_documento.replace(/\D/g, '');
      if (formData.tipo_documento === 'DNI' && (doc.length < 7 || doc.length > 8)) {
        newErrors.numero_documento = 'El DNI debe tener 7 u 8 dígitos';
      }
      if (formData.tipo_documento === 'CUIT' && doc.length !== 11) {
        newErrors.numero_documento = 'El CUIT debe tener 11 dígitos';
      }
      if (formData.tipo_documento === 'CUIL' && doc.length !== 11) {
        newErrors.numero_documento = 'El CUIL debe tener 11 dígitos';
      }
    }

    if (formData.whatsapp && formData.whatsapp.length < 12) {
      newErrors.whatsapp = 'Formato de WhatsApp inválido';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.tiene_cuenta_corriente && !formData.acuerdo_pago) {
      newErrors.acuerdo_pago = 'Debe seleccionar un acuerdo de pago';
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

  const handleChange = (field: keyof ClientFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Fiscal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre de Fantasía"
            value={formData.nombre_fantasia}
            onChange={(e) => handleChange('nombre_fantasia', e.target.value)}
            error={errors.nombre_fantasia}
            required
          />

          <Input
            label="Razón Social"
            value={formData.razon_social}
            onChange={(e) => handleChange('razon_social', e.target.value)}
            error={errors.razon_social}
            required
          />

          <Select
            label="Tipo de Documento"
            value={formData.tipo_documento}
            onChange={(value) => handleChange('tipo_documento', value as DocumentType)}
            options={DOCUMENT_TYPES.map(type => ({ value: type, label: type }))}
            required
          />

          <Input
            label="Número de Documento"
            value={formData.numero_documento}
            onChange={(e) => handleChange('numero_documento', e.target.value)}
            error={errors.numero_documento}
            required
          />

          <Input
            label="WhatsApp"
            value={formData.whatsapp}
            onChange={(e) => handleChange('whatsapp', formatWhatsApp(e.target.value))}
            error={errors.whatsapp}
            helperText="Se guardará en formato internacional: 549XXXXXXXXX"
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
          />
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubicación</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Domicilio"
              value={formData.domicilio}
              onChange={(e) => handleChange('domicilio', e.target.value)}
            />
          </div>

          <Select
            label="País"
            value={formData.country_id}
            onChange={(value) => {
              handleChange('country_id', value);
              handleChange('province_id', '');
              handleChange('city_id', '');
            }}
            options={countries.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Seleccione un país"
          />

          <Select
            label="Provincia"
            value={formData.province_id}
            onChange={(value) => {
              handleChange('province_id', value);
              handleChange('city_id', '');
            }}
            options={provinces.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Seleccione una provincia"
            disabled={!formData.country_id}
          />

          <Select
            label="Ciudad"
            value={formData.city_id}
            onChange={(value) => handleChange('city_id', value)}
            options={cities.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Seleccione una ciudad"
            disabled={!formData.province_id}
          />

          <Input
            label="Código Postal"
            value={formData.codigo_postal}
            onChange={(e) => handleChange('codigo_postal', e.target.value)}
          />
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cuenta Corriente</h3>
        <div className="space-y-4">
          <Switch
            checked={formData.tiene_cuenta_corriente}
            onChange={(checked) => {
              handleChange('tiene_cuenta_corriente', checked);
              if (!checked) {
                handleChange('acuerdo_pago', null);
              }
            }}
            label="¿Tiene cuenta corriente?"
          />

          {formData.tiene_cuenta_corriente && (
            <Select
              label="Acuerdo de Pago"
              value={formData.acuerdo_pago || ''}
              onChange={(value) => handleChange('acuerdo_pago', value as PaymentTerm)}
              options={PAYMENT_TERMS.map(term => ({ value: term, label: term }))}
              placeholder="Seleccione un acuerdo"
              error={errors.acuerdo_pago}
              required
            />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {client ? 'Actualizar Cliente' : 'Crear Cliente'}
        </Button>
      </div>
    </form>
  );
}
