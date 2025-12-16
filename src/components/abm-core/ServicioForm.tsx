import { useState, FormEvent, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { SearchableSelect } from '../ui/SearchableSelect';
import { MultiSelect } from '../ui/MultiSelect';
import { NivelesPrecionEditor } from './NivelesPrecioEditor';
import { useCategorias } from '../../hooks/useCategorias';
import { useEstaciones } from '../../hooks/useEstaciones';
import { usePasos } from '../../hooks/usePasos';
import type { Servicio, TipoImpactoPrecio } from '../../types/database';

interface ServicioFormProps {
  servicio?: Servicio & { niveles_precio?: any[]; pasos?: any[] };
  onSubmit: (data: ServicioFormData) => Promise<void>;
  onCancel: () => void;
}

export interface ServicioFormData {
  nombre: string;
  categorias_ids: string[];
  estacion_id: string;
  disponible_independiente: boolean;
  tiene_niveles_precio: boolean;
  tipo_impacto?: TipoImpactoPrecio | null;
  valor_impacto?: number | null;
  valor_impacto_secundario?: number | null;
  paso_id?: string | null;
  niveles?: {
    id?: string;
    nombre: string;
    tipo_impacto: TipoImpactoPrecio;
    valor_impacto: number;
    valor_impacto_secundario: number | null;
    paso_id: string | null;
    orden: number;
  }[];
}

const tipoImpactoOptions = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'sin_impacto', label: 'Sin Impacto' },
  { value: 'precio_fijo', label: 'Precio Fijo' },
  { value: 'por_unidad', label: 'Por Unidad' },
  { value: 'por_minuto', label: 'Por Minuto' },
  { value: 'porcentual', label: 'Porcentual (%)' },
  { value: 'por_mt2', label: 'Por m²' },
  { value: 'por_mt_lineal', label: 'Por Metro Lineal' },
  { value: 'fijo_porcentual', label: 'Fijo + Porcentual' },
  { value: 'fijo_mt2', label: 'Fijo + Por m²' },
  { value: 'fijo_mt_lineal', label: 'Fijo + Por Metro Lineal' },
  { value: 'fijo_minuto', label: 'Fijo + Por Minuto' },
];

const isTipoCombinado = (tipo: TipoImpactoPrecio | null): boolean => {
  if (!tipo) return false;
  return ['fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'].includes(tipo);
};

