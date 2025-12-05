import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useServicios } from '../../hooks/useServicios';
import { useServicioNiveles } from '../../hooks/useServicioNiveles';
import { useServiciosAcabadosCompartidos } from '../../hooks/useServiciosAcabadosCompartidos';
import type { MetodoProrrateo } from '../../hooks/useServiciosAcabadosCompartidos';
import { calculateSharedServiceProration } from '../../utils/sharedServiceProration';
import type { ItemForProration } from '../../utils/sharedServiceProration';

interface AddServicioCompartidoModalProps {
  tipo: 'orden' | 'presupuesto';
  id: string;
  items: ItemForProration[];
  onClose: () => void;
  onSuccess: (data: any) => void;
  modoCreacion?: boolean;
}

export function AddServicioCompartidoModal({
  tipo,
  id,
  items,
  onClose,
  onSuccess,
  modoCreacion = false
}: AddServicioCompartidoModalProps) {
  const { servicios, refetch: refetchServicios } = useServicios();
  const { niveles, fetchNivelesByServicio } = useServicioNiveles();

  // Solo usar el hook de compartidos si NO estamos en modo creación
  const compartidosHook = modoCreacion
    ? { addServicioCompartido: async () => {} }
    : useServiciosAcabadosCompartidos({ tipo, id });
  const { addServicioCompartido } = compartidosHook;

  const [servicioId, setServicioId] = useState('');
  const [nivelId, setNivelId] = useState('');
  const [metodoProrrateo, setMetodoProrrateo] = useState<MetodoProrrateo>('proporcional');
  const [precioTotal, setPrecioTotal] = useState('');
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    refetchServicios();
  }, [refetchServicios]);

  useEffect(() => {
    if (servicioId) {
      fetchNivelesByServicio(servicioId);
      setNivelId('');
    }
  }, [servicioId, fetchNivelesByServicio]);

  const servicioSeleccionado = servicios.find(s => s.id === servicioId);
  const serviciosDisponibles = servicios.filter(s => s.alcance === 'grupo');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!servicioId) {
      setError('Debes seleccionar un servicio');
      return;
    }

    const precio = parseFloat(precioTotal);
    if (isNaN(precio) || precio <= 0) {
      setError('El precio debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const prorrateos = calculateSharedServiceProration({
        items,
        costoTotal: precio,
        metodo: metodoProrrateo
      });

      const configuracion: Record<string, any> = {};
      if (nivelId) {
        configuracion.nivel_id = nivelId;
      }

      if (modoCreacion) {
        // Modo creación: devolver datos al componente padre
        onSuccess({
          servicio_id: servicioId,
          servicio_nombre: servicioSeleccionado?.nombre || 'Servicio',
          configuracion,
          metodo_prorrateo: metodoProrrateo,
          precio_total: precio,
          notas: notas.trim() || undefined
        });
        onClose();
      } else {
        // Modo edición: guardar en BD
        await addServicioCompartido({
          servicio_id: servicioId,
          configuracion,
          metodo_prorrateo: metodoProrrateo,
          prorrateos,
          precio_total: precio,
          notas: notas.trim() || undefined
        });
        onSuccess({});
        onClose();
      }
    } catch (err) {
      console.error('Error adding servicio compartido:', err);
      setError(err instanceof Error ? err.message : 'Error al agregar servicio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Agregar Servicio Compartido"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">¿Qué es un servicio compartido?</p>
              <p>
                Un servicio compartido es un servicio que aplica a toda la {tipo === 'orden' ? 'orden' : 'presupuesto'}
                y su costo se distribuye automáticamente entre todos los items según el método de prorrateo seleccionado.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Servicio *
          </label>
          <SearchableSelect
            value={servicioId}
            onChange={setServicioId}
            options={serviciosDisponibles.map(s => ({
              value: s.id,
              label: s.nombre
            }))}
            placeholder="Buscar servicio..."
            emptyMessage="No hay servicios con alcance grupal disponibles"
          />
          {serviciosDisponibles.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Solo se muestran servicios con alcance "grupo"
            </p>
          )}
        </div>

        {niveles.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nivel del Servicio
            </label>
            <Select
              value={nivelId}
              onChange={(e) => setNivelId(e.target.value)}
            >
              <option value="">Sin nivel específico</option>
              {niveles.map(nivel => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.nombre} - ${nivel.precio_fijo?.toFixed(2) || '0.00'}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Método de Prorrateo *
          </label>
          <Select
            value={metodoProrrateo}
            onChange={(e) => setMetodoProrrateo(e.target.value as MetodoProrrateo)}
          >
            <option value="proporcional">
              Proporcional - Según el precio de cada item
            </option>
            <option value="uniforme">
              Uniforme - Dividido en partes iguales
            </option>
            <option value="manual">
              Manual - Definir manualmente (próximamente)
            </option>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            {metodoProrrateo === 'proporcional' && 'El costo se distribuye proporcionalmente al precio de cada item'}
            {metodoProrrateo === 'uniforme' && 'El costo se divide en partes iguales entre todos los items'}
            {metodoProrrateo === 'manual' && 'Podrás definir manualmente cuánto corresponde a cada item'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precio Total *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={precioTotal}
            onChange={(e) => setPrecioTotal(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Notas adicionales..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Agregando...' : 'Agregar Servicio'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
