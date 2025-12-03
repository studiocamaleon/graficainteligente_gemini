import { useState, useEffect, useRef } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/Card';
import type { ProductoLaserConRelaciones } from '../../../hooks/useProductosImpresionLaser';
import { useProductosImpresionLaserPreciosRangos, type PrecioRangoInput } from '../../../hooks/useProductosImpresionLaserPreciosRangos';
import { formatRangoValue } from '../../../utils/rangoUtils';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
  producto: ProductoLaserConRelaciones;
}

interface CombinacionConfig {
  medida: { ancho: number; alto: number };
  tinta: string;
  cara_impresa: 'solo_frente' | 'frente_y_dorso';
}

interface PrecioState {
  [key: string]: number;
}

export function ProductoLaserPrecioMatrizRangos({ producto }: Props) {
  const { precios, isLoading, savePreciosEnLote } = useProductosImpresionLaserPreciosRangos(producto.id);
  const [preciosState, setPreciosState] = useState<PrecioState>({});
  const [isSaving, setIsSaving] = useState(false);
  const isInitialized = useRef(false);
  const hasLocalChanges = useRef(false);
  const { showToast } = useToast();

  const rangos = producto.rango_precio?.rangos || [];
  const tintas = producto.tecnologias[0]?.tintas || [];
  const medidas = producto.medidas_disponibles || [];
  const carasOpciones: Array<'solo_frente' | 'frente_y_dorso'> = producto.caras_impresas as Array<'solo_frente' | 'frente_y_dorso'>;

  const combinaciones: CombinacionConfig[] = [];
  medidas.forEach((medida) => {
    tintas.forEach((tinta) => {
      carasOpciones.forEach((cara) => {
        combinaciones.push({
          medida,
          tinta,
          cara_impresa: cara,
        });
      });
    });
  });

  const getKey = (
    medidaAncho: number,
    medidaAlto: number,
    tinta: string,
    caraImpresa: string,
    rangoMin: number,
    rangoMax: number | null
  ) => {
    const maxStr = rangoMax === null ? 'inf' : rangoMax.toString();
    return `${medidaAncho}-${medidaAlto}-${tinta}-${caraImpresa}-${rangoMin}-${maxStr}`;
  };

  useEffect(() => {
    if (isInitialized.current) return;

    const initialState: PrecioState = {};

    precios.forEach((precio) => {
      const key = getKey(
        precio.medida_ancho,
        precio.medida_alto,
        precio.tinta,
        precio.cara_impresa,
        precio.rango_precio_min,
        precio.rango_precio_max
      );
      initialState[key] = precio.precio;
    });

    setPreciosState(initialState);
    isInitialized.current = true;
  }, [precios]);

  const handlePrecioChange = (combinacion: CombinacionConfig, rango: any, value: string) => {
    const key = getKey(
      combinacion.medida.ancho,
      combinacion.medida.alto,
      combinacion.tinta,
      combinacion.cara_impresa,
      rango.min,
      rango.max
    );
    const precio = parseFloat(value) || 0;

    hasLocalChanges.current = true;

    setPreciosState((prev) => ({
      ...prev,
      [key]: precio,
    }));
  };

  const handleSave = async () => {
    if (!hasLocalChanges.current) {
      showToast('No hay cambios para guardar', 'info');
      return;
    }

    const preciosArray: PrecioRangoInput[] = [];

    combinaciones.forEach((comb) => {
      rangos.forEach((rango) => {
        const key = getKey(
          comb.medida.ancho,
          comb.medida.alto,
          comb.tinta,
          comb.cara_impresa,
          rango.min,
          rango.max
        );
        const precio = preciosState[key] || 0;

        if (precio > 0) {
          preciosArray.push({
            medida_ancho: comb.medida.ancho,
            medida_alto: comb.medida.alto,
            tinta: comb.tinta,
            rango_precio_min: rango.min,
            rango_precio_max: rango.max,
            cara_impresa: comb.cara_impresa,
            precio,
          });
        }
      });
    });

    try {
      setIsSaving(true);
      await savePreciosEnLote(producto.id, preciosArray);
      hasLocalChanges.current = false;
      showToast('Precios guardados exitosamente', 'success');
    } catch (error) {
      console.error('Error al guardar precios:', error);
      showToast('Error al guardar los precios', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCaraImpresa = (cara: string) => {
    return cara === 'solo_frente' ? 'Solo Frente' : 'Frente y Dorso';
  };

  const formatMedida = (medida: { ancho: number; alto: number }) => {
    return `${medida.ancho} x ${medida.alto} cm`;
  };

  if (!producto.rango_precio) {
    return (
      <Card>
        <div className="p-6">
          <p className="text-gray-500 text-center">
            Este producto no tiene un rango de precios asociado
          </p>
        </div>
      </Card>
    );
  }

  if (isLoading && !isInitialized.current) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (combinaciones.length === 0 || rangos.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <p className="text-gray-500 text-center">
            Configure medidas, tintas y caras impresas para poder agregar precios
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Matriz de Precios por Rangos</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure los precios para cada combinación y rango de cantidad
              </p>
            </div>
            <Button onClick={handleSave} disabled={isSaving || !hasLocalChanges.current}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Precios
                </>
              )}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[250px]">
                    Configuración
                  </th>
                  {rangos.map((rango, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]"
                    >
                      {formatRangoValue(rango.min, rango.max, 'uds')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {combinaciones.map((comb, combIndex) => (
                  <tr key={combIndex} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm border-r border-gray-200">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {formatMedida(comb.medida)}
                        </div>
                        <div className="text-xs text-gray-600">
                          Tinta: <span className="font-medium">{comb.tinta}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatCaraImpresa(comb.cara_impresa)}
                        </div>
                      </div>
                    </td>
                    {rangos.map((rango, rangoIndex) => {
                      const key = getKey(
                        comb.medida.ancho,
                        comb.medida.alto,
                        comb.tinta,
                        comb.cara_impresa,
                        rango.min,
                        rango.max
                      );
                      const precio = preciosState[key] || '';
                      return (
                        <td key={rangoIndex} className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={precio}
                            onChange={(e) => handlePrecioChange(comb, rango, e.target.value)}
                            placeholder="0.00"
                            className="text-right"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasLocalChanges.current && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Hay cambios sin guardar. Haz clic en "Guardar Precios" para aplicar los cambios.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