export function ServicioForm({ servicio, onSubmit, onCancel }: ServicioFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [estacionSearchTerm, setEstacionSearchTerm] = useState('');
  const [pasoSearchTerm, setPasoSearchTerm] = useState('');

  const { categorias } = useCategorias({
    isActive: true,
    itemsPerPage: 100,
  });

  const { estaciones } = useEstaciones({
    searchTerm: estacionSearchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  const { pasos } = usePasos({
    searchTerm: pasoSearchTerm,
    isActive: true,
    itemsPerPage: 10000,
  });

  const initialPasoRelacionado = servicio?.pasos?.[0];
  const initialCategorias = (servicio as any)?.servicios_categorias?.map((c: any) => c.categoria_id) || [];
  const [formData, setFormData] = useState<ServicioFormData>({
    nombre: servicio?.nombre || '',
    categorias_ids: initialCategorias,
    estacion_id: servicio?.estacion_id || '',
    disponible_independiente: servicio?.disponible_independiente || false,
    tiene_niveles_precio: servicio?.tiene_niveles_precio || false,
    tipo_impacto: servicio?.tipo_impacto || null,
    valor_impacto: servicio?.valor_impacto || null,
    valor_impacto_secundario: servicio?.valor_impacto_secundario || null,
    paso_id: initialPasoRelacionado?.paso_id || null,
    niveles: servicio?.niveles_precio || [],
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.categorias_ids || formData.categorias_ids.length === 0) {
      newErrors.categorias_ids = 'Debe seleccionar al menos una categoría';
    }

    if (!formData.estacion_id) {
      newErrors.estacion_id = 'La estación es requerida';
    }

    if (!formData.tiene_niveles_precio) {
      if (!formData.tipo_impacto) {
        newErrors.tipo_impacto = 'El tipo de impacto es requerido';
      } else if (formData.tipo_impacto !== 'sin_impacto') {
        if (formData.valor_impacto === null || formData.valor_impacto === undefined) {
          newErrors.valor_impacto = 'El valor es requerido';
        }

        if (isTipoCombinado(formData.tipo_impacto)) {
          if (formData.valor_impacto_secundario === null || formData.valor_impacto_secundario === undefined) {
            newErrors.valor_impacto_secundario = 'El valor secundario es requerido';
          }
        }
      }

      if (!formData.paso_id) {
        newErrors.paso_relacionado = 'Debe seleccionar un paso';
      }
    } else {
      if (!formData.niveles || formData.niveles.length === 0) {
        newErrors.niveles = 'Debe agregar al menos un nivel de precio';
      } else {
        formData.niveles.forEach((nivel, index) => {
          if (!nivel.nombre.trim()) {
            newErrors[`nivel_${index}_nombre`] = 'El nombre es requerido';
          }
          if (!nivel.paso_id) {
            newErrors[`nivel_${index}_paso`] = 'Debe seleccionar un paso';
          }
        });
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

  const categoriaOptions = categorias.map((cat) => ({
    value: cat.id,
    label: cat.nombre,
  }));

  const estacionOptions = estaciones.map((est) => ({
    value: est.id,
    label: est.nombre,
  }));

  const pasoOptions = pasos.map((paso) => ({
    value: paso.id,
    label: `${paso.nombre} (${paso.etapa})`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-200">
            Información Básica
          </h3>
          <div className="space-y-4">
            <Input
              label="Nombre del Servicio"
              value={formData.nombre}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, nombre: e.target.value }));
                if (errors.nombre) {
                  setErrors((prev) => ({ ...prev, nombre: '' }));
                }
              }}
              error={errors.nombre}
              required
              placeholder="Ej: Diseño Gráfico, Impresión, etc."
            />

            <MultiSelect
              label="Categorías"
              value={formData.categorias_ids}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, categorias_ids: value }));
                if (errors.categorias_ids) {
                  setErrors((prev) => ({ ...prev, categorias_ids: '' }));
                }
              }}
              options={categoriaOptions}
              placeholder="Seleccionar categorías..."
              required
              error={errors.categorias_ids}
            />

            <SearchableSelect
              label="Estación de Trabajo"
              value={formData.estacion_id}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, estacion_id: value }));
                if (errors.estacion_id) {
                  setErrors((prev) => ({ ...prev, estacion_id: '' }));
                }
              }}
              onSearch={setEstacionSearchTerm}
              options={estacionOptions}
              placeholder="Buscar estación..."
              emptyMessage="No se encontraron estaciones"
              required
              error={errors.estacion_id}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-200">
            Configuración
          </h3>
          <div className="space-y-4">
            <Switch
              label="Disponible como servicio independiente"
              description="Permite que este servicio se pueda ofrecer sin otros servicios"
              checked={formData.disponible_independiente}
              onChange={(checked) =>
                setFormData((prev) => ({ ...prev, disponible_independiente: checked }))
              }
            />

            <Switch
              label="Tiene niveles de precio"
              description="Define múltiples niveles con diferentes precios y pasos"
              checked={formData.tiene_niveles_precio}
              onChange={(checked) => {
                setFormData((prev) => ({
                  ...prev,
                  tiene_niveles_precio: checked,
                  tipo_impacto: checked ? null : prev.tipo_impacto,
                  valor_impacto: checked ? null : prev.valor_impacto,
                  paso_id: checked ? null : prev.paso_id,
                  niveles: checked ? prev.niveles : [],
                }));
              }}
            />
          </div>
        </div>

        {!formData.tiene_niveles_precio ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-200">
              Precio Único
            </h3>
            <div className="space-y-4">
              <Select
                label="Tipo de Impacto"
                value={formData.tipo_impacto || ''}
                onChange={(value) => {
                  const newTipo = value as TipoImpactoPrecio;
                  setFormData((prev) => ({
                    ...prev,
                    tipo_impacto: newTipo,
                    valor_impacto: newTipo === 'sin_impacto' ? 0 : prev.valor_impacto,
                    valor_impacto_secundario: isTipoCombinado(newTipo) ? prev.valor_impacto_secundario : null,
                  }));
                  if (errors.tipo_impacto) {
                    setErrors((prev) => ({ ...prev, tipo_impacto: '' }));
                  }
                }}
                options={tipoImpactoOptions}
                required
                error={errors.tipo_impacto}
              />

              {formData.tipo_impacto && formData.tipo_impacto !== 'sin_impacto' && (
                <div className={isTipoCombinado(formData.tipo_impacto) ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
                  <Input
                    label={isTipoCombinado(formData.tipo_impacto) ? 'Valor Fijo ($)' : 'Valor'}
                    type="number"
                    value={formData.valor_impacto ?? ''}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, valor_impacto: parseFloat(e.target.value) || 0 }));
                      if (errors.valor_impacto) {
                        setErrors((prev) => ({ ...prev, valor_impacto: '' }));
                      }
                    }}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    error={errors.valor_impacto}
                  />

                  {isTipoCombinado(formData.tipo_impacto) && (
                    <Input
                      label={
                        formData.tipo_impacto === 'fijo_porcentual'
                          ? 'Porcentaje (%)'
                          : formData.tipo_impacto === 'fijo_mt2'
                            ? 'Valor por m² ($)'
                            : formData.tipo_impacto === 'fijo_mt_lineal'
                              ? 'Valor por metro lineal ($)'
                              : 'Valor por minuto ($)'
                      }
                      type="number"
                      value={formData.valor_impacto_secundario ?? ''}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, valor_impacto_secundario: parseFloat(e.target.value) || 0 }));
                        if (errors.valor_impacto_secundario) {
                          setErrors((prev) => ({ ...prev, valor_impacto_secundario: '' }));
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                      error={errors.valor_impacto_secundario}
                    />
                  )}
                </div>
              )}

              <div>
                <SearchableSelect
                  label="Paso Relacionado"
                  value={formData.paso_id || ''}
                  onChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      paso_id: value || null,
                    }));
                    if (errors.paso_relacionado) {
                      setErrors((prev) => ({ ...prev, paso_relacionado: '' }));
                    }
                  }}
                  onSearch={setPasoSearchTerm}
                  options={pasoOptions}
                  placeholder="Buscar paso..."
                  emptyMessage="No se encontraron pasos"
                  required
                />
                {errors.paso_relacionado && (
                  <p className="mt-2 text-sm text-red-600">{errors.paso_relacionado}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Selecciona un paso individual o un grupo de pasos (solo uno)
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3 pb-2 border-b border-gray-200">
              Niveles de Precio
            </h3>
            <NivelesPrecionEditor
              niveles={formData.niveles || []}
              onChange={(niveles) => {
                setFormData((prev) => ({ ...prev, niveles }));
                if (errors.niveles) {
                  setErrors((prev) => ({ ...prev, niveles: '' }));
                }
              }}
              errors={errors}
            />
            {errors.niveles && <p className="mt-2 text-sm text-red-600">{errors.niveles}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {servicio ? 'Actualizar Servicio' : 'Crear Servicio'}
        </Button>
      </div>
    </form>
  );
}
