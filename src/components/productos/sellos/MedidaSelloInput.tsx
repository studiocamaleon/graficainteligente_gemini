import { Input } from '../../ui/Input';

interface MedidaSelloInputProps {
  ancho: number;
  alto: number;
  onAnchoChange: (value: number) => void;
  onAltoChange: (value: number) => void;
  error?: string;
}

export function MedidaSelloInput({
  ancho,
  alto,
  onAnchoChange,
  onAltoChange,
  error,
}: MedidaSelloInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Medidas (mm)
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Ancho</label>
          <Input
            type="number"
            min="0"
            step="1"
            value={ancho > 0 ? ancho : ''}
            onChange={(e) => onAnchoChange(parseFloat(e.target.value) || 0)}
            placeholder="Ej: 50"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Alto</label>
          <Input
            type="number"
            min="0"
            step="1"
            value={alto > 0 ? alto : ''}
            onChange={(e) => onAltoChange(parseFloat(e.target.value) || 0)}
            placeholder="Ej: 30"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-gray-500 mt-1">
        Ingresa las medidas del producto en milímetros
      </p>
    </div>
  );
}
