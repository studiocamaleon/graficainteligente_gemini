import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRealtimeJobs } from './useRealtimeJobs';
import { ordenarRutasPorEtapaYOrden } from '../utils/productionUtils';
import type { EstadoOrdenItem, OrdenItemRuta, TipoEtapaRuta } from '../types/database';

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
  paso_relevante?: {
    nombre: string;
    estado: 'pendiente' | 'en_proceso';
    etapa: TipoEtapaRuta;
  } | null;
  rutas?: OrdenItemRuta[];
}

interface JobsByEstado {
  pendiente: JobItem[];
  en_proceso: JobItem[];
  finalizado: JobItem[];
}

const encontrarPasoRelevante = (itemRutas: any[]) => {
  if (itemRutas.length === 0) return null;

  const rutasOrdenadas = ordenarRutasPorEtapaYOrden(itemRutas);

  const pasoEnProceso = rutasOrdenadas.find((r) => r.estado_paso === 'en_proceso');
  if (pasoEnProceso) {
    return {
      nombre: pasoEnProceso.paso_nombre,
      estado: 'en_proceso' as const,
      etapa: pasoEnProceso.tipo_etapa,
    };
  }

  const pasoPendiente = rutasOrdenadas.find((r) => r.estado_paso === 'pendiente');
  if (pasoPendiente) {
    return {
      nombre: pasoPendiente.paso_nombre,
      estado: 'pendiente' as const,
      etapa: pasoPendiente.tipo_etapa,
    };
  }

  return null;
};

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
  const [isUpdating, setIsUpdating] = useState(false);
  const [recentlyUpdatedJobs, setRecentlyUpdatedJobs] = useState<Set<string>>(new Set());
  const updateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

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
        .neq('orden.estado', 'entregada');

      if (itemsError) throw itemsError;

      if (!itemsData || itemsData.length === 0) {
        setJobs([]);
        setJobsByEstado({ pendiente: [], en_proceso: [], finalizado: [] });
        setLoading(false);
        return;
      }

      const sortedItemsData = itemsData.sort((a: any, b: any) => {
        const fechaA = new Date(a.orden.fecha_creacion).getTime();
        const fechaB = new Date(b.orden.fecha_creacion).getTime();
        return fechaA - fechaB;
      });

      const itemIds = sortedItemsData.map((item) => item.id);

      const { data: rutasData, error: rutasError } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select('orden_item_id, estado_paso, paso_nombre, tipo_etapa, orden')
        .in('orden_item_id', itemIds);

      if (rutasError) throw rutasError;

      const rutasByItem = (rutasData || []).reduce((acc, ruta) => {
        if (!acc[ruta.orden_item_id]) {
          acc[ruta.orden_item_id] = [];
        }
        acc[ruta.orden_item_id].push(ruta);
        return acc;
      }, {} as Record<string, any[]>);

      const jobsWithProgress: JobItem[] = sortedItemsData.map((item: any) => {
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

        const pasoRelevante = encontrarPasoRelevante(itemRutas);

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
          paso_relevante: pasoRelevante,
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

  const updateJobGranular = useCallback(async (itemId: string) => {
    if (!profile?.company_id) return;

    const startTime = Date.now();
    console.log(`🔄 [${new Date().toISOString()}] Starting granular update for job: ${itemId}`);

    if (updateTimeoutsRef.current.has(itemId)) {
      clearTimeout(updateTimeoutsRef.current.get(itemId)!);
      console.log(`⏱️ Cleared previous timeout for job: ${itemId}`);
    }

    pendingUpdatesRef.current.add(itemId);
    setIsUpdating(true);

    const timeoutId = setTimeout(async () => {
      try {
        console.log(`🔍 Fetching updated data for job: ${itemId}`);
        const { data: itemData, error: itemError } = await supabase
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
          .eq('id', itemId)
          .single();

        if (itemError) throw itemError;

        const { data: rutasData, error: rutasError } = await supabase
          .from('ordenes_trabajo_items_rutas')
          .select('orden_item_id, estado_paso, paso_nombre, tipo_etapa, orden')
          .eq('orden_item_id', itemId);

        if (rutasError) throw rutasError;

        const itemRutas = rutasData || [];
        const totalPasos = itemRutas.length;
        const pasosCompletados = itemRutas.filter(
          (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
        ).length;
        const pasosEnProceso = itemRutas.filter((r) => r.estado_paso === 'en_proceso').length;
        const pasosPendientes = itemRutas.filter((r) => r.estado_paso === 'pendiente').length;
        const progresoPortcentaje =
          totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;

        const pasoRelevante = encontrarPasoRelevante(itemRutas);

        const updatedJob: JobItem = {
          id: itemData.id,
          estado: itemData.estado,
          producto_nombre: itemData.producto_nombre || 'Sin nombre',
          producto_categoria: itemData.producto_categoria,
          cantidad: itemData.cantidad,
          orden_id: (itemData.orden as any).id,
          numero_orden: (itemData.orden as any).numero_orden,
          fecha_creacion: (itemData.orden as any).fecha_creacion,
          cliente_nombre: (itemData.orden as any).cliente?.nombre_fantasia || 'Sin cliente',
          total_pasos: totalPasos,
          pasos_completados: pasosCompletados,
          pasos_en_proceso: pasosEnProceso,
          pasos_pendientes: pasosPendientes,
          progreso_porcentaje: progresoPortcentaje,
          paso_relevante: pasoRelevante,
        };

        console.log(`📊 Job ${itemId} updated:`, {
          estado: updatedJob.estado,
          progreso: `${pasosCompletados}/${totalPasos}`,
          porcentaje: `${progresoPortcentaje}%`,
          paso_relevante: pasoRelevante?.nombre,
        });

        setJobs((prevJobs) => {
          const jobIndex = prevJobs.findIndex((j) => j.id === itemId);
          if (jobIndex === -1) {
            console.log(`➕ Adding new job to list: ${itemId}`);
            return [...prevJobs, updatedJob].sort((a, b) => {
              const fechaA = new Date(a.fecha_creacion).getTime();
              const fechaB = new Date(b.fecha_creacion).getTime();
              return fechaA - fechaB;
            });
          }

          const oldJob = prevJobs[jobIndex];
          const estadoChanged = oldJob.estado !== updatedJob.estado;
          const progresoChanged = oldJob.progreso_porcentaje !== updatedJob.progreso_porcentaje;

          if (estadoChanged) {
            console.log(`🔄 Job ${itemId} estado changed: ${oldJob.estado} → ${updatedJob.estado}`);
          }
          if (progresoChanged) {
            console.log(`📈 Job ${itemId} progreso changed: ${oldJob.progreso_porcentaje}% → ${updatedJob.progreso_porcentaje}%`);
          }

          const newJobs = [...prevJobs];
          newJobs[jobIndex] = updatedJob;
          return newJobs;
        });

        setJobsByEstado((prevGrouped) => {
          const newPendiente = prevGrouped.pendiente.filter((j) => j.id !== itemId);
          const newEnProceso = prevGrouped.en_proceso.filter((j) => j.id !== itemId);
          const newFinalizado = prevGrouped.finalizado.filter((j) => j.id !== itemId);

          const sortByDate = (jobs: JobItem[]) => {
            return jobs.sort((a, b) => {
              const fechaA = new Date(a.fecha_creacion).getTime();
              const fechaB = new Date(b.fecha_creacion).getTime();
              return fechaA - fechaB;
            });
          };

          if (updatedJob.estado === 'pendiente') {
            newPendiente.push(updatedJob);
          } else if (updatedJob.estado === 'en_proceso') {
            newEnProceso.push(updatedJob);
          } else if (updatedJob.estado === 'finalizado') {
            newFinalizado.push(updatedJob);
          }

          return {
            pendiente: sortByDate(newPendiente),
            en_proceso: sortByDate(newEnProceso),
            finalizado: sortByDate(newFinalizado),
          };
        });

        setRecentlyUpdatedJobs((prev) => {
          const newSet = new Set(prev);
          newSet.add(itemId);
          return newSet;
        });

        setTimeout(() => {
          setRecentlyUpdatedJobs((prev) => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
          });
        }, 3000);
        const elapsedTime = Date.now() - startTime;
        console.log(`✅ Job ${itemId} updated successfully in ${elapsedTime}ms`);
      } catch (err) {
        console.error(`❌ Error updating job ${itemId}:`, err);
      } finally {
        pendingUpdatesRef.current.delete(itemId);
        updateTimeoutsRef.current.delete(itemId);

        if (pendingUpdatesRef.current.size === 0) {
          setIsUpdating(false);
        }
      }
    }, 300);

    updateTimeoutsRef.current.set(itemId, timeoutId);
  }, [profile?.company_id]);

  const updateJobGranularRef = useRef<(itemId: string) => void>();

  useEffect(() => {
    updateJobGranularRef.current = updateJobGranular;
  }, [updateJobGranular]);

  const handleJobItemUpdate = useCallback(
    (itemId: string) => {
      console.log('🔄 Realtime: Job item updated:', itemId);
      updateJobGranularRef.current?.(itemId);
    },
    []
  );

  const handleRutaUpdate = useCallback(
    (rutaId: string, ordenItemId: string) => {
      console.log('🔄 Realtime: Ruta updated:', rutaId, 'for item:', ordenItemId);
      updateJobGranularRef.current?.(ordenItemId);
    },
    []
  );

  useRealtimeJobs({
    onJobItemUpdated: handleJobItemUpdate,
    onRutaUpdated: handleRutaUpdate,
  });

  useEffect(() => {
    return () => {
      updateTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      updateTimeoutsRef.current.clear();
    };
  }, []);

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
    isUpdating,
    recentlyUpdatedJobs,
  };
}
