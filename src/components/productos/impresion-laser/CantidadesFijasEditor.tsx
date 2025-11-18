import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';

interface CantidadesFijasEditorProps {
  cantidades: number[];
  onChange: (cantidades: number[]) => void;
  error?: string;
}

export function CantidadesFijasEditor({
  cantidades,
  onChange,
  error,
}: CantidadesFijasEditorProps) {
  const [inputValue, setInputValue] = useState('');

  const agregarCantidad = () => {
    const cantidad = parseInt(inputValue);
    if (!isNaN(cantidad) && cantidad > 0 && !cantidades.includes(cantidad)) {
      onChange([...cantidades, cantidad].sort((a, b) => a - b));
      setInputValue('');
    }
  };

  const eliminarCantidad = (cantidad: number) => {
    onChange(cantidades.filter((c) => c !== cantidad));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarCantidad();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Cantidades Disponibles
      </label>

      <div className="flex gap-2">
        <Input
          type="number"
          min="1"
          step="1"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ej: 100"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={agregarCantidad}
          disabled={!inputValue || parseInt(inputValue) <= 0}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {cantidades.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cantidades.map((cantidad) => (
            <Badge key={cantidad} variant="secondary" className="flex items-center gap-1">
              {cantidad}
              <button
                type="button"
                onClick={() => eliminarCantidad(cantidad)}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {cantidades.length === 0 && (
        <p className="text-xs text-gray-500">
          Agrega las cantidades fijas disponibles para este producto
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
