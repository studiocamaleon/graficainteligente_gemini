import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';

export interface Medida {
  ancho: number;
  alto: number;
}

interface MedidasEditorProps {
  medidas: Medida[];
  onChange: (medidas: Medida[]) => void;
  error?: string;
}

export function MedidasEditor({ medidas, onChange, error }: MedidasEditorProps) {
  const agregarMedida = () => {
    onChange([...medidas, { ancho: 0, alto: 0 }]);
  };

  const eliminarMedida = (index: number) => {
    onChange(medidas.filter((_, i) => i !== index));
  };

  const actualizarMedida = (index: number, campo: 'ancho' | 'alto', valor: string) => {
    const nuevoValor = parseFloat(valor) || 0;
    const nuevasMedidas = [...medidas];
    nuevasMedidas[index] = { ...nuevasMedidas[index], [campo]: nuevoValor };
    onChange(nuevasMedidas);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Medidas Disponibles
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={agregarMedida}
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar Medida
        </Button>
      </div>

      {medidas.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500">No hay medidas agregadas</p>
          <p className="text-xs text-gray-400 mt-1">Haz clic en "Agregar Medida" para comenzar</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2">
            <div className="col-span-5">Ancho (mm)</div>
            <div className="col-span-5">Alto (mm)</div>
            <div className="col-span-2"></div>
          </div>
          {medidas.map((medida, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={medida.ancho || ''}
                  onChange={(e) => actualizarMedida(index, 'ancho', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-5">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={medida.alto || ''}
                  onChange={(e) => actualizarMedida(index, 'alto', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => eliminarMedida(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
