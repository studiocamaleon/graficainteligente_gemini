import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { MaterialVariante, UnidadEspesor } from '../../types/database';

interface VariantesEditorProps {
  variantes: MaterialVariante[];
  unidadEspesor: UnidadEspesor | null;
  onChange: (variantes: MaterialVariante[]) => void;
  onUnidadEspesorChange?: (unidad: UnidadEspesor) => void;
}

export function VariantesEditor({ variantes, unidadEspesor, onChange, onUnidadEspesorChange }: VariantesEditorProps) {
  const handleAddVariante = () => {
    onChange([...variantes, { nombre: '', espesores: [] }]);
  };

  const handleRemoveVariante = (index: number) => {
    onChange(variantes.filter((_, i) => i !== index));
  };

  const handleVarianteNombreChange = (index: number, nombre: string) => {
    const updated = [...variantes];
    updated[index] = { ...updated[index], nombre };
    onChange(updated);
  };

  const handleAddEspesor = (varianteIndex: number) => {
    const updated = [...variantes];
    updated[varianteIndex] = {
      ...updated[varianteIndex],
      espesores: [...updated[varianteIndex].espesores, 0],
    };
    onChange(updated);
  };

  const handleRemoveEspesor = (varianteIndex: number, espesorIndex: number) => {
    const updated = [...variantes];
    updated[varianteIndex] = {
      ...updated[varianteIndex],
      espesores: updated[varianteIndex].espesores.filter((_, i) => i !== espesorIndex),
    };
    onChange(updated);
  };

  const handleEspesorChange = (varianteIndex: number, espesorIndex: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const updated = [...variantes];
    const espesores = [...updated[varianteIndex].espesores];
    espesores[espesorIndex] = numValue;
    updated[varianteIndex] = { ...updated[varianteIndex], espesores };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Variantes
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Agrega variantes del material (opcional)
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddVariante}>
            <Plus className="w-4 h-4" />
            Agregar Variante
          </Button>
        </div>

        {variantes.length > 0 && onUnidadEspesorChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidad de Espesor <span className="text-xs text-gray-500 font-normal">(Opcional)</span>
            </label>
            <select
              value={unidadEspesor || ''}
              onChange={(e) => onUnidadEspesorChange(e.target.value as UnidadEspesor)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sin unidad de espesor</option>
              <option value="gr">Gramos (gr)</option>
              <option value="mm">Milímetros (mm)</option>
            </select>
          </div>
        )}
      </div>

      {variantes.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No hay variantes. Haz clic en "Agregar Variante" para comenzar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {variantes.map((variante, varianteIndex) => (
            <div key={varianteIndex} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <Input
                    label={`Variante ${varianteIndex + 1}`}
                    value={variante.nombre}
                    onChange={(e) => handleVarianteNombreChange(varianteIndex, e.target.value)}
                    placeholder="Ej: Estándar, Premium, etc."
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVariante(varianteIndex)}
                  className="mt-7 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar variante"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {unidadEspesor && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">
                      Espesores ({unidadEspesor}) - Opcional
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddEspesor(varianteIndex)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar Espesor
                    </button>
                  </div>

                <div className="grid grid-cols-3 gap-2">
                  {variante.espesores.map((espesor, espesorIndex) => (
                    <div key={espesorIndex} className="flex items-center gap-1">
                      <input
                        type="number"
                        value={espesor}
                        onChange={(e) => handleEspesorChange(varianteIndex, espesorIndex, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                        step="0.01"
                        min="0"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEspesor(varianteIndex, espesorIndex)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                  {variante.espesores.length === 0 && (
                    <p className="text-xs text-gray-500 italic">Sin espesores definidos</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
