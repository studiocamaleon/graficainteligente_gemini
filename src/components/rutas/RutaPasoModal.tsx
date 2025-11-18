import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Switch } from '../ui/Switch';
import { PasoCondicionConfig } from './PasoCondicionConfig';
import { usePasos } from '../../hooks/usePasos';
import { useRutaPasos } from '../../hooks/useRutaPasos';
import type {
  RutaProduccionPaso,
  RutaProduccionPasoFormData,
  EtapaPaso,
  TipoCondicionRuta,
  ConfiguracionCondicion,
} from '../../types/database';

interface RutaPasoModalProps {
  rutaId: string;
  etapa: EtapaPaso;
  paso?: RutaProduccionPaso;
  onClose: () => void;
  onSuccess: () => void;
}

export function RutaPasoModal({ rutaId, etapa, paso, onClose, onSuccess }: RutaPasoModalProps) {
  const { pasos: pasosDisponibles, loading: loadingPasos } = usePasos({ itemsPerPage: 1000 });
  const { addPaso, updatePaso, pasos: pasosRuta } = useRutaPasos({ rutaId, etapa: null });

  const [tipoPaso, setTipoPaso] = useState<'obligatorio' | 'condicional'>('obligatorio');
  const [pasoId, setPasoId] = useState<string | null>(null);
  const [tipoCondicion, setTipoCondicion] = useState<TipoCondicionRuta | null>(null);
  const [configuracionCondicion, setConfiguracionCondicion] = useState<ConfiguracionCondicion>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (paso) {
      setPasoId(paso.paso_id || null);
      setTipoPaso(paso.es_obligatorio ? 'obligatorio' : 'condicional');
      setTipoCondicion(paso.tipo_condicion);
      setConfiguracionCondicion(paso.configuracion_condicion || {});
    }
  }, [paso]);

  const getNextOrden = (): number => {
    const pasosEtapa = pasosRuta.filter((p) => p.etapa === etapa);
    if (pasosEtapa.length === 0) return 0;
    return Math.max(...pasosEtapa.map((p) => p.orden)) + 1;
  };

  const validateForm = (): boolean => {
    const esObligatorio = tipoPaso === 'obligatorio';

    if (tipoPaso === 'condicional' && !tipoCondicion) {
      setError('Los pasos condicionales requieren un tipo de condición');
      return false;
    }

    if (tipoPaso === 'condicional' && tipoCondicion) {
      if (tipoCondicion === 'servicio_sin_nivel' && !('servicio_id' in configuracionCondicion)) {
        setError('Debes seleccionar un servicio');
        return false;
      }
      if (tipoCondicion === 'servicio_con_nivel' && !('servicio_id' in configuracionCondicion)) {
        setError('Debes seleccionar un servicio con niveles');
        return false;
      }
      if (tipoCondicion === 'acabado_sin_nivel' && !('acabado_id' in configuracionCondicion)) {
        setError('Debes seleccionar un acabado');
        return false;
      }
      if (tipoCondicion === 'acabado_con_nivel' && !('acabado_id' in configuracionCondicion)) {
        setError('Debes seleccionar un acabado con niveles');
        return false;
      }
      if (tipoCondicion === 'tecnologia_tinta') {
        if (!('tecnologia_id' in configuracionCondicion)) {
          setError('Debes seleccionar una tecnología');
          return false;
        }
      }
    }

    const requierePasoUnico = tipoPaso === 'obligatorio' ||
      tipoCondicion === 'servicio_sin_nivel' ||
      tipoCondicion === 'acabado_sin_nivel';

    if (requierePasoUnico && !pasoId) {
      setError('Debes seleccionar un paso');
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const esObligatorio = tipoPaso === 'obligatorio';

      const usaMapeoMultiple = tipoCondicion === 'servicio_con_nivel' ||
        tipoCondicion === 'acabado_con_nivel' ||
        tipoCondicion === 'tecnologia_tinta';

      const formData: RutaProduccionPasoFormData = {
        etapa,
        paso_id: usaMapeoMultiple ? null : pasoId,
        orden: paso ? paso.orden : getNextOrden(),
        es_obligatorio: esObligatorio,
        tipo_condicion: esObligatorio ? 'sin_condicion' : tipoCondicion,
        configuracion_condicion: esObligatorio ? {} : configuracionCondicion,
      };

      let success = false;

      if (paso) {
        success = await updatePaso(paso.id, formData);
      } else {
        success = await addPaso(formData);
      }

      if (success) {
        onSuccess();
      } else {
        setError('Error al guardar el paso. Intenta nuevamente.');
      }
    } catch (err) {
      console.error('Error saving paso:', err);
      setError('Error inesperado al guardar el paso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pasosOptions = pasosDisponibles.map((p) => ({
    value: p.id,
    label: `${p.nombre} ${p.codigo ? `(${p.codigo})` : ''}`,
  }));

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={paso ? 'Editar Paso' : `Agregar Paso a ${etapa}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-900 mb-1">
                1. Tipo de Paso *
              </label>
              <p className="text-xs text-blue-700">
                {tipoPaso === 'obligatorio'
                  ? 'Este paso siempre se ejecutará como parte de la ruta'
                  : 'Este paso se ejecutará solo cuando se cumplan ciertas condiciones'}
              </p>
            </div>
            <Switch
              checked={tipoPaso === 'obligatorio'}
              onChange={(checked) => {
                setTipoPaso(checked ? 'obligatorio' : 'condicional');
                if (checked) {
                  setTipoCondicion(null);
                  setConfiguracionCondicion({});
                }
              }}
              label={tipoPaso === 'obligatorio' ? 'Obligatorio' : 'Condicional'}
            />
          </div>
        </div>

        {tipoPaso === 'condicional' && (
          <div className="border-2 border-amber-200 bg-amber-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-900 mb-1">
              2. Configuración de Condición *
            </h4>
            <p className="text-xs text-amber-700 mb-4">
              Define cuándo se debe ejecutar este paso
            </p>
            <PasoCondicionConfig
              tipoCondicion={tipoCondicion}
              configuracion={configuracionCondicion}
              onConfigChange={setConfiguracionCondicion}
              onTipoChange={setTipoCondicion}
            />
          </div>
        )}

        {(tipoPaso === 'obligatorio' ||
          tipoCondicion === 'servicio_sin_nivel' ||
          tipoCondicion === 'acabado_sin_nivel') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tipoPaso === 'condicional' ? '3. Seleccionar Paso *' : '2. Seleccionar Paso *'}
            </label>
            <SearchableSelect
              options={pasosOptions}
              value={pasoId}
              onChange={setPasoId}
              placeholder={loadingPasos ? 'Cargando pasos...' : 'Seleccionar paso...'}
              disabled={loadingPasos || isSubmitting}
              loading={loadingPasos}
            />
            <p className="mt-2 text-xs text-gray-500">
              Selecciona el paso específico que se ejecutará {tipoPaso === 'condicional' ? 'cuando se cumpla la condición' : 'en esta etapa'}
            </p>
          </div>
        )}

        {tipoPaso === 'condicional' && (
          tipoCondicion === 'servicio_con_nivel' ||
          tipoCondicion === 'acabado_con_nivel' ||
          tipoCondicion === 'tecnologia_tinta'
        ) && (
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>No se requiere seleccionar un paso.</strong>
              <br />
              Los pasos se ejecutarán automáticamente según la configuración previamente definida en ABM Core.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || loadingPasos}>
            {isSubmitting ? 'Guardando...' : paso ? 'Actualizar Paso' : 'Agregar Paso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
