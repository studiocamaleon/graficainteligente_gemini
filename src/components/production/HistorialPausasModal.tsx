import { useState, useEffect } from 'react';
import { Clock, User, Play, Pause, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Pausa {
  id: string;
  motivo_pausa_id: string;
  categoria_motivo: string;
  descripcion: string | null;
  fecha_inicio_pausa: string;
  fecha_fin_pausa: string | null;
  duracion_minutos: number | null;
  pausado_por: string | null;
  reanudado_por: string | null;
  motivo: {
    nombre: string;
    color: string;
  } | null;
  pausado_por_profile: {
    nombre: string;
    apellido: string;
  } | null;
  reanudado_por_profile: {
    nombre: string;
    apellido: string;
  } | null;
}

interface HistorialPausasModalProps {
  isOpen: boolean;
  onClose: () => void;
  rutaId: string;
  pasoNombre: string;
}

export function HistorialPausasModal({
  isOpen,
  onClose,
  rutaId,
  pasoNombre,
}: HistorialPausasModalProps) {
  const [pausas, setPausas] = useState<Pausa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      cargarHistorial();
    }
  }, [isOpen, rutaId]);

  const cargarHistorial = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('ordenes_items_rutas_pausas')
        .select(
          `
          *,
          motivo:pasos_motivos_pausa!motivo_pausa_id(nombre, color),
          pausado_por_profile:profiles!pausado_por(nombre, apellido),
          reanudado_por_profile:profiles!reanudado_por(nombre, apellido)
        `
        )
        .eq('ruta_id', rutaId)
        .order('fecha_inicio_pausa', { ascending: false });

      if (error) throw error;

      setPausas(data || []);
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuracion = (minutos: number | null) => {
    if (!minutos) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas === 0) return `${mins} min`;
    return `${horas}h ${mins}min`;
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'cliente':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'materiales':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'maquinaria':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'personal':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'externo':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      cliente: 'Cliente',
      materiales: 'Materiales',
      maquinaria: 'Maquinaria',
      personal: 'Personal',
      externo: 'Externo',
      otro: 'Otro',
    };
    return labels[categoria] || 'Otro';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Historial de Pausas: ${pasoNombre}`}
      size="lg"
    >
      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Cargando historial...</p>
        </div>
      ) : pausas.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin pausas registradas</p>
          <p className="text-sm text-gray-400 mt-1">
            Este paso no ha sido pausado aún
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Timeline */}
          <div className="relative">
            {pausas.map((pausa, index) => {
              const isActiva = !pausa.fecha_fin_pausa;
              const pausadoPor = pausa.pausado_por_profile
                ? `${pausa.pausado_por_profile.nombre} ${pausa.pausado_por_profile.apellido}`
                : 'Desconocido';
              const reanudadoPor = pausa.reanudado_por_profile
                ? `${pausa.reanudado_por_profile.nombre} ${pausa.reanudado_por_profile.apellido}`
                : null;

              return (
                <div key={pausa.id} className="relative pl-8 pb-8 last:pb-0">
                  {/* Línea vertical */}
                  {index < pausas.length - 1 && (
                    <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                  )}

                  {/* Icono */}
                  <div
                    className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      isActiva
                        ? 'bg-orange-500 animate-pulse'
                        : 'bg-green-500'
                    }`}
                  >
                    {isActiva ? (
                      <Pause className="w-3 h-3 text-white" />
                    ) : (
                      <Play className="w-3 h-3 text-white" />
                    )}
                  </div>

                  {/* Contenido */}
                  <div
                    className={`bg-white border-2 rounded-lg p-4 ${
                      isActiva ? 'border-orange-300' : 'border-gray-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {pausa.motivo?.nombre || 'Motivo desconocido'}
                          </span>
                          {isActiva && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full animate-pulse">
                              Activa
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getCategoriaColor(
                            pausa.categoria_motivo
                          )}`}
                        >
                          {getCategoriaLabel(pausa.categoria_motivo)}
                        </span>
                      </div>

                      {pausa.duracion_minutos !== null && (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                          <Clock className="w-4 h-4" />
                          {formatDuracion(pausa.duracion_minutos)}
                        </div>
                      )}
                    </div>

                    {/* Descripción */}
                    {pausa.descripcion && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700">
                            {pausa.descripcion}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Fechas y usuarios */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Pause className="w-4 h-4 text-orange-500" />
                        <span>
                          Pausado:{' '}
                          {format(
                            new Date(pausa.fecha_inicio_pausa),
                            "d 'de' MMMM 'a las' HH:mm",
                            { locale: es }
                          )}
                        </span>
                      </div>

                      {pausa.fecha_fin_pausa && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Play className="w-4 h-4 text-green-500" />
                          <span>
                            Reanudado:{' '}
                            {format(
                              new Date(pausa.fecha_fin_pausa),
                              "d 'de' MMMM 'a las' HH:mm",
                              { locale: es }
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-gray-500 text-xs pt-2 border-t">
                        <User className="w-3 h-3" />
                        <span>
                          Pausado por: {pausadoPor}
                          {reanudadoPor && ` • Reanudado por: ${reanudadoPor}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Total de pausas
                </p>
                <p className="text-xs text-blue-700">
                  Este paso ha sido pausado{' '}
                  {pausas.length === 1 ? 'una vez' : `${pausas.length} veces`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">
                  {pausas.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
