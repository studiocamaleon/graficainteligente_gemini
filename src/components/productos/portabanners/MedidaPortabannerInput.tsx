import { Input } from '../../ui/card';

interface MedidaPortabannerInputProps {
  ancho: number | undefined;
  alto: number | undefined;
  onAnchoChange: (value: number | undefined) => void;
  onAltoChange: (value: number | undefined) => void;
  errorAncho?: string;
  errorAlto?: string;
}

export function MedidaPortabannerInput({
  ancho,
  alto,
  onAnchoChange,
  onAltoChange,
  errorAncho,
  errorAlto,
}: MedidaPortabannerInputProps) {
  const handleAnchoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onAnchoChange(undefined);
    } else {
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) {
        onAnchoChange(num);
      }
    }
  };

  const handleAltoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onAltoChange(undefined);
    } else {
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) {
        onAltoChange(num);
      }
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Medidas del Portabanner</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ancho (cm)
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={ancho ?? ''}
            onChange={handleAnchoChange}
            placeholder="Ej: 85"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errorAncho && <p className="text-sm text-red-600 mt-1">{errorAncho}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alto (cm)
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={alto ?? ''}
            onChange={handleAltoChange}
            placeholder="Ej: 200"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errorAlto && <p className="text-sm text-red-600 mt-1">{errorAlto}</p>}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Ingresa el ancho y alto del portabanner en centímetros. Por ejemplo: 85 x 200 cm
      </p>
    </div>
  );
}
