import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { CATEGORIAS_SISTEMA } from '../../constants/categorias';
import { TintasPasosConfigEditor } from './TintasPasosConfigEditor';
import { useTecnologia } from '../../hooks/useTecnologias';
import type { Tecnologia, TintaType, TecnologiaTintaPasoFormData } from '../../types/database';

interface TecnologiaFormProps {
  tecnologia?: Tecnologia;
  onSubmit: (data: TecnologiaFormData) => Promise<void>;
  onCancel: () => void;
}

export interface TecnologiaFormData {
  nombre: string;
  tintas: TintaType[];
  categoria_id: string | null;
  configuraciones: TecnologiaTintaPasoFormData[];
}

const TINTAS_DISPONIBLES: TintaType[] = ['K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V'];

export function TecnologiaForm({ tecnologia, onSubmit, onCancel }: TecnologiaFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { getTintasPasos } = useTecnologia();

  const [formData, setFormData] = useState<TecnologiaFormData>({
    nombre: tecnologia?.nombre || '',
    tintas: tecnologia?.tintas || [],
    categoria_id: tecnologia?.categoria_id || null,
    configuraciones: [],
  });

  useEffect(() => {
    if (tecnologia?.id) {
      loadConfiguraciones();
    }
  }, [tecnologia?.id]);

  const loadConfiguraciones = async () => {
    if (!tecnologia?.id) return;

    setLoadingConfig(true);
    try {
      const configs = await getTintasPasos(tecnologia.id);
      const configsFormData: TecnologiaTintaPasoFormData[] = configs.map((c: any) => ({
        tinta: c.tinta as TintaType,
        paso_id: c.paso_id,
      }));
      setFormData((prev) => ({ ...prev, configuraciones: configsFormData }));
    } catch (error) {
      console.error('Error loading configuraciones:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (formData.tintas.length === 0) {
      newErrors.tintas = 'Debe seleccionar al menos una tinta';
    }

    const tintasConfiguradas = formData.configuraciones.filter(
      (c) => c.paso_id !== null
    );

    if (formData.tintas.length > 0 && tintasConfiguradas.length !== formData.tintas.length) {
      newErrors.configuraciones = `Todas las tintas deben tener un paso asignado (${tintasConfiguradas.length}/${formData.tintas.length} configuradas)`;
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

  const handleTintaToggle = (tinta: TintaType) => {
    setFormData(prev => ({
      ...prev,
      tintas: prev.tintas.includes(tinta)
        ? prev.tintas.filter(t => t !== tinta)
        : [...prev.tintas, tinta],
    }));
    if (errors.tintas) {
      setErrors(prev => ({ ...prev, tintas: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-200">
            Información Básica
          </h3>
          <div className="space-y-4">
            <Input
              label="Nombre de la Tecnología"
              value={formData.nombre}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, nombre: e.target.value }));
                if (errors.nombre) {
                  setErrors(prev => ({ ...prev, nombre: '' }));
                }
              }}
              error={errors.nombre}
              required
              placeholder="Ej: Impresión Digital UV, Offset, etc."
            />

            <Select
              label="Categoría del Sistema"
              value={formData.categoria_id || ''}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, categoria_id: value || null }));
              }}
              options={[
                { value: '', label: 'Sin categoría específica' },
                ...Object.values(CATEGORIAS_SISTEMA).map(cat => ({
                  value: cat.id,
                  label: cat.nombre
                }))
              ]}
              helperText="Asignar una categoría permite que esta tecnología aparezca automáticamente en el módulo de productos correspondiente (ej: Impresión Láser, Gran Formato)."
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tintas Disponibles <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {TINTAS_DISPONIBLES.map((tinta) => (
                  <label
                    key={tinta}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                      ${formData.tintas.includes(tinta)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={formData.tintas.includes(tinta)}
                      onChange={() => handleTintaToggle(tinta)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className={`font-medium ${formData.tintas.includes(tinta) ? 'text-blue-700' : 'text-gray-700'}`}>
                      {tinta}
                    </span>
                  </label>
                ))}
              </div>
              {errors.tintas && <p className="mt-2 text-sm text-red-600">{errors.tintas}</p>}
            </div>
          </div>
        </div>

        {formData.tintas.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-200">
              Configuración de Pasos de Producción
            </h3>
            {loadingConfig ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Cargando configuraciones...</p>
              </div>
            ) : (
              <TintasPasosConfigEditor
                tintas={formData.tintas}
                configuraciones={formData.configuraciones}
                onChange={(configuraciones) => {
                  setFormData(prev => ({ ...prev, configuraciones }));
                  if (errors.configuraciones) {
                    setErrors(prev => ({ ...prev, configuraciones: '' }));
                  }
                }}
                errors={errors}
              />
            )}
            {errors.configuraciones && (
              <p className="mt-2 text-sm text-red-600">{errors.configuraciones}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {tecnologia ? 'Actualizar Tecnología' : 'Crear Tecnología'}
        </Button>
      </div>
    </form>
  );
}
