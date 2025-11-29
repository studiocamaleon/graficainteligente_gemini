import { Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface ReanudarPasoButtonProps {
  rutaId: string;
  pasoNombre: string;
  onSuccess?: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export function ReanudarPasoButton({
  rutaId,
  pasoNombre,
  onSuccess,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ReanudarPasoButtonProps) {
  const { showToast } = useToast();
  const { showConfirm } = useConfirmDialog();
  const [submitting, setSubmitting] = useState(false);

  const handleReanudar = async () => {
    const confirmed = await showConfirm({
      title: 'Reanudar Paso',
      message: `¿Confirmas que deseas reanudar el paso "${pasoNombre}"?`,
      confirmText: 'Reanudar',
      cancelText: 'Cancelar',
    });

    if (!confirmed) return;

    try {
      setSubmitting(true);

      const { data, error } = await supabase.rpc('fn_reanudar_paso', {
        p_ruta_id: rutaId,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Error reanudando paso');
      }

      const duracionMin = data.duracion_pausa_minutos;
      const horas = Math.floor(duracionMin / 60);
      const minutos = duracionMin % 60;
      const duracionTexto =
        horas > 0 ? `${horas}h ${minutos}min` : `${minutos} min`;

      showToast(
        `Paso reanudado. Duración de pausa: ${duracionTexto}`,
        'success'
      );
      onSuccess?.();
    } catch (error) {
      console.error('Error reanudando paso:', error);
      showToast(
        error instanceof Error ? error.message : 'Error reanudando paso',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      onClick={handleReanudar}
      disabled={submitting}
      variant={variant}
      className={fullWidth ? 'w-full' : ''}
    >
      {submitting ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Reanudando...
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          Reanudar
        </>
      )}
    </Button>
  );
}
