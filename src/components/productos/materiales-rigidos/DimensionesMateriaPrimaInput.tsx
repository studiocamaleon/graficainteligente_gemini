import { Input } from '../../ui/Input';

interface DimensionesMateriaPrimaInputProps {
  ancho: number;
  alto: number;
  onChange: (ancho: number, alto: number) => void;
  error?: string;
}

export function DimensionesMateriaPrimaInput({
  ancho,
  alto,
  onChange,
  error,
}: DimensionesMateriaPrimaInputProps) {
  const handleAnchoChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange(numValue, alto);
  };

  const handleAltoChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onChange(ancho, numValue);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Dimensión de Materia Prima
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Ancho (cm)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={ancho || ''}
            onChange={(e) => handleAnchoChange(e.target.value)}
            placeholder="Ej: 100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Alto (cm)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={alto || ''}
            onChange={(e) => handleAltoChange(e.target.value)}
            placeholder="Ej: 200"
          />
        </div>
      </div>
      {ancho > 0 && alto > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          Dimensión: {ancho} x {alto} cm
        </p>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
