import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type {
  PresupuestoHistorial,
  PresupuestoHistorialConUsuario,
} from '../types/presupuestos';

export function usePresupuestoHistorial(presupuestoId: string | undefined) {
  const [historial, setHistorial] = useState<PresupuestoHistorialConUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presupuestoId) {
      fetchHistorial();
    } else {
      setHistorial([]);
      setLoading(false);
    }
  }, [presupuestoId]);

  const fetchHistorial = async () => {
    if (!presupuestoId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('presupuestos_historial')
        .select(
          `
          *,
          usuario:profiles!usuario_id (
            id,
            full_name,
            email
          )
        `
        )
        .eq('presupuesto_id', presupuestoId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setHistorial((data as PresupuestoHistorialConUsuario[]) || []);
    } catch (err: any) {
      console.error('Error fetching historial:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Obtener últimos N cambios
  const getUltimosRegistros = (cantidad: number): PresupuestoHistorialConUsuario[] => {
    return historial.slice(0, cantidad);
  };

  // Filtrar por tipo de acción
  const filtrarPorAccion = (
    accion: PresupuestoHistorial['accion']
  ): PresupuestoHistorialConUsuario[] => {
    return historial.filter((h) => h.accion === accion);
  };

  // Obtener cambios de estado
  const getCambiosEstado = (): PresupuestoHistorialConUsuario[] => {
    return historial.filter((h) => h.accion === 'cambio_estado');
  };

  // Obtener registro de creación
  const getRegistroCreacion = (): PresupuestoHistorialConUsuario | null => {
    const creacion = historial.find((h) => h.accion === 'creado');
    return creacion || null;
  };

  // Obtener registro de último envío
  const getUltimoEnvio = (): PresupuestoHistorialConUsuario | null => {
    const envios = historial.filter((h) => h.accion === 'enviado');
    return envios.length > 0 ? envios[0] : null;
  };

  // Obtener aprobación/rechazo
  const getDecisionCliente = (): PresupuestoHistorialConUsuario | null => {
    const decision = historial.find(
      (h) => h.accion === 'aprobado' || h.accion === 'rechazado'
    );
    return decision || null;
  };

  // Contar modificaciones
  const contarModificaciones = (): number => {
    return historial.filter((h) => h.accion === 'modificado').length;
  };

  return {
    historial,
    loading,
    error,
    refetch: fetchHistorial,
    getUltimosRegistros,
    filtrarPorAccion,
    getCambiosEstado,
    getRegistroCreacion,
    getUltimoEnvio,
    getDecisionCliente,
    contarModificaciones,
  };
}
