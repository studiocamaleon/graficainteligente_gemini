import { useState, useEffect } from 'react';
import { Input } from '../../ui/Input';
import { MeasureBadge } from '../../ui/MeasureBadge';
import { InkBadge } from '../../ui/InkBadge';
import { MaterialBadge } from '../../ui/MaterialBadge';
import type { ProductoTalonarioPrecio, PrecioInput } from '../../../hooks/useProductosTalonariosPrecios';
import type { TintaInfo } from '../../../hooks/useAllProductosTalonarioPrecios';

interface MaterialInfo {
  materialNombre: string;
  varianteNombre: string;
  espesor?: number | null;
  unidadEspesor?: string | null;
}

interface Props {
  productoId: string;
  productoNombre: string;
  medida: { ancho: number; alto: number };
  tinta: string;
  cantidades: number[];
  caras: string[];
  materialInfo?: MaterialInfo;
  preciosExistentes: ProductoTalonarioPrecio[];
  onChange: (precios: PrecioInput[]) => void;
  readonly?: boolean;
}

interface PrecioState {
  [key: string]: number; // key format: "cantidad-cara"
}

export function ProductoTalonarioPrecioMatriz({
  productoId,
  productoNombre,
  medida,
  tinta,
  cantidades,
  caras,
  materialInfo,
  preciosExistentes,
  onChange,
  readonly = false,
}: Props) {
  const [preciosState, setPreciosState] = useState<PrecioState>({});

  // Initialize state from existing prices
  useEffect(() => {
    const initialState: PrecioState = {};

    // Find matching prices for this combination
    const preciosRelevantes = preciosExistentes.filter(
      (p) =>
        p.medida_ancho === medida.ancho &&
        p.medida_alto === medida.alto &&
        p.tinta === tinta
    );

    // Build initial state
    cantidades.forEach((cantidad) => {
      caras.forEach((cara) => {
        const key = `${cantidad}-${cara}`;
        const precioExistente = preciosRelevantes.find(
          (p) => p.cantidad === cantidad && p.tipo_copia === cara
        );
        initialState[key] = precioExistente?.precio || 0;
      });
    });

    setPreciosState(initialState);
  }, [productoId, medida, tinta, cantidades, caras, preciosExistentes]);

  const handlePrecioChange = (cantidad: number, cara: string, value: string) => {
    const key = `${cantidad}-${cara}`;
    const precio = parseFloat(value) || 0;

    const newState = {
      ...preciosState,
      [key]: precio,
    };

    setPreciosState(newState);

    // Build array of all precios for this combination
    const preciosArray: PrecioInput[] = [];

    cantidades.forEach((cant) => {
      caras.forEach((c) => {
        const k = `${cant}-${c}`;
        const p = newState[k] || 0;

        if (p > 0) {
          preciosArray.push({
            medida_ancho: medida.ancho,
            medida_alto: medida.alto,
            tinta: tinta,
            cantidad: cant,
            tipo_copia: c as 'duplicado' | 'triplicado' | 'cuadruplicado',
            precio: p,
          });
        }
      });
    });

    onChange(preciosArray);
  };

  const formatCara = (cara: string): string => {
    if (cara === 'duplicado') return 'Duplicado';
    if (cara === 'triplicado') return 'Triplicado';
    if (cara === 'cuadruplicado') return 'Cuadruplicado';
    return cara;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <MeasureBadge ancho={medida.ancho} alto={medida.alto} />
          <div className="w-px h-8 bg-gray-300"></div>
          <InkBadge tinta={tinta} />
        </div>
        {materialInfo && (
          <MaterialBadge
            materialNombre={materialInfo.materialNombre}
            varianteNombre={materialInfo.varianteNombre}
            espesor={materialInfo.espesor}
            unidadEspesor={materialInfo.unidadEspesor}
          />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                Cantidad
              </th>
              {caras.map((cara) => (
                <th
                  key={cara}
                  className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {formatCara(cara)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cantidades.map((cantidad) => (
              <tr key={cantidad} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2.5 text-sm font-medium text-gray-900 border-r border-gray-200">
                  {cantidad}
                </td>
                {caras.map((cara) => {
                  const key = `${cantidad}-${cara}`;
                  const valor = preciosState[key] || 0;

                  return (
                    <td key={cara} className="px-3 py-2.5">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valor > 0 ? valor : ''}
                        onChange={(e) => handlePrecioChange(cantidad, cara, e.target.value)}
                        placeholder="$"
                        className="w-full"
                        disabled={readonly}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
