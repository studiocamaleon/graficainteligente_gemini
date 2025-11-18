import { useState, useEffect } from 'react';
import { X, Plus, Check, AlertTriangle } from 'lucide-react';
import { useMateriales } from '../../../hooks/useMateriales';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { VarianteEspesorCombinacion } from '../../../hooks/useProductosMaterialesRigidos';

interface Props {
  materialId: string;
  combinaciones: VarianteEspesorCombinacion[];
  onChange: (materialId: string, combinaciones: VarianteEspesorCombinacion[]) => void;
  error?: string;
}

interface VarianteConEspesores {
  nombre: string;
  espesoresDisponibles: number[];
  espesoresSeleccionados: number[];
  sinEspesor: boolean;
}

interface CombinacionInvalida {
  variante: string;
  espesor: number | null;
}

export function MaterialVarianteEspesorSelector({
  materialId,
  combinaciones,
  onChange,
  error,
}: Props) {
  const { materiales, isLoading } = useMateriales();
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [variantesState, setVariantesState] = useState<Map<string, VarianteConEspesores>>(new Map());
  const [combinacionesInvalidas, setCombinacionesInvalidas] = useState<CombinacionInvalida[]>([]);

  useEffect(() => {
    if (materialId && materiales.length > 0) {
      const material = materiales.find((m) => m.id === materialId);
      if (material) {
        setSelectedMaterial(material);

        const variantesMap = new Map<string, VarianteConEspesores>();
        const invalidas: CombinacionInvalida[] = [];

        (material.variantes || []).forEach((v: any) => {
          const espesoresDisponibles = v.espesores || [];
          const sinEspesor = espesoresDisponibles.length === 0;
          variantesMap.set(v.nombre, {
            nombre: v.nombre,
            espesoresDisponibles,
            espesoresSeleccionados: [],
            sinEspesor,
          });
        });

        // Procesar combinaciones existentes y detectar las inválidas
        const combinacionesValidas: VarianteEspesorCombinacion[] = [];
        combinaciones.forEach((comb) => {
          const varianteExistente = variantesMap.get(comb.variante_nombre);
          if (varianteExistente) {
            // Si la variante no tiene espesores (sinEspesor=true), aceptar espesor null
            if (varianteExistente.sinEspesor && comb.espesor === null) {
              // Marcar como seleccionada usando -1 como indicador
              varianteExistente.espesoresSeleccionados = [-1];
              combinacionesValidas.push(comb);
            } else if (!varianteExistente.sinEspesor && comb.espesor !== null && varianteExistente.espesoresDisponibles.includes(comb.espesor)) {
              // Variante con espesores: verificar que el espesor esté disponible
              varianteExistente.espesoresSeleccionados.push(comb.espesor);
              combinacionesValidas.push(comb);
            } else {
              // Espesor no disponible o incompatible con configuración actual
              invalidas.push({
                variante: comb.variante_nombre,
                espesor: comb.espesor,
              });
            }
          } else {
            // Variante no existe en el material actual
            invalidas.push({
              variante: comb.variante_nombre,
              espesor: comb.espesor,
            });
          }
        });

        setVariantesState(variantesMap);
        setCombinacionesInvalidas(invalidas);

        // Si hay combinaciones inválidas, notificar al padre con solo las válidas
        if (invalidas.length > 0) {
          onChange(materialId, combinacionesValidas);
        }
      }
    }
  }, [materialId, materiales]);

  const handleMaterialChange = (newMaterialId: string) => {
    const material = materiales.find((m) => m.id === newMaterialId);
    setSelectedMaterial(material || null);

    const variantesMap = new Map<string, VarianteConEspesores>();
    (material?.variantes || []).forEach((v: any) => {
      const espesoresDisponibles = v.espesores || [];
      const sinEspesor = espesoresDisponibles.length === 0;
      variantesMap.set(v.nombre, {
        nombre: v.nombre,
        espesoresDisponibles,
        espesoresSeleccionados: [],
        sinEspesor,
      });
    });
    setVariantesState(variantesMap);

    onChange(newMaterialId, []);
  };

  const actualizarCombinaciones = (variantesMap: Map<string, VarianteConEspesores>) => {
    const allCombinaciones: VarianteEspesorCombinacion[] = [];
    variantesMap.forEach((v) => {
      if (v.sinEspesor) {
        // Variantes sin espesor: si está seleccionada, agregar con espesor null
        if (v.espesoresSeleccionados.length > 0) {
          allCombinaciones.push({
            variante_nombre: v.nombre,
            espesor: null,
          });
        }
      } else {
        // Variantes con espesor: agregar cada espesor seleccionado
        v.espesoresSeleccionados.forEach((espesor) => {
          allCombinaciones.push({
            variante_nombre: v.nombre,
            espesor,
          });
        });
      }
    });

    onChange(materialId, allCombinaciones);
  };

  const handleEspesorToggle = (varianteNombre: string, espesor: number) => {
    const newVariantesState = new Map(variantesState);
    const variante = newVariantesState.get(varianteNombre);

    if (!variante) return;

    const isSelected = variante.espesoresSeleccionados.includes(espesor);

    if (isSelected) {
      variante.espesoresSeleccionados = variante.espesoresSeleccionados.filter((e) => e !== espesor);
    } else {
      variante.espesoresSeleccionados = [...variante.espesoresSeleccionados, espesor];
    }

    setVariantesState(newVariantesState);
    actualizarCombinaciones(newVariantesState);
  };

  const handleVarianteSinEspesorToggle = (varianteNombre: string) => {
    const newVariantesState = new Map(variantesState);
    const variante = newVariantesState.get(varianteNombre);

    if (!variante || !variante.sinEspesor) return;

    // Para variantes sin espesor, simplemente alternar la selección
    // Usamos espesoresSeleccionados.length > 0 como indicador de "seleccionado"
    variante.espesoresSeleccionados = variante.espesoresSeleccionados.length > 0 ? [] : [-1]; // -1 como marcador

    setVariantesState(newVariantesState);
    actualizarCombinaciones(newVariantesState);
  };

  const selectAllEspesores = (varianteNombre: string) => {
    const newVariantesState = new Map(variantesState);
    const variante = newVariantesState.get(varianteNombre);

    if (!variante) return;

    if (variante.sinEspesor) {
      // Para variantes sin espesor, simplemente seleccionar
      variante.espesoresSeleccionados = [-1]; // Marcador
    } else {
      variante.espesoresSeleccionados = [...variante.espesoresDisponibles];
    }
    setVariantesState(newVariantesState);
    actualizarCombinaciones(newVariantesState);
  };

  const deselectAllEspesores = (varianteNombre: string) => {
    const newVariantesState = new Map(variantesState);
    const variante = newVariantesState.get(varianteNombre);

    if (!variante) return;

    variante.espesoresSeleccionados = [];
    setVariantesState(newVariantesState);
    actualizarCombinaciones(newVariantesState);
  };

  const getTotalCombinaciones = () => {
    let total = 0;
    variantesState.forEach((v) => {
      if (v.sinEspesor) {
        // Para variantes sin espesor, contar como 1 si está seleccionada
        total += v.espesoresSeleccionados.length > 0 ? 1 : 0;
      } else {
        total += v.espesoresSeleccionados.length;
      }
    });
    return total;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const materialesOptions = materiales
    .filter((m) => m.is_active)
    .map((m) => ({
      value: m.id,
      label: m.nombre,
    }));

  return (
    <div className="space-y-6">
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
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {combinacionesInvalidas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">
                Combinaciones no válidas detectadas
              </h4>
              <p className="text-sm text-amber-800 mb-3">
                Las siguientes combinaciones estaban guardadas pero ya no están disponibles en la configuración actual del material:
              </p>
              <ul className="space-y-1">
                {combinacionesInvalidas.map((invalida, idx) => (
                  <li key={idx} className="text-sm text-amber-900">
                    <span className="font-medium">{invalida.variante}</span> - {invalida.espesor !== null ? `${invalida.espesor}mm` : 'Sin espesor'}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-700 mt-3">
                Estas combinaciones serán eliminadas al guardar. Si necesitas estos espesores, primero actualiza la configuración del material base.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedMaterial && variantesState.size > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Variantes {selectedMaterial?.aplica_espesor ? 'y Espesores' : ''} <span className="text-red-500">*</span>
            </label>
            {getTotalCombinaciones() > 0 && (
              <Badge variant="primary">
                {getTotalCombinaciones()} {getTotalCombinaciones() === 1 ? 'variante seleccionada' : 'variantes seleccionadas'}
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {Array.from(variantesState.values()).map((variante) => (
              <div
                key={variante.nombre}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {variante.nombre}
                  </h4>
                  {!variante.sinEspesor && (
                    <div className="flex gap-2">
                      {variante.espesoresSeleccionados.length < variante.espesoresDisponibles.length && (
                        <button
                          type="button"
                          onClick={() => selectAllEspesores(variante.nombre)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Todos
                        </button>
                      )}
                      {variante.espesoresSeleccionados.length > 0 && (
                        <button
                          type="button"
                          onClick={() => deselectAllEspesores(variante.nombre)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Ninguno
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {variante.sinEspesor ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleVarianteSinEspesorToggle(variante.nombre)}
                      className={`
                        relative px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-2
                        ${
                          variante.espesoresSeleccionados.length > 0
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                        }
                      `}
                    >
                      {variante.espesoresSeleccionados.length > 0 && <Check className="w-4 h-4" />}
                      Seleccionar variante (sin espesor)
                    </button>
                    <p className="text-xs text-gray-500 italic">
                      Este material no requiere espesor
                    </p>
                  </div>
                ) : variante.espesoresDisponibles.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {variante.espesoresDisponibles.map((espesor) => {
                      const isSelected = variante.espesoresSeleccionados.includes(espesor);
                      return (
                        <button
                          key={espesor}
                          type="button"
                          onClick={() => handleEspesorToggle(variante.nombre, espesor)}
                          className={`
                            relative px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                            ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                            }
                          `}
                        >
                          <span className="flex items-center justify-center gap-1">
                            {isSelected && <Check className="w-3 h-3" />}
                            {espesor}mm
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No hay espesores disponibles para esta variante
                  </p>
                )}
              </div>
            ))}
          </div>

          {getTotalCombinaciones() === 0 && (
            <p className="mt-3 text-sm text-amber-600">
              Selecciona al menos una variante{selectedMaterial?.aplica_espesor ? ' y espesor' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
