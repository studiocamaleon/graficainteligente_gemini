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
  const { showSuccess, showError } = useToast();
  const { showConfirm } = useConfirmDialog();
  const [submitting, setSubmitting] = useState(false);

  const handleReanudar = async () => {
    console.log('🔄 Intentando reanudar paso:', { rutaId, pasoNombre });

    const confirmed = await showConfirm({
      title: 'Reanudar Paso',
      message: `¿Confirmas que deseas reanudar el paso "${pasoNombre}"?`,
      confirmText: 'Reanudar',
      cancelText: 'Cancelar',
    });

    console.log('🔄 Confirmación de reanudar:', confirmed);
    if (!confirmed) {
      console.log('❌ Usuario canceló la reanudación');
      return;
    }

    try {
      setSubmitting(true);
      console.log('⏳ Llamando fn_reanudar_paso con rutaId:', rutaId);

      const { data, error } = await supabase.rpc('fn_reanudar_paso', {
        p_ruta_id: rutaId,
      });

      console.log('📦 Respuesta de fn_reanudar_paso:', { data, error });

      if (error) {
        console.error('❌ Error de Supabase:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('❌ Función retornó success=false:', data);
        throw new Error(data?.error || 'Error reanudando paso');
      }

      const duracionMin = data.duracion_pausa_minutos;
      const horas = Math.floor(duracionMin / 60);
      const minutos = duracionMin % 60;
      const duracionTexto =
        horas > 0 ? `${horas}h ${minutos}min` : `${minutos} min`;

      console.log('✅ Paso reanudado exitosamente. Duración:', duracionTexto);
      showSuccess(`Paso reanudado. Duración de pausa: ${duracionTexto}`);
      onSuccess?.();
    } catch (error) {
      console.error('❌ Error reanudando paso:', error);
      showError(
        error instanceof Error ? error.message : 'Error reanudando paso'
      );
    } finally {
      setSubmitting(false);
      console.log('🔄 Proceso de reanudación finalizado');
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
