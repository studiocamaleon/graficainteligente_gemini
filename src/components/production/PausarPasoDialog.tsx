import { useState } from 'react';
import { Pause, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useMotivosPausa } from '../../hooks/useMotivosPausa';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface PausarPasoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rutaId: string;
  pasoNombre: string;
  onSuccess?: () => void;
}

export function PausarPasoDialog({
  isOpen,
  onClose,
  rutaId,
  pasoNombre,
  onSuccess,
}: PausarPasoDialogProps) {
  const { motivos, loading: loadingMotivos } = useMotivosPausa();
  const { showToast } = useToast();
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const motivoActual = motivos.find((m) => m.id === motivoSeleccionado);
  const requiereDescripcion = motivoActual?.requiere_descripcion || false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivoSeleccionado) {
      showToast('Selecciona un motivo de pausa', 'error');
      return;
    }

    if (requiereDescripcion && !descripcion.trim()) {
      showToast('Este motivo requiere una descripción', 'error');
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase.rpc('fn_pausar_paso', {
        p_ruta_id: rutaId,
        p_motivo_pausa_id: motivoSeleccionado,
        p_descripcion: descripcion.trim() || null,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Error pausando paso');
      }

      showToast('Paso pausado correctamente', 'success');
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Error pausando paso:', error);
      showToast(
        error instanceof Error ? error.message : 'Error pausando paso',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setMotivoSeleccionado('');
    setDescripcion('');
    onClose();
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'cliente':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'materiales':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'maquinaria':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'personal':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'externo':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    switch (categoria) {
      case 'cliente':
        return 'Cliente';
      case 'materiales':
        return 'Materiales';
      case 'maquinaria':
        return 'Maquinaria';
      case 'personal':
        return 'Personal';
      case 'externo':
        return 'Externo';
      default:
        return 'Otro';
    }
  };

  // Agrupar motivos por categoría
  const motivosPorCategoria = motivos.reduce((acc, motivo) => {
    if (!acc[motivo.categoria]) {
      acc[motivo.categoria] = [];
    }
    acc[motivo.categoria].push(motivo);
    return acc;
  }, {} as Record<string, typeof motivos>);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Pausar Paso">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Pause className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Pausar: {pasoNombre}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              El paso cambiará a estado "Pausado" y se registrará el motivo y tiempo de pausa.
            </p>
          </div>
        </div>

        {loadingMotivos ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Cargando motivos...</p>
          </div>
        ) : (
          <>
            {/* Motivos agrupados por categoría */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Motivo de la pausa *
              </label>

              {Object.entries(motivosPorCategoria).map(([categoria, motivosCategoria]) => (
                <div key={categoria} className="space-y-2">
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getCategoriaColor(
                      categoria
                    )}`}
                  >
                    {getCategoriaLabel(categoria)}
                  </div>

                  <div className="space-y-2 ml-2">
                    {motivosCategoria.map((motivo) => (
                      <label
                        key={motivo.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50 ${
                          motivoSeleccionado === motivo.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="motivo"
                          value={motivo.id}
                          checked={motivoSeleccionado === motivo.id}
                          onChange={(e) => setMotivoSeleccionado(e.target.value)}
                          className="mt-1 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {motivo.nombre}
                          </p>
                          {motivo.requiere_descripcion && (
                            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Requiere descripción
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Campo de descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción {requiereDescripcion && '*'}
                {!requiereDescripcion && (
                  <span className="text-gray-500 font-normal"> (opcional)</span>
                )}
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={
                  requiereDescripcion
                    ? 'Describe el motivo de la pausa...'
                    : 'Agrega detalles adicionales (opcional)...'
                }
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                  requiereDescripcion && !descripcion.trim()
                    ? 'border-orange-300'
                    : 'border-gray-300'
                }`}
              />
              {requiereDescripcion && !descripcion.trim() && (
                <p className="text-xs text-orange-600 mt-1">
                  Este motivo requiere que proporciones una descripción
                </p>
              )}
            </div>
          </>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting || loadingMotivos || !motivoSeleccionado}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Pausando...
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pausar Paso
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
