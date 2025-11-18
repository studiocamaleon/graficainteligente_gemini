import { useState, useEffect } from 'react';
import { useMateriales } from '../../../hooks/useMateriales';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { Loader2, Package } from 'lucide-react';

interface MaterialCascadeSelectorMaterialesRigidosProps {
  materialId: string;
  varianteNombre: string;
  espesores: number[];
  onChange: (materialId: string, varianteNombre: string, espesores: number[]) => void;
  error?: string;
}

export function MaterialCascadeSelectorMaterialesRigidos({
  materialId,
  varianteNombre,
  espesores,
  onChange,
  error,
}: MaterialCascadeSelectorMaterialesRigidosProps) {
  const { materiales, isLoading } = useMateriales();
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [availableVariantes, setAvailableVariantes] = useState<any[]>([]);
  const [selectedVariante, setSelectedVariante] = useState<any>(null);
  const [availableEspesores, setAvailableEspesores] = useState<number[]>([]);

  useEffect(() => {
    if (materialId && materiales.length > 0) {
      const material = materiales.find((m) => m.id === materialId);
      if (material) {
        setSelectedMaterial(material);
        const variantes = material.variantes || [];
        setAvailableVariantes(variantes);

        if (varianteNombre) {
          const variante = variantes.find((v: any) => v.nombre === varianteNombre);
          if (variante) {
            setSelectedVariante(variante);
            setAvailableEspesores(variante.espesores || []);
          }
        }
      }
    }
  }, [materialId, varianteNombre, materiales]);

  const handleMaterialChange = (newMaterialId: string) => {
    const material = materiales.find((m) => m.id === newMaterialId);
    setSelectedMaterial(material || null);
    setAvailableVariantes(material?.variantes || []);
    setSelectedVariante(null);
    setAvailableEspesores([]);
    onChange(newMaterialId, '', []);
  };

  const handleVarianteChange = (newVarianteNombre: string) => {
    const variante = availableVariantes.find((v) => v.nombre === newVarianteNombre);
    setSelectedVariante(variante || null);
    setAvailableEspesores(variante?.espesores || []);
    onChange(materialId, newVarianteNombre, []);
  };

  const handleEspesorToggle = (espesor: number) => {
    const newEspesores = espesores.includes(espesor)
      ? espesores.filter((e) => e !== espesor)
      : [...espesores, espesor];
    onChange(materialId, varianteNombre, newEspesores);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const materialesOptions = materiales
    .filter((m) => m.is_active)
    .map((m) => ({
      value: m.id,
      label: m.nombre,
    }));

  const variantesOptions = availableVariantes.map((v) => ({
    value: v.nombre,
    label: v.nombre,
  }));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Material <span className="text-red-500">*</span>
        </label>
        <SearchableSelect
          options={materialesOptions}
          value={materialId}
          onChange={handleMaterialChange}
          placeholder="Selecciona un material..."
          emptyMessage="No hay materiales disponibles"
        />
      </div>

      {selectedMaterial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Variante <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={variantesOptions}
            value={varianteNombre}
            onChange={handleVarianteChange}
            placeholder="Selecciona una variante..."
            emptyMessage="No hay variantes disponibles"
          />
        </div>
      )}

      {selectedVariante && availableEspesores.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Espesores Disponibles <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {availableEspesores.map((espesor) => (
              <button
                key={espesor}
                type="button"
                onClick={() => handleEspesorToggle(espesor)}
                className={`
                  px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                  ${
                    espesores.includes(espesor)
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }
                `}
              >
                {espesor} mm
              </button>
            ))}
          </div>
          {espesores.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Selecciona al menos un espesor
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
