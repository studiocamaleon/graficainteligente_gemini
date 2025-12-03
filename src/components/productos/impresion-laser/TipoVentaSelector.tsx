import { CantidadesFijasEditor } from './CantidadesFijasEditor';

interface TipoVentaSelectorProps {
  tipoVenta: 'unidades' | 'cantidades_fijas';
  cantidadesFijas: number[];
  onTipoVentaChange: (tipo: 'unidades' | 'cantidades_fijas') => void;
  onCantidadesFijasChange: (cantidades: number[]) => void;
  errors?: {
    tipoVenta?: string;
    cantidadesFijas?: string;
  };
}

export function TipoVentaSelector({
  tipoVenta,
  cantidadesFijas,
  onTipoVentaChange,
  onCantidadesFijasChange,
  errors,
}: TipoVentaSelectorProps) {
  const opciones = [
    { value: 'unidades', label: 'Por Unidades', descripcion: 'Venta por cantidad de piezas (requiere asociar rango de precios)' },
    {
      value: 'cantidades_fijas',
      label: 'Por Cantidades Fijas',
      descripcion: 'Solo cantidades predefinidas',
    },
  ] as const;

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Tipo de Venta
        <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="space-y-2">
        {opciones.map((opcion) => {
          const isSelected = tipoVenta === opcion.value;
          return (
            <button
              key={opcion.value}
              type="button"
              onClick={() => onTipoVentaChange(opcion.value)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {opcion.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    {opcion.descripcion}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {errors?.tipoVenta && (
        <p className="text-sm text-red-600">{errors.tipoVenta}</p>
      )}

      {tipoVenta === 'cantidades_fijas' && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <CantidadesFijasEditor
            cantidades={cantidadesFijas}
            onChange={onCantidadesFijasChange}
            error={errors?.cantidadesFijas}
          />
        </div>
      )}
    </div>
  );
}
