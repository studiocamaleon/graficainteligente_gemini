import { useState, FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import type { Caja } from '../../types/medios-cobro';

interface CajaFormProps {
  caja?: Caja;
  onSubmit: (data: CajaFormData) => Promise<void>;
  onCancel: () => void;
}

export interface CajaFormData {
  nombre: string;
  tipo: 'efectivo' | 'banco' | 'virtual';
  moneda: string;
  saldo_inicial: number;
  es_principal: boolean;
  is_active: boolean;
  notas?: string;
}

const TIPOS_CAJA = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'banco', label: 'Banco' },
  { value: 'virtual', label: 'Virtual (Pasarelas)' },
];

const MONEDAS = [
  { value: 'ARS', label: 'Pesos Argentinos (ARS)' },
  { value: 'USD', label: 'Dólares (USD)' },
  { value: 'EUR', label: 'Euros (EUR)' },
];

export function CajaForm({ caja, onSubmit, onCancel }: CajaFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<CajaFormData>({
    nombre: caja?.nombre || '',
    tipo: caja?.tipo || 'efectivo',
    moneda: caja?.moneda || 'ARS',
    saldo_inicial: caja?.saldo_actual || 0,
    es_principal: caja?.es_principal || false,
    is_active: caja?.is_active ?? true,
    notas: caja?.notas || '',
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (formData.saldo_inicial < 0) {
      newErrors.saldo_inicial = 'El saldo inicial no puede ser negativo';
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

  const handleChange = (field: keyof CajaFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de la Caja</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nombre de la Caja"
            value={formData.nombre}
            onChange={(e) => handleChange('nombre', e.target.value)}
            error={errors.nombre}
            placeholder="Ej: Caja Principal, Banco Santander, MercadoPago"
            required
          />

          <Select
            label="Tipo de Caja"
            value={formData.tipo}
            onChange={(value) => handleChange('tipo', value)}
            options={TIPOS_CAJA}
            required
          />

          <Select
            label="Moneda"
            value={formData.moneda}
            onChange={(value) => handleChange('moneda', value)}
            options={MONEDAS}
            required
          />

          <Input
            label={caja ? 'Saldo Actual' : 'Saldo Inicial'}
            type="number"
            step="0.01"
            value={formData.saldo_inicial}
            onChange={(e) => handleChange('saldo_inicial', parseFloat(e.target.value) || 0)}
            error={errors.saldo_inicial}
            helperText={caja ? 'No se puede editar directamente. Usa ajustes o transferencias.' : 'El saldo con el que inicia la caja'}
            disabled={!!caja}
            required
          />

          <div className="md:col-span-2">
            <Input
              label="Notas"
              value={formData.notas}
              onChange={(e) => handleChange('notas', e.target.value)}
              placeholder="Notas adicionales sobre esta caja"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h3>
        <div className="space-y-4">
          <Switch
            checked={formData.es_principal}
            onChange={(checked) => handleChange('es_principal', checked)}
            label="¿Es la caja principal?"
            helperText="La caja principal se muestra primero y se sugiere por defecto"
          />

          <Switch
            checked={formData.is_active}
            onChange={(checked) => handleChange('is_active', checked)}
            label="¿Está activa?"
            helperText="Las cajas inactivas no aparecen en los selectores"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {caja ? 'Actualizar Caja' : 'Crear Caja'}
        </Button>
      </div>
    </form>
  );
}
