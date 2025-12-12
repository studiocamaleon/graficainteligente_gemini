import { useState, useEffect, FormEvent } from 'react';
import { Calendar, Info } from 'lucide-react';
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
  country_id: string | null;
  province_id: string | null;
  city_id: string | null;
  codigo_postal: string;
  tiene_cuenta_corriente: boolean;
  acuerdo_pago: PaymentTerm | null;
  dia_cierre_semanal: number | null;
  dia_cierre_mensual: number | null;
  usa_ultimo_dia_mes: boolean;
  dias_vencimiento: number;
  is_active: boolean;
  app_pin?: string;
}

const DOCUMENT_TYPES: DocumentType[] = ['DNI', 'CUIT', 'CUIL'];
const PAYMENT_TERMS: PaymentTerm[] = ['Semanal', 'Quincenal', 'Mensual'];
const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const getNombreDia = (dia: number | null): string => {
  if (!dia) return '';
  const diaInfo = DIAS_SEMANA.find(d => d.value === dia);
  return diaInfo?.label || '';
};

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
    country_id: client?.country_id || null,
    province_id: client?.province_id || null,
    city_id: client?.city_id || null,
    codigo_postal: client?.codigo_postal || '',
    tiene_cuenta_corriente: client?.tiene_cuenta_corriente || false,
    acuerdo_pago: client?.acuerdo_pago || null,
    dia_cierre_semanal: client?.dia_cierre_semanal || null,
    dia_cierre_mensual: client?.dia_cierre_mensual || null,
    usa_ultimo_dia_mes: client?.usa_ultimo_dia_mes || false,
    dias_vencimiento: client?.dias_vencimiento || 7,
    is_active: client?.is_active ?? true,
    app_pin: client?.app_pin || '',
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

    if (formData.app_pin && !/^\d{4}$/.test(formData.app_pin)) {
      newErrors.app_pin = 'El PIN debe ser de 4 dígitos';
    }

    if (formData.tiene_cuenta_corriente && !formData.acuerdo_pago) {
      newErrors.acuerdo_pago = 'Debe seleccionar un acuerdo de pago';
    }

    if (formData.tiene_cuenta_corriente && formData.acuerdo_pago === 'Semanal' && !formData.dia_cierre_semanal) {
      newErrors.dia_cierre_semanal = 'Debe seleccionar el día de cierre semanal';
    }

    if (formData.tiene_cuenta_corriente && formData.acuerdo_pago === 'Mensual') {
      if (!formData.usa_ultimo_dia_mes && !formData.dia_cierre_mensual) {
        newErrors.dia_cierre_mensual = 'Debe configurar el día de cierre o seleccionar último día del mes';
      }
      if (formData.dia_cierre_mensual && (formData.dia_cierre_mensual < 1 || formData.dia_cierre_mensual > 28)) {
        newErrors.dia_cierre_mensual = 'El día debe estar entre 1 y 28';
      }
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
            error={errors.email}
          />

          <Input
            label="PIN de App (Opcional)"
            value={formData.app_pin || ''}
            onChange={(e) => handleChange('app_pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
            error={errors.app_pin}
            helperText="4 dígitos numéricos para acceso a la App de invitados"
            maxLength={4}
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
            value={formData.country_id || ''}
            onChange={(value) => {
              handleChange('country_id', value || null);
              handleChange('province_id', null);
              handleChange('city_id', null);
            }}
            options={countries.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Seleccione un país"
          />

          <Select
            label="Provincia"
            value={formData.province_id || ''}
            onChange={(value) => {
              handleChange('province_id', value || null);
              handleChange('city_id', null);
            }}
            options={provinces.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Seleccione una provincia"
            disabled={!formData.country_id}
          />

          <Select
            label="Ciudad"
            value={formData.city_id || ''}
            onChange={(value) => handleChange('city_id', value || null)}
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
                handleChange('dia_cierre_semanal', null);
                handleChange('dia_cierre_mensual', null);
                handleChange('usa_ultimo_dia_mes', false);
              }
            }}
            label="¿Tiene cuenta corriente?"
          />

          {formData.tiene_cuenta_corriente && (
            <div className="space-y-4 ml-0">
              <Select
                label="Acuerdo de Pago"
                value={formData.acuerdo_pago || ''}
                onChange={(value) => {
                  handleChange('acuerdo_pago', value as PaymentTerm);
                  handleChange('dia_cierre_semanal', null);
                  handleChange('dia_cierre_mensual', null);
                  handleChange('usa_ultimo_dia_mes', false);
                }}
                options={PAYMENT_TERMS.map(term => ({ value: term, label: term }))}
                placeholder="Seleccione un acuerdo"
                error={errors.acuerdo_pago}
                required
              />

              {formData.acuerdo_pago === 'Semanal' && (
                <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200">
                  <Select
                    label="Día de cierre semanal"
                    value={formData.dia_cierre_semanal?.toString() || ''}
                    onChange={(value) => handleChange('dia_cierre_semanal', parseInt(value))}
                    options={DIAS_SEMANA}
                    placeholder="Seleccione el día"
                    error={errors.dia_cierre_semanal}
                    required
                  />
                  {formData.dia_cierre_semanal && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                      <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Se generará una liquidación cada semana</p>
                        <p className="text-blue-600 mt-1">
                          Todas las órdenes completadas hasta el {getNombreDia(formData.dia_cierre_semanal)} serán incluidas en la liquidación.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.acuerdo_pago === 'Quincenal' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700">
                      <p className="font-semibold mb-2">Períodos de liquidación automáticos:</p>
                      <ul className="space-y-1 ml-4 list-disc">
                        <li>Del 1 al 15 de cada mes</li>
                        <li>Del 16 al último día del mes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {formData.acuerdo_pago === 'Mensual' && (
                <div className="space-y-3 bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.usa_ultimo_dia_mes}
                      onChange={(checked) => {
                        handleChange('usa_ultimo_dia_mes', checked);
                        if (checked) {
                          handleChange('dia_cierre_mensual', null);
                        }
                      }}
                      label="Cierre el último día del mes"
                    />
                  </div>

                  {!formData.usa_ultimo_dia_mes && (
                    <Input
                      type="number"
                      min="1"
                      max="28"
                      label="Día de cierre mensual"
                      value={formData.dia_cierre_mensual?.toString() || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null;
                        handleChange('dia_cierre_mensual', value);
                      }}
                      helperText="Del 1 al 28 (para evitar problemas con febrero)"
                      error={errors.dia_cierre_mensual}
                      required
                    />
                  )}

                  {(formData.usa_ultimo_dia_mes || formData.dia_cierre_mensual) && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                      <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Liquidación mensual</p>
                        <p className="text-blue-600 mt-1">
                          {formData.usa_ultimo_dia_mes
                            ? 'Se liquidará el último día de cada mes (28, 29, 30 o 31 según el mes)'
                            : `Se liquidará el día ${formData.dia_cierre_mensual} de cada mes`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.acuerdo_pago && (
                <Input
                  type="number"
                  min="0"
                  max="90"
                  label="Días de vencimiento"
                  value={formData.dias_vencimiento.toString()}
                  onChange={(e) => handleChange('dias_vencimiento', parseInt(e.target.value) || 7)}
                  helperText="Días después del cierre en que vence la liquidación"
                />
              )}
            </div>
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
