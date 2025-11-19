import { useState, useEffect, useRef, Fragment, useMemo } from 'react';
import { Input } from '../ui/Input';
import type {
  CombinacionTamanioPapel,
  PrecioImpresionInput,
} from '../../hooks/useCentroCopiadoPreciosImpresion';
import type { CentroCopiadoRangoPrecioImpresion, TipoTintaCopiado } from '../../types/database';

interface Props {
  combinaciones: CombinacionTamanioPapel[];
  tipoTinta: TipoTintaCopiado;
  rangos: CentroCopiadoRangoPrecioImpresion[];
  preciosActuales: Map<string, Map<string, number>>;
  onPreciosChange: (precios: PrecioImpresionInput[]) => void;
}

interface PrecioState {
  [key: string]: number;
}

export function CentroCopiadoMatrizPrecios({
  combinaciones,
  tipoTinta,
  rangos,
  preciosActuales,
  onPreciosChange,
}: Props) {
  const hasLocalChanges = useRef(false);

  const getCombinacionKey = (combinacion: CombinacionTamanioPapel) => {
    return `${combinacion.tamanio_id}-${combinacion.papel_id}`;
  };

  const getRangoCaraKey = (rangoId: string, cara: 'frente' | 'frente_y_dorso') => {
    return `${rangoId}-${cara}`;
  };

  const initialPreciosState = useMemo(() => {
    if (combinaciones.length === 0 || rangos.length === 0) return {};

    const initialState: PrecioState = {};

    combinaciones.forEach(combinacion => {
      const combKey = getCombinacionKey(combinacion);
      const preciosCombinacion = preciosActuales.get(combKey);

      if (preciosCombinacion) {
        rangos.forEach(rango => {
          ['frente', 'frente_y_dorso'].forEach((cara) => {
            const rangoCaraKey = getRangoCaraKey(rango.id, cara as 'frente' | 'frente_y_dorso');
            const precio = preciosCombinacion.get(rangoCaraKey);
            if (precio !== undefined) {
              const key = `${combKey}-${rangoCaraKey}`;
              initialState[key] = precio;
            }
          });
        });
      }
    });

    return initialState;
  }, [combinaciones, rangos, preciosActuales]);

  const [preciosState, setPreciosState] = useState<PrecioState>(initialPreciosState);

  useEffect(() => {
    if (!hasLocalChanges.current) {
      setPreciosState(initialPreciosState);
    }
  }, [initialPreciosState]);

  const handlePrecioChange = (
    combinacion: CombinacionTamanioPapel,
    rangoId: string,
    cara: 'frente' | 'frente_y_dorso',
    value: string
  ) => {
    const combKey = getCombinacionKey(combinacion);
    const rangoCaraKey = getRangoCaraKey(rangoId, cara);
    const key = `${combKey}-${rangoCaraKey}`;
    const precio = parseFloat(value) || 0;

    hasLocalChanges.current = true;

    const newState = {
      ...preciosState,
      [key]: precio,
    };

    setPreciosState(newState);
  };

  useEffect(() => {
    if (!hasLocalChanges.current) return;

    const preciosArray: PrecioImpresionInput[] = [];

    combinaciones.forEach(combinacion => {
      const combKey = getCombinacionKey(combinacion);

      rangos.forEach(rango => {
        ['frente', 'frente_y_dorso'].forEach((cara) => {
          const rangoCaraKey = getRangoCaraKey(rango.id, cara as 'frente' | 'frente_y_dorso');
          const key = `${combKey}-${rangoCaraKey}`;
          const precio = preciosState[key] || 0;

          if (precio > 0) {
            preciosArray.push({
              tamanio_papel_id: combinacion.tamanio_id,
              papel_id: combinacion.papel_id,
              tipo_tinta: tipoTinta,
              rango_precio_id: rango.id,
              cara_impresa: cara as 'frente' | 'frente_y_dorso',
              precio,
            });
          }
        });
      });
    });

    onPreciosChange(preciosArray);
  }, [preciosState, combinaciones, rangos, tipoTinta, onPreciosChange]);

  const formatRango = (rango: CentroCopiadoRangoPrecioImpresion) => {
    if (rango.hojas_hasta === null) {
      return `${rango.hojas_desde}+ hojas`;
    }
    return `${rango.hojas_desde}-${rango.hojas_hasta} hojas`;
  };

  const combinacionesPorTamanio = useMemo(() => {
    const grupos = new Map<string, CombinacionTamanioPapel[]>();

    combinaciones.forEach(combinacion => {
      const key = combinacion.tamanio_id;
      if (!grupos.has(key)) {
        grupos.set(key, []);
      }
      grupos.get(key)!.push(combinacion);
    });

    return Array.from(grupos.entries()).map(([tamanioId, combs]) => ({
      tamanioId,
      tamanioNombre: combs[0].tamanio_nombre,
      tamanioAncho: combs[0].tamanio_ancho_mm,
      tamanioAlto: combs[0].tamanio_alto_mm,
      combinaciones: combs,
    }));
  }, [combinaciones]);

  const renderTablaSeccion = (
    tamanioNombre: string,
    tamanioAncho: number,
    tamanioAlto: number,
    combinacionesSeccion: CombinacionTamanioPapel[]
  ) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 w-80 min-w-[320px]">
              Papel
            </th>
            {rangos.map(rango => (
              <th
                key={rango.id}
                colSpan={2}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
              >
                {formatRango(rango)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 border-r border-gray-200"></th>
            {rangos.map(rango => (
              <Fragment key={rango.id}>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-400 border-r border-gray-100">
                  Frente
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-400 border-r border-gray-200">
                  F/D
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {combinacionesSeccion.map(combinacion => {
            const combKey = getCombinacionKey(combinacion);
            return (
              <tr key={combKey} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm border-r border-gray-200 w-80 min-w-[320px]">
                  <div className="space-y-1">
                    <div className="text-sm text-gray-700">
                      {combinacion.papel_material_nombre} - {combinacion.papel_variante_nombre}
                      {combinacion.papel_espesor && (
                        <span className="text-gray-500 ml-1">
                          ({combinacion.papel_espesor} {combinacion.papel_unidad_espesor})
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                {rangos.map(rango => {
                  const frenteKey = `${combKey}-${getRangoCaraKey(rango.id, 'frente')}`;
                  const frenteYDorsoKey = `${combKey}-${getRangoCaraKey(rango.id, 'frente_y_dorso')}`;
                  const valorFrente = preciosState[frenteKey] || 0;
                  const valorFrenteYDorso = preciosState[frenteYDorsoKey] || 0;

                  return (
                    <Fragment key={rango.id}>
                      <td className="px-2 py-3 border-r border-gray-100">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={valorFrente > 0 ? valorFrente : ''}
                          onChange={(e) =>
                            handlePrecioChange(combinacion, rango.id, 'frente', e.target.value)
                          }
                          placeholder="$"
                          className="w-full text-center"
                        />
                      </td>
                      <td className="px-2 py-3 border-r border-gray-200">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={valorFrenteYDorso > 0 ? valorFrenteYDorso : ''}
                          onChange={(e) =>
                            handlePrecioChange(combinacion, rango.id, 'frente_y_dorso', e.target.value)
                          }
                          placeholder="$"
                          className="w-full text-center"
                        />
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {combinacionesPorTamanio.map(({ tamanioId, tamanioNombre, tamanioAncho, tamanioAlto, combinaciones: combs }) => (
        <div key={tamanioId} className="space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
            <h3 className="text-lg font-semibold text-blue-900">{tamanioNombre}</h3>
            <span className="text-sm text-blue-700">
              {tamanioAncho} × {tamanioAlto} mm
            </span>
          </div>
          {renderTablaSeccion(tamanioNombre, tamanioAncho, tamanioAlto, combs)}
        </div>
      ))}
    </div>
  );
}
