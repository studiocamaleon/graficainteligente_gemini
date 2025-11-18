import { useState, useEffect } from 'react';
import { useTecnologias } from '../../../hooks/useTecnologias';
import { useTecnologiaTintas } from '../../../hooks/useTecnologiaTintas';
import { SearchableSelect } from '../../ui/SearchableSelect';
import { InkBadge } from '../../ui/InkBadge';
import { X } from 'lucide-react';

interface TecnologiaTintasPortabannerSelectorProps {
  tecnologiaId: string;
  tintas: string[];
  onTecnologiaChange: (tecnologiaId: string) => void;
  onTintasChange: (tintas: string[]) => void;
  errorTecnologia?: string;
  errorTintas?: string;
}

export function TecnologiaTintasPortabannerSelector({
  tecnologiaId,
  tintas,
  onTecnologiaChange,
  onTintasChange,
  errorTecnologia,
  errorTintas,
}: TecnologiaTintasPortabannerSelectorProps) {
  const { tecnologias, isLoading: isLoadingTecnologias } = useTecnologias();
  const { tintas: tintasDisponibles, isLoading: isLoadingTintas } = useTecnologiaTintas(tecnologiaId);
  const [tintaSeleccionada, setTintaSeleccionada] = useState('');

  useEffect(() => {
    if (!tecnologiaId) {
      onTintasChange([]);
    }
  }, [tecnologiaId]);

  const handleAgregarTinta = () => {
    if (tintaSeleccionada && !tintas.includes(tintaSeleccionada)) {
      onTintasChange([...tintas, tintaSeleccionada]);
      setTintaSeleccionada('');
    }
  };

  const handleEliminarTinta = (tinta: string) => {
    onTintasChange(tintas.filter((t) => t !== tinta));
  };

  const tintasOptions = tintasDisponibles.filter((t) => !tintas.includes(t));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Tecnología de Impresión</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tecnología
          <span className="text-red-500 ml-1">*</span>
        </label>
        <SearchableSelect
          value={tecnologiaId}
          onChange={onTecnologiaChange}
          options={tecnologias.map((t) => ({
            value: t.id,
            label: t.nombre,
          }))}
          placeholder="Seleccionar tecnología..."
          isLoading={isLoadingTecnologias}
        />
        {errorTecnologia && <p className="text-sm text-red-600 mt-1">{errorTecnologia}</p>}
      </div>

      {tecnologiaId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tintas según tecnología
            <span className="text-red-500 ml-1">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={tintaSeleccionada}
              onChange={(e) => setTintaSeleccionada(e.target.value)}
              disabled={isLoadingTintas || tintasOptions.length === 0}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">
                {isLoadingTintas
                  ? 'Cargando...'
                  : tintasOptions.length === 0
                  ? 'No hay tintas disponibles'
                  : 'Seleccionar tinta...'}
              </option>
              {tintasOptions.map((tinta) => (
                <option key={tinta} value={tinta}>
                  {tinta}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAgregarTinta}
              disabled={!tintaSeleccionada || isLoadingTintas}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Agregar
            </button>
          </div>

          {tintas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tintas.map((tinta) => (
                <div
                  key={tinta}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg"
                >
                  <InkBadge tinta={tinta} />
                  <button
                    type="button"
                    onClick={() => handleEliminarTinta(tinta)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {errorTintas && <p className="text-sm text-red-600 mt-1">{errorTintas}</p>}

          {tintas.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Selecciona al menos una tinta para esta tecnología
            </p>
          )}
        </div>
      )}
    </div>
  );
}
