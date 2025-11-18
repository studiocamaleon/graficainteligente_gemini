import { useEffect, useState } from 'react';
import { useMateriales } from '../../../hooks/useMateriales';
import { Select } from '../../ui/Select';
import { Input } from '../../ui/Input';
import type { MaterialVariante } from '../../../types/database';

interface MaterialCascadeSelectorProps {
  materialId: string;
  varianteNombre: string;
  espesor: number | undefined;
  onMaterialChange: (materialId: string) => void;
  onVarianteChange: (variante: string) => void;
  onEspesorChange: (espesor: number | undefined) => void;
  errors?: {
    materialId?: string;
    varianteNombre?: string;
    espesor?: string;
  };
}

export function MaterialCascadeSelector({
  materialId,
  varianteNombre,
  espesor,
  onMaterialChange,
  onVarianteChange,
  onEspesorChange,
  errors,
}: MaterialCascadeSelectorProps) {
  const { materiales, loading } = useMateriales({ isActive: true });
  const [variantes, setVariantes] = useState<MaterialVariante[]>([]);
  const [espesoresDisponibles, setEspesoresDisponibles] = useState<number[]>([]);
  const [requiereEspesor, setRequiereEspesor] = useState(false);
  const [unidadEspesor, setUnidadEspesor] = useState<string>('mm');
  const [previousMaterialId, setPreviousMaterialId] = useState<string>('');
  const [previousVarianteNombre, setPreviousVarianteNombre] = useState<string>('');

  useEffect(() => {
    if (materialId && materiales.length > 0) {
      const material = materiales.find((m) => m.id === materialId);

      if (material) {
        setVariantes(material.variantes || []);
        setRequiereEspesor(material.aplica_espesor);
        setUnidadEspesor(material.unidad_espesor || 'mm');

        if (previousMaterialId && previousMaterialId !== materialId) {
          onVarianteChange('');
          onEspesorChange(undefined);
          setEspesoresDisponibles([]);
        }
      } else {
        setVariantes([]);
        setRequiereEspesor(false);
        setUnidadEspesor('mm');
      }

      setPreviousMaterialId(materialId);
    }
  }, [materialId, materiales]);

  useEffect(() => {
    if (varianteNombre && variantes.length > 0) {
      const variante = variantes.find((v) => v.nombre === varianteNombre);

      if (variante) {
        setEspesoresDisponibles(variante.espesores || []);

        if (previousVarianteNombre && previousVarianteNombre !== varianteNombre) {
          onEspesorChange(undefined);
        }
      } else {
        setEspesoresDisponibles([]);
      }

      setPreviousVarianteNombre(varianteNombre);
    } else if (varianteNombre === '') {
      setEspesoresDisponibles([]);
    }
  }, [varianteNombre, variantes]);

  const handleMaterialChange = (value: string) => {
    onMaterialChange(value);
  };

  const handleVarianteChange = (value: string) => {
    onVarianteChange(value);
  };

  const handleEspesorChange = (value: string) => {
    const numValue = parseFloat(value);
    onEspesorChange(isNaN(numValue) ? undefined : numValue);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Material</label>
        <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Material
        <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="space-y-3">
        <div>
          <Select
            value={materialId}
            onChange={handleMaterialChange}
          >
            <option value="">Seleccionar material</option>
            {materiales.map((material) => (
              <option key={material.id} value={material.id}>
                {material.nombre}
              </option>
            ))}
          </Select>
          {errors?.materialId && (
            <p className="text-sm text-red-600 mt-1">{errors.materialId}</p>
          )}
        </div>

        {materialId && variantes.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Variante
            </label>
            <Select
              value={varianteNombre}
              onChange={handleVarianteChange}
            >
              <option value="">Seleccionar variante</option>
              {variantes.map((variante) => (
                <option key={variante.nombre} value={variante.nombre}>
                  {variante.nombre}
                </option>
              ))}
            </Select>
            {errors?.varianteNombre && (
              <p className="text-sm text-red-600 mt-1">{errors.varianteNombre}</p>
            )}
          </div>
        )}

        {materialId && varianteNombre && requiereEspesor && espesoresDisponibles.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Espesor ({unidadEspesor})
            </label>
            <Select
              value={espesor?.toString() || ''}
              onChange={(value) => handleEspesorChange(value)}
            >
              <option value="">Seleccionar espesor</option>
              {espesoresDisponibles.map((esp) => (
                <option key={esp} value={esp.toString()}>
                  {esp} {unidadEspesor}
                </option>
              ))}
            </Select>
            {errors?.espesor && (
              <p className="text-sm text-red-600 mt-1">{errors.espesor}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
