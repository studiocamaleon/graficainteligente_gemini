import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { EstadoOrdenItem, OrdenItemRuta } from '../types/database';

export interface JobItem {
  id: string;
  estado: EstadoOrdenItem;
  producto_nombre: string;
  producto_categoria: string | null;
  cantidad: number;
  orden_id: string;
  numero_orden: string;
  fecha_creacion: string;
  cliente_nombre: string;
  total_pasos: number;
  pasos_completados: number;
  pasos_en_proceso: number;
  pasos_pendientes: number;
  progreso_porcentaje: number;
  rutas?: OrdenItemRuta[];
}

interface JobsByEstado {
  pendiente: JobItem[];
  en_proceso: JobItem[];
  finalizado: JobItem[];
}

export function useProductionJobs() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [jobsByEstado, setJobsByEstado] = useState<JobsByEstado>({
    pendiente: [],
    en_proceso: [],
    finalizado: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: itemsData, error: itemsError } = await supabase
        .from('ordenes_trabajo_items')
        .select(`
          id,
          orden_id,
          producto_nombre,
          producto_categoria,
          cantidad,
          estado,
          created_at,
          orden:ordenes_trabajo!inner(
            id,
            numero_orden,
            fecha_creacion,
            estado,
            cliente:clients!inner(
              id,
              nombre_fantasia
            )
          )
        `)
        .eq('orden.company_id', profile.company_id)
        .neq('orden.estado', 'cancelada')
        .neq('orden.estado', 'entregada')
        .order('orden.fecha_creacion', { ascending: true });

      if (itemsError) throw itemsError;

      if (!itemsData || itemsData.length === 0) {
        setJobs([]);
        setJobsByEstado({ pendiente: [], en_proceso: [], finalizado: [] });
        setLoading(false);
        return;
      }

      const itemIds = itemsData.map((item) => item.id);

      const { data: rutasData, error: rutasError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('orden_item_id, estado_paso')
        .in('orden_item_id', itemIds);

      if (rutasError) throw rutasError;

      const rutasByItem = (rutasData || []).reduce((acc, ruta) => {
        if (!acc[ruta.orden_item_id]) {
          acc[ruta.orden_item_id] = [];
        }
        acc[ruta.orden_item_id].push(ruta);
        return acc;
      }, {} as Record<string, any[]>);

      const jobsWithProgress: JobItem[] = itemsData.map((item: any) => {
        const itemRutas = rutasByItem[item.id] || [];
        const totalPasos = itemRutas.length;
        const pasosCompletados = itemRutas.filter(
          (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
        ).length;
        const pasosEnProceso = itemRutas.filter(
          (r) => r.estado_paso === 'en_proceso'
        ).length;
        const pasosPendientes = itemRutas.filter(
          (r) => r.estado_paso === 'pendiente'
        ).length;

        const progresoPortcentaje =
          totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;

        return {
          id: item.id,
          estado: item.estado,
          producto_nombre: item.producto_nombre || 'Sin nombre',
          producto_categoria: item.producto_categoria,
          cantidad: item.cantidad,
          orden_id: item.orden.id,
          numero_orden: item.orden.numero_orden,
          fecha_creacion: item.orden.fecha_creacion,
          cliente_nombre: item.orden.cliente?.nombre_fantasia || 'Sin cliente',
          total_pasos: totalPasos,
          pasos_completados: pasosCompletados,
          pasos_en_proceso: pasosEnProceso,
          pasos_pendientes: pasosPendientes,
          progreso_porcentaje: progresoPortcentaje,
        };
      });

      const grouped: JobsByEstado = {
        pendiente: jobsWithProgress.filter((j) => j.estado === 'pendiente'),
        en_proceso: jobsWithProgress.filter((j) => j.estado === 'en_proceso'),
        finalizado: jobsWithProgress.filter((j) => j.estado === 'finalizado'),
      };

      setJobs(jobsWithProgress);
      setJobsByEstado(grouped);
    } catch (err) {
      console.error('Error fetching production jobs:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const refreshJobs = useCallback(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    jobsByEstado,
    loading,
    error,
    refreshJobs,
    totalJobs: jobs.length,
  };
}
