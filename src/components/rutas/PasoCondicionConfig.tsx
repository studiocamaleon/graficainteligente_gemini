import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Badge } from '../ui/Badge';
import { useServicios } from '../../hooks/useServicios';
import { useAcabados } from '../../hooks/useAcabados';
import { useTecnologias } from '../../hooks/useTecnologias';
import { usePasos } from '../../hooks/usePasos';
import { useServicioNiveles } from '../../hooks/useServicioNiveles';
import { useAcabadoNiveles } from '../../hooks/useAcabadoNiveles';
import { useTecnologiaTintas } from '../../hooks/useTecnologiaTintas';
import { NivelesPreviewList } from './NivelesPreviewList';
import { TintasPasosPreview } from './TintasPasosPreview';
import { TodasTecnologiasTintasPreview } from './TodasTecnologiasTintasPreview';
import type {
  TipoCondicionRuta,
  ConfiguracionCondicion,
  Servicio,
  Acabado,
  Tecnologia,
  TintaType,
} from '../../types/database';

interface PasoCondicionConfigProps {
  tipoCondicion: TipoCondicionRuta | null;
  configuracion: ConfiguracionCondicion;
  onConfigChange: (config: ConfiguracionCondicion) => void;
  onTipoChange: (tipo: TipoCondicionRuta) => void;
}

const TINTAS: TintaType[] = ['K', 'CMYK', 'CMYK+W', 'CMYK+V', 'CMYK+W+V'];

