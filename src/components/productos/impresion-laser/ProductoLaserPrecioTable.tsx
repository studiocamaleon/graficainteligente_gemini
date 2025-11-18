import { useState, useEffect } from 'react';
import { Input } from '../../ui/Input';
import { MaterialBadge } from '../../ui/MaterialBadge';

interface MedidaConfig {
  ancho: number;
  alto: number;
}

interface PreciosCelda {
  [key: string]: number | undefined; // key formato: "cantidad-cara_impresa"
}

interface MaterialInfo {
  materialNombre: string;
  varianteNombre: string;
  espesor?: number | null;
  unidadEspesor?: string | null;
}

interface ProductoLaserPrecioTableProps {
  medida: MedidaConfig;
  tintaId: string;
  tintaNombre: string;
  cantidades: number[];
  carasImpresas: string[];
  materialInfo?: MaterialInfo;
  preciosExistentes: Array<{
    cantidad: number;
    cara_impresa: string;
    precio: number;
  }>;
  onPreciosChange: (precios: Array<{
    cantidad: number;
    cara_impresa: string;
    precio: number;
  }>) => void;
}

const carasLabels: Record<string, string> = {
  solo_frente: 'Solo Frente',
  frente_y_dorso: 'Frente y Dorso',
};

export function ProductoLaserPrecioTable({
  medida,
  tintaId,
  tintaNombre,
  cantidades,
  carasImpresas,
  materialInfo,
  preciosExistentes,
  onPreciosChange,
}: ProductoLaserPrecioTableProps) {
  const [precios, setPrecios] = useState<PreciosCelda>({});

  useEffect(() => {
    // Inicializar precios desde los existentes
    const preciosIniciales: PreciosCelda = {};
    preciosExistentes.forEach((p) => {
      const key = `${p.cantidad}-${p.cara_impresa}`;
      preciosIniciales[key] = p.precio;
    });
    setPrecios(preciosIniciales);
  }, [preciosExistentes]);

  const handlePrecioChange = (cantidad: number, cara: string, valor: string) => {
    const key = `${cantidad}-${cara}`;
    const precio = parseFloat(valor);

    const nuevosPrecio = {
      ...precios,
      [key]: isNaN(precio) || precio <= 0 ? undefined : precio,
    };

    setPrecios(nuevosPrecio);

    // Convertir el objeto de precios a array para el callback
    const preciosArray = cantidades.flatMap((cant) =>
      carasImpresas
        .map((cara) => {
          const k = `${cant}-${cara}`;
          const p = nuevosPrecio[k];
          return p !== undefined && p > 0
            ? { cantidad: cant, cara_impresa: cara, precio: p }
            : null;
        })
        .filter((item) => item !== null)
    ) as Array<{ cantidad: number; cara_impresa: string; precio: number }>;

    onPreciosChange(preciosArray);
  };

  const getPrecio = (cantidad: number, cara: string): number | undefined => {
    const key = `${cantidad}-${cara}`;
    return precios[key];
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">
          {medida.ancho} × {medida.alto} mm - {tintaNombre}
        </h4>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                Cantidad
              </th>
              {carasImpresas.map((cara) => (
                <th
                  key={cara}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {carasLabels[cara] || cara}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cantidades.map((cantidad) => (
              <tr key={cantidad} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                  {cantidad}
                </td>
                {carasImpresas.map((cara) => (
                  <td key={`${cantidad}-${cara}`} className="px-4 py-3 whitespace-nowrap">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={getPrecio(cantidad, cara) || ''}
                      onChange={(e) => handlePrecioChange(cantidad, cara, e.target.value)}
                      className="w-32"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
