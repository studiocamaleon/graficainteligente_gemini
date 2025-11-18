import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Tooltip } from '../ui/Tooltip';
import { usePasos } from '../../hooks/usePasos';
import type { TintaType, TecnologiaTintaPasoFormData } from '../../types/database';

interface TintasPasosConfigEditorProps {
  tintas: TintaType[];
  configuraciones: TecnologiaTintaPasoFormData[];
  onChange: (configuraciones: TecnologiaTintaPasoFormData[]) => void;
  errors?: Record<string, string>;
}

const TINTA_COLORS: Record<TintaType, string> = {
  'K': 'bg-gray-100 text-gray-700 border-gray-300',
  'CMYK': 'bg-blue-100 text-blue-700 border-blue-300',
  'CMYK+W': 'bg-green-100 text-green-700 border-green-300',
  'CMYK+V': 'bg-purple-100 text-purple-700 border-purple-300',
  'CMYK+W+V': 'bg-pink-100 text-pink-700 border-pink-300',
};

export function TintasPasosConfigEditor({
  tintas,
  configuraciones,
  onChange,
  errors = {},
}: TintasPasosConfigEditorProps) {
  const [pasoSearchTerm, setPasoSearchTerm] = useState('');

  const { pasos } = usePasos({
    searchTerm: pasoSearchTerm,
    isActive: true,
    itemsPerPage: 100,
  });

  useEffect(() => {
    const tintasEnConfig = configuraciones.map(c => c.tinta);
    const tintasFaltantes = tintas.filter(tinta => !tintasEnConfig.includes(tinta));

    if (tintasFaltantes.length > 0) {
      const nuevasConfiguraciones = [
        ...configuraciones,
        ...tintasFaltantes.map(tinta => ({
          tinta,
          paso_id: null,
        }))
      ];
      onChange(nuevasConfiguraciones);
    }

    const tintasEliminadas = configuraciones.filter(c => !tintas.includes(c.tinta));
    if (tintasEliminadas.length > 0) {
      const configuracionesFiltradas = configuraciones.filter(c => tintas.includes(c.tinta));
      onChange(configuracionesFiltradas);
    }
  }, [tintas, configuraciones, onChange]);

  const handleConfigChange = (tinta: TintaType, value: string | null) => {
    const updated = configuraciones.map((config) => {
      if (config.tinta === tinta) {
        return {
          ...config,
          paso_id: value,
        };
      }
      return config;
    });
    onChange(updated);
  };

  const getTintaConfig = (tinta: TintaType) => {
    return configuraciones.find((c) => c.tinta === tinta) || {
      tinta,
      paso_id: null,
    };
  };

  const isConfigComplete = (config: TecnologiaTintaPasoFormData) => {
    return config.paso_id !== null;
  };

  const tintasConfiguradas = configuraciones.filter(isConfigComplete).length;
  const tintasTotal = tintas.length;
  const todasConfiguradas = tintasConfiguradas === tintasTotal && tintasTotal > 0;

  const pasoOptions = pasos.map((paso) => ({
    value: paso.id,
    label: `${paso.nombre} (${paso.etapa})`,
  }));

  if (tintas.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          Primero selecciona al menos una tinta para configurar los pasos de producción
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Configuración de Pasos por Tinta
              <span className="text-red-500 ml-1">*</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Asigna un paso de producción a cada tipo de tinta disponible
            </p>
          </div>
          <Tooltip
            content="Esta configuración define qué paso se ejecutará cuando se use cada tipo de tinta. Es obligatorio configurar todas las tintas antes de guardar. Luego podrás usar estas configuraciones en las rutas de producción condicionales de los productos."
            icon
          />
        </div>
        <div className="flex items-center gap-2">
          {todasConfiguradas ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle className="w-5 h-5" />
              <span>Completo</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-600 text-sm font-medium">
              <AlertCircle className="w-5 h-5" />
              <span>{tintasConfiguradas}/{tintasTotal} configuradas</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {tintas.map((tinta) => {
          const config = getTintaConfig(tinta);
          const isComplete = isConfigComplete(config);

          return (
            <div
              key={tinta}
              className={`p-4 border-2 rounded-lg ${
                isComplete
                  ? 'border-green-200 bg-green-50'
                  : 'border-orange-200 bg-orange-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center flex-shrink-0 pt-1">
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${TINTA_COLORS[tinta]}`}
                    >
                      {tinta}
                    </span>
                    {!isComplete && (
                      <span className="text-xs text-orange-600 font-medium">
                        Pendiente de configuración
                      </span>
                    )}
                  </div>

                  <SearchableSelect
                    label="Paso Asociado"
                    value={config.paso_id || ''}
                    onChange={(value) => handleConfigChange(tinta, value || null)}
                    onSearch={setPasoSearchTerm}
                    options={pasoOptions}
                    placeholder="Buscar paso..."
                    emptyMessage="No se encontraron pasos"
                  />

                  <p className="text-xs text-gray-500">
                    Selecciona el paso asociado a esta configuración de tinta
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!todasConfiguradas && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-700">
            <strong>Atención:</strong> Todas las tintas deben tener un paso asignado antes de poder guardar la tecnología.
          </p>
        </div>
      )}

      {todasConfiguradas && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>
              <strong>Configuración completa.</strong> Esta tecnología está lista para ser utilizada en rutas de producción condicionales.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
