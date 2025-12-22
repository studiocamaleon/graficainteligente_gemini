import { useState } from 'react';
import { Plus, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Tooltip } from '../ui/Tooltip';
import { usePasos } from '../../hooks/usePasos';
import type { TipoImpactoPrecio } from '../../types/database';

interface NivelPrecio {
  id?: string;
  nombre: string;
  tipo_impacto: TipoImpactoPrecio;
  valor_impacto: number;
  valor_impacto_secundario: number | null;
  paso_id: string | null;
  orden: number;
}

interface NivelesPrecionEditorProps {
  niveles: NivelPrecio[];
  onChange: (niveles: NivelPrecio[]) => void;
  errors?: Record<string, string>;
}

const tipoImpactoOptions = [
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

const isTipoCombinado = (tipo: TipoImpactoPrecio): boolean => {
  return ['fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'].includes(tipo);
};

const getValorSecundarioLabel = (tipo: TipoImpactoPrecio): string => {
  switch (tipo) {
    case 'fijo_porcentual':
      return 'Porcentaje (%)';
    case 'fijo_mt2':
      return 'Valor por m² ($)';
    case 'fijo_mt_lineal':
      return 'Valor por metro lineal ($)';
    case 'fijo_minuto':
      return 'Valor por minuto ($)';
    default:
      return 'Valor Secundario';
  }
};

export function NivelesPrecionEditor({ niveles, onChange, errors = {} }: NivelesPrecionEditorProps) {
  const [pasoSearchTerm, setPasoSearchTerm] = useState('');

  const { pasos } = usePasos({
    searchTerm: pasoSearchTerm,
    isActive: true,
    itemsPerPage: 10000,
  });

  const handleAddNivel = () => {
    const newNivel: NivelPrecio = {
      nombre: '',
      tipo_impacto: 'precio_fijo',
      valor_impacto: 0,
      valor_impacto_secundario: null,
      paso_id: null,
      orden: niveles.length + 1,
    };
    onChange([...niveles, newNivel]);
  };

  const handleRemoveNivel = (index: number) => {
    const filtered = niveles.filter((_, i) => i !== index);
    const reordered = filtered.map((nivel, idx) => ({
      ...nivel,
      orden: idx + 1,
    }));
    onChange(reordered);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newNiveles = [...niveles];
    [newNiveles[index - 1], newNiveles[index]] = [newNiveles[index], newNiveles[index - 1]];
    const reordered = newNiveles.map((nivel, idx) => ({
      ...nivel,
      orden: idx + 1,
    }));
    onChange(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index === niveles.length - 1) return;
    const newNiveles = [...niveles];
    [newNiveles[index], newNiveles[index + 1]] = [newNiveles[index + 1], newNiveles[index]];
    const reordered = newNiveles.map((nivel, idx) => ({
      ...nivel,
      orden: idx + 1,
    }));
    onChange(reordered);
  };

  const handleNivelChange = (index: number, field: keyof NivelPrecio, value: any) => {
    const updated = [...niveles];
    const currentNivel = updated[index];

    updated[index] = {
      ...currentNivel,
      [field]: value
    };

    if (field === 'tipo_impacto') {
      if (!isTipoCombinado(value as TipoImpactoPrecio)) {
        updated[index].valor_impacto_secundario = null;
      }
    }

    onChange(updated);
  };

  const pasoOptions = pasos.map((paso) => ({
    value: paso.id,
    label: `${paso.nombre} (${paso.etapa})`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Niveles de Precio
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Define diferentes niveles con sus propios precios y pasos asociados
            </p>
          </div>
          <Tooltip
            content="Los niveles de precio permiten ofrecer diferentes opciones al cliente. Por ejemplo: Diseño Básico, Premium, y Avanzado, cada uno con su propio precio y flujo de trabajo."
            icon
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAddNivel}>
          <Plus className="w-4 h-4" />
          Agregar Nivel
        </Button>
      </div>

      {niveles.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No hay niveles. Haz clic en "Agregar Nivel" para comenzar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {niveles.map((nivel, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className={`p-1 rounded transition-colors ${index === 0
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    title="Mover arriba"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === niveles.length - 1}
                    className={`p-1 rounded transition-colors ${index === niveles.length - 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    title="Mover abajo"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm flex-shrink-0">
                  {nivel.orden}
                </div>

                <div className="flex-1 space-y-3">
                  <Input
                    label="Nombre del Nivel"
                    value={nivel.nombre}
                    onChange={(e) => handleNivelChange(index, 'nombre', e.target.value)}
                    placeholder="Ej: Diseño Básico, Premium, etc."
                    required
                    error={errors[`nivel_${index}_nombre`]}
                  />

                  <Select
                    label="Tipo de Impacto"
                    value={nivel.tipo_impacto}
                    onChange={(value) => handleNivelChange(index, 'tipo_impacto', value)}
                    options={tipoImpactoOptions}
                  />

                  <div className={isTipoCombinado(nivel.tipo_impacto) ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : ''}>
                    <Input
                      label={isTipoCombinado(nivel.tipo_impacto) ? 'Valor Fijo ($)' : 'Valor'}
                      type="number"
                      value={nivel.valor_impacto}
                      onChange={(e) => handleNivelChange(index, 'valor_impacto', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />

                    {isTipoCombinado(nivel.tipo_impacto) && (
                      <Input
                        label={getValorSecundarioLabel(nivel.tipo_impacto)}
                        type="number"
                        value={nivel.valor_impacto_secundario ?? ''}
                        onChange={(e) => handleNivelChange(index, 'valor_impacto_secundario', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <SearchableSelect
                      label="Paso Relacionado"
                      value={nivel.paso_id || ''}
                      onChange={(value) => handleNivelChange(index, 'paso_id', value || null)}
                      onSearch={setPasoSearchTerm}
                      options={pasoOptions}
                      placeholder="Buscar paso..."
                      emptyMessage="No se encontraron pasos"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Selecciona el paso asociado a este nivel
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveNivel(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar nivel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {niveles.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>{niveles.length}</strong> nivel{niveles.length !== 1 ? 'es' : ''} configurado{niveles.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