export function PasoCondicionConfig({
  tipoCondicion,
  configuracion,
  onConfigChange,
  onTipoChange,
}: PasoCondicionConfigProps) {
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [selectedAcabado, setSelectedAcabado] = useState<Acabado | null>(null);
  const [selectedTecnologia, setSelectedTecnologia] = useState<Tecnologia | null>(null);

  const { servicios } = useServicios({ itemsPerPage: 1000 });
  const { acabados } = useAcabados({ itemsPerPage: 1000 });
  const { tecnologias } = useTecnologias({ itemsPerPage: 1000 });
  const { pasos } = usePasos({ itemsPerPage: 10000 });

  const servicioIdConNivel = tipoCondicion === 'servicio_con_nivel' && 'servicio_id' in configuracion ? configuracion.servicio_id : null;
  const acabadoIdConNivel = tipoCondicion === 'acabado_con_nivel' && 'acabado_id' in configuracion ? configuracion.acabado_id : null;
  const tecnologiaIdTinta = tipoCondicion === 'tecnologia_tinta' && 'tecnologia_id' in configuracion ? configuracion.tecnologia_id : null;

  const { niveles: nivelesServicio, loading: loadingNivelesServicio, error: errorNivelesServicio, hasAllPasosAssigned: servicioNivelesCompleto } = useServicioNiveles(servicioIdConNivel);
  const { niveles: nivelesAcabado, loading: loadingNivelesAcabado, error: errorNivelesAcabado, hasAllPasosAssigned: acabadoNivelesCompleto } = useAcabadoNiveles(acabadoIdConNivel);
  const { tintas: tintasTecnologia, loading: loadingTintas, error: errorTintas, hasAllPasosAssigned: tecnologiaTintasCompleto } = useTecnologiaTintas(tecnologiaIdTinta);

  useEffect(() => {
    if (tipoCondicion === 'servicio_sin_nivel' && 'servicio_id' in configuracion) {
      const servicio = servicios.find((s) => s.id === configuracion.servicio_id);
      setSelectedServicio(servicio || null);
    } else if (tipoCondicion === 'servicio_con_nivel' && 'servicio_id' in configuracion) {
      const servicio = servicios.find((s) => s.id === configuracion.servicio_id);
      setSelectedServicio(servicio || null);
    } else if (tipoCondicion === 'acabado_sin_nivel' && 'acabado_id' in configuracion) {
      const acabado = acabados.find((a) => a.id === configuracion.acabado_id);
      setSelectedAcabado(acabado || null);
    } else if (tipoCondicion === 'acabado_con_nivel' && 'acabado_id' in configuracion) {
      const acabado = acabados.find((a) => a.id === configuracion.acabado_id);
      setSelectedAcabado(acabado || null);
    } else if (tipoCondicion === 'tecnologia_tinta' && 'tecnologia_id' in configuracion) {
      const tecnologia = tecnologias.find((t) => t.id === configuracion.tecnologia_id);
      setSelectedTecnologia(tecnologia || null);
    }
  }, [tipoCondicion, configuracion, servicios, acabados, tecnologias]);

  const handleTipoChange = (value: string) => {
    onTipoChange(value as TipoCondicionRuta);
    onConfigChange({});
    setSelectedServicio(null);
    setSelectedAcabado(null);
    setSelectedTecnologia(null);
  };

  const handleServicioSinNivelChange = (servicioId: string) => {
    onConfigChange({
      servicio_id: servicioId,
    });
  };

  const handleAcabadoSinNivelChange = (acabadoId: string) => {
    onConfigChange({
      acabado_id: acabadoId,
    });
  };

  const handleTecnologiaTintaChange = (field: 'tecnologia_id' | 'tinta', value: string) => {
    const currentConfig = configuracion as { tecnologia_id?: string; tinta?: TintaType };
    onConfigChange({
      tecnologia_id: field === 'tecnologia_id' ? value : currentConfig.tecnologia_id || '',
      tinta: field === 'tinta' ? (value as TintaType) : currentConfig.tinta || 'K',
    });
  };

  const serviciosSinNivelOptions = servicios
    .filter((s) => !s.tiene_niveles_precio)
    .map((s) => ({
      value: s.id,
      label: s.nombre,
    }));

  const serviciosConNivelOptions = servicios
    .filter((s) => s.tiene_niveles_precio)
    .map((s) => ({
      value: s.id,
      label: s.nombre,
    }));

  const acabadosSinNivelOptions = acabados
    .filter((a) => !a.tiene_niveles_precio)
    .map((a) => ({
      value: a.id,
      label: a.nombre,
    }));

  const acabadosConNivelOptions = acabados
    .filter((a) => a.tiene_niveles_precio)
    .map((a) => ({
      value: a.id,
      label: a.nombre,
    }));

  const tecnologiasOptions = tecnologias.map((t) => ({
    value: t.id,
    label: t.nombre,
  }));

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Condición *
        </label>
        <Select
          value={tipoCondicion || ''}
          onChange={handleTipoChange}
        >
          <option value="">Seleccionar tipo...</option>
          <option value="sin_condicion">Sin Condición (Obligatorio)</option>
          <option value="servicio_sin_nivel">Servicio Sin Nivel de Precio</option>
          <option value="servicio_con_nivel">Servicio Con Niveles de Precio</option>
          <option value="acabado_sin_nivel">Acabado Sin Nivel de Precio</option>
          <option value="acabado_con_nivel">Acabado Con Niveles de Precio</option>
          <option value="tecnologia_tinta">Tecnología + Tinta (Evaluación Automática)</option>
        </Select>
      </div>

      {tipoCondicion === 'servicio_sin_nivel' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Servicio *
          </label>
          <SearchableSelect
            options={serviciosSinNivelOptions}
            value={'servicio_id' in configuracion ? configuracion.servicio_id : ''}
            onChange={handleServicioSinNivelChange}
            placeholder="Seleccionar servicio..."
          />
          <p className="mt-2 text-sm text-gray-500">
            El paso asignado al servicio se ejecutará cuando el cliente elija este servicio.
          </p>
        </div>
      )}

      {tipoCondicion === 'servicio_con_nivel' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Servicio Con Niveles *
            </label>
            <SearchableSelect
              options={serviciosConNivelOptions}
              value={'servicio_id' in configuracion ? configuracion.servicio_id : ''}
              onChange={(servicioId) => {
                onConfigChange({
                  servicio_id: servicioId,
                  mapeo_niveles: {},
                });
              }}
              placeholder="Seleccionar servicio..."
            />
            <p className="mt-2 text-sm text-gray-500">
              Los pasos asignados a cada nivel de precio se ejecutarán según el nivel elegido por el cliente.
            </p>
          </div>

          {servicioIdConNivel && (
            <NivelesPreviewList
              niveles={nivelesServicio}
              loading={loadingNivelesServicio}
              error={errorNivelesServicio}
              tipo="servicio"
            />
          )}
        </div>
      )}

      {tipoCondicion === 'acabado_sin_nivel' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Acabado *
          </label>
          <SearchableSelect
            options={acabadosSinNivelOptions}
            value={'acabado_id' in configuracion ? configuracion.acabado_id : ''}
            onChange={handleAcabadoSinNivelChange}
            placeholder="Seleccionar acabado..."
          />
          <p className="mt-2 text-sm text-gray-500">
            El paso asignado al acabado se ejecutará cuando el cliente elija este acabado.
          </p>
        </div>
      )}

      {tipoCondicion === 'acabado_con_nivel' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Acabado Con Niveles *
            </label>
            <SearchableSelect
              options={acabadosConNivelOptions}
              value={'acabado_id' in configuracion ? configuracion.acabado_id : ''}
              onChange={(acabadoId) => {
                onConfigChange({
                  acabado_id: acabadoId,
                  mapeo_niveles: {},
                });
              }}
              placeholder="Seleccionar acabado..."
            />
            <p className="mt-2 text-sm text-gray-500">
              Los pasos asignados a cada nivel de precio se ejecutarán según el nivel elegido por el cliente.
            </p>
          </div>

          {acabadoIdConNivel && (
            <NivelesPreviewList
              niveles={nivelesAcabado}
              loading={loadingNivelesAcabado}
              error={errorNivelesAcabado}
              tipo="acabado"
            />
          )}
        </div>
      )}

      {tipoCondicion === 'tecnologia_tinta' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Evaluación automática de tecnología y tinta
                </p>
                <p className="text-xs text-blue-700">
                  Esta condición evaluará automáticamente la tecnología y el tipo de tinta del producto
                  seleccionado por el cliente. A continuación se muestran todas las combinaciones
                  configuradas en el sistema.
                </p>
              </div>
            </div>
          </div>

          <TodasTecnologiasTintasPreview />
        </div>
      )}

      {tipoCondicion === 'sin_condicion' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Este paso siempre se ejecutará como parte obligatoria de la ruta de producción.
          </p>
        </div>
      )}
    </div>
  );
}
