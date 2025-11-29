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
    console.log('[RutaPasoModal] Validando formulario...');
    const esObligatorio = tipoPaso === 'obligatorio';
    console.log('[RutaPasoModal] ¿Es obligatorio?:', esObligatorio);

    if (tipoPaso === 'condicional' && !tipoCondicion) {
      console.log('[RutaPasoModal] ❌ Error: Paso condicional sin tipo de condición');
      setError('Los pasos condicionales requieren un tipo de condición');
      return false;
    }

    if (tipoPaso === 'condicional' && tipoCondicion) {
      console.log('[RutaPasoModal] Validando tipo de condición:', tipoCondicion);

      if (tipoCondicion === 'servicio_sin_nivel' && !('servicio_id' in configuracionCondicion)) {
        console.log('[RutaPasoModal] ❌ Error: Servicio sin nivel sin servicio_id');
        setError('Debes seleccionar un servicio');
        return false;
      }
      if (tipoCondicion === 'servicio_con_nivel' && !('servicio_id' in configuracionCondicion)) {
        console.log('[RutaPasoModal] ❌ Error: Servicio con nivel sin servicio_id');
        setError('Debes seleccionar un servicio con niveles');
        return false;
      }
      if (tipoCondicion === 'servicio_con_nivel' && 'servicio_id' in configuracionCondicion) {
        const servicioId = configuracionCondicion.servicio_id;
        if (!servicioId || servicioId.trim() === '') {
          console.log('[RutaPasoModal] ❌ Error: servicio_id está vacío');
          setError('Debes seleccionar un servicio con niveles válido');
          return false;
        }
        console.log('[RutaPasoModal] ✅ Servicio con nivel válido:', servicioId);
      }
      if (tipoCondicion === 'acabado_sin_nivel' && !('acabado_id' in configuracionCondicion)) {
        console.log('[RutaPasoModal] ❌ Error: Acabado sin nivel sin acabado_id');
        setError('Debes seleccionar un acabado');
        return false;
      }
      if (tipoCondicion === 'acabado_con_nivel' && !('acabado_id' in configuracionCondicion)) {
        console.log('[RutaPasoModal] ❌ Error: Acabado con nivel sin acabado_id');
        setError('Debes seleccionar un acabado con niveles');
        return false;
      }
      if (tipoCondicion === 'tecnologia_tinta') {
        console.log('[RutaPasoModal] ✅ Tecnología tinta válida (evaluación automática)');
      }
    }

    const requierePasoUnico = tipoPaso === 'obligatorio' ||
      tipoCondicion === 'servicio_sin_nivel' ||
      tipoCondicion === 'acabado_sin_nivel';

    console.log('[RutaPasoModal] ¿Requiere paso único?:', requierePasoUnico);

    if (requierePasoUnico && !pasoId) {
      console.log('[RutaPasoModal] ❌ Error: Requiere paso único pero no hay pasoId');
      setError('Debes seleccionar un paso');
      return false;
    }

    console.log('[RutaPasoModal] ✅ Todas las validaciones pasaron');
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('[RutaPasoModal] ===== INICIO DE SUBMIT =====');
    console.log('[RutaPasoModal] Etapa seleccionada:', etapa);
    console.log('[RutaPasoModal] Tipo de paso:', tipoPaso);
    console.log('[RutaPasoModal] Tipo de condición:', tipoCondicion);
    console.log('[RutaPasoModal] Paso ID seleccionado:', pasoId);
    console.log('[RutaPasoModal] Configuración condición:', configuracionCondicion);
    console.log('[RutaPasoModal] ¿Es edición?:', !!paso);

    if (!validateForm()) {
      console.log('[RutaPasoModal] ❌ Validación fallida');
      return;
    }

    console.log('[RutaPasoModal] ✅ Validación exitosa');
    setIsSubmitting(true);

    try {
      const esObligatorio = tipoPaso === 'obligatorio';

      const usaMapeoMultiple = tipoCondicion === 'servicio_con_nivel' ||
        tipoCondicion === 'acabado_con_nivel' ||
        tipoCondicion === 'tecnologia_tinta';

      const ordenCalculado = paso ? paso.orden : getNextOrden();
      console.log('[RutaPasoModal] Orden calculado:', ordenCalculado);
      console.log('[RutaPasoModal] Pasos actuales en esta etapa:', pasosRuta.filter((p) => p.etapa === etapa).length);

      const formData: RutaProduccionPasoFormData = {
        etapa,
        paso_id: usaMapeoMultiple ? null : pasoId,
        orden: ordenCalculado,
        es_obligatorio: esObligatorio,
        tipo_condicion: esObligatorio ? 'sin_condicion' : tipoCondicion,
        configuracion_condicion: esObligatorio ? {} : configuracionCondicion,
      };

      console.log('[RutaPasoModal] FormData preparado:', JSON.stringify(formData, null, 2));

      let success = false;

      if (paso) {
        console.log('[RutaPasoModal] Actualizando paso existente:', paso.id);
        success = await updatePaso(paso.id, formData);
      } else {
        console.log('[RutaPasoModal] Agregando nuevo paso...');
        success = await addPaso(formData);
      }

      console.log('[RutaPasoModal] Resultado de operación:', success ? '✅ ÉXITO' : '❌ FALLO');

      if (success) {
        console.log('[RutaPasoModal] Llamando onSuccess()');
        onSuccess();
      } else {
        const errorMsg = 'Error al guardar el paso. Revisa los detalles en la consola.';
        console.error('[RutaPasoModal]', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('[RutaPasoModal] ❌ ERROR INESPERADO:', err);
      console.error('[RutaPasoModal] Stack trace:', err instanceof Error ? err.stack : 'N/A');
      setError(`Error inesperado: ${err instanceof Error ? err.message : 'Desconocido'}`);
    } finally {
      setIsSubmitting(false);
      console.log('[RutaPasoModal] ===== FIN DE SUBMIT =====');
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
