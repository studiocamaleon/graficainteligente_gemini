import { useState, useEffect } from 'react';
import { Search, Plus, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { usePasos } from '../../hooks/usePasos';
import type { Paso } from '../../types/database';

interface SelectedPaso {
  paso_id: string;
  paso: Paso;
  orden: number;
}

interface PasosSelectorProps {
  selectedPasos: SelectedPaso[];
  onChange: (pasos: SelectedPaso[]) => void;
}

export function PasosSelector({ selectedPasos, onChange }: PasosSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);

  const { pasos, loading } = usePasos({
    searchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  const availablePasos = pasos.filter(
    (paso) => !selectedPasos.some((sp) => sp.paso_id === paso.id)
  );

  const handleAddPaso = (paso: Paso) => {
    const newPaso: SelectedPaso = {
      paso_id: paso.id,
      paso,
      orden: selectedPasos.length + 1,
    };
    onChange([...selectedPasos, newPaso]);
  };

  const handleRemovePaso = (pasoId: string) => {
    const filtered = selectedPasos.filter((sp) => sp.paso_id !== pasoId);
    const reordered = filtered.map((sp, index) => ({
      ...sp,
      orden: index + 1,
    }));
    onChange(reordered);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newPasos = [...selectedPasos];
    [newPasos[index - 1], newPasos[index]] = [newPasos[index], newPasos[index - 1]];
    const reordered = newPasos.map((sp, idx) => ({
      ...sp,
      orden: idx + 1,
    }));
    onChange(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedPasos.length - 1) return;
    const newPasos = [...selectedPasos];
    [newPasos[index], newPasos[index + 1]] = [newPasos[index + 1], newPasos[index]];
    const reordered = newPasos.map((sp, idx) => ({
      ...sp,
      orden: idx + 1,
    }));
    onChange(reordered);
  };

  const getEtapaColor = (etapa: string) => {
    switch (etapa) {
      case 'Pre-prensa':
        return 'bg-purple-100 text-purple-700';
      case 'Produccion':
        return 'bg-blue-100 text-blue-700';
      case 'Terminacion':
        return 'bg-green-100 text-green-700';
      case 'Instalacion':
        return 'bg-orange-100 text-orange-700';
      case 'Entrega':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pasos del Flujo
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Selecciona y ordena los pasos que conforman este grupo
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsSelectMode(!isSelectMode)}
        >
          <Plus className="w-4 h-4" />
          {isSelectMode ? 'Cancelar' : 'Agregar Pasos'}
        </Button>
      </div>

      {isSelectMode && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar pasos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Cargando pasos...</p>
            ) : availablePasos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {searchTerm ? 'No se encontraron pasos' : 'Todos los pasos disponibles han sido agregados'}
              </p>
            ) : (
              availablePasos.map((paso) => (
                <button
                  key={paso.id}
                  type="button"
                  onClick={() => {
                    handleAddPaso(paso);
                    setSearchTerm('');
                  }}
                  className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{paso.nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getEtapaColor(paso.etapa)}`}>
                      {paso.etapa}
                    </span>
                  </div>
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selectedPasos.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500">
            No hay pasos seleccionados. Haz clic en "Agregar Pasos" para comenzar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedPasos.map((selected, index) => (
            <div
              key={selected.paso_id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className={`p-1 rounded transition-colors ${
                    index === 0
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Mover arriba"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === selectedPasos.length - 1}
                  className={`p-1 rounded transition-colors ${
                    index === selectedPasos.length - 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Mover abajo"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-semibold text-sm">
                {selected.orden}
              </div>

              <div className="flex-1 flex items-center gap-3">
                <span className="font-medium text-gray-900">{selected.paso.nombre}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getEtapaColor(selected.paso.etapa)}`}>
                  {selected.paso.etapa}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleRemovePaso(selected.paso_id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar paso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedPasos.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>{selectedPasos.length}</strong> paso{selectedPasos.length !== 1 ? 's' : ''} en el flujo
          </p>
        </div>
      )}
    </div>
  );
}
