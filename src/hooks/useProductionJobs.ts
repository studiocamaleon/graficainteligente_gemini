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
  identificador_interno?: string | null;
  producto_categoria: string | null;
  cantidad: number;
  orden_id: string;
  numero_orden: string;
  fecha_creacion: string;
  fecha_estimada_entrega?: string | null;
  updated_at: string;
  cliente_nombre: string;
  cliente_razon_social?: string;
  total_pasos: number;
  pasos_completados: number;
  pasos_en_proceso: number;
  pasos_pendientes: number;
  progreso_porcentaje: number;
  paso_relevante?: {
    nombre: string;
    estacion_nombre?: string | null;
    estado: 'pendiente' | 'en_proceso' | 'pausado';
    etapa: TipoEtapaRuta;
  } | null;
  rutas?: OrdenItemRuta[];
}

interface JobsByEstado {
  pendiente: JobItem[];
  en_proceso: JobItem[];
  finalizado: JobItem[];
}

const QUERY_PAGE_SIZE = 1000;
const IN_FILTER_BATCH_SIZE = 100;

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Error desconocido';
};

const getSupabaseErrorDebug = (err: unknown) => {
  if (!err || typeof err !== 'object') return err;
  const error = err as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    status?: unknown;
  };

  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    status: error.status,
  };
};

const chunkArray = <T,>(items: T[], chunkSize: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const encontrarPasoRelevante = (itemRutas: any[], estacionesByPasoId: Record<string, string>) => {
  if (itemRutas.length === 0) return null;

  const rutasOrdenadas = ordenarRutasPorEtapaYOrden(itemRutas);

  // Prioridad 1: Paso pausado (máxima prioridad visual)
  const pasoPausado = rutasOrdenadas.find((r) => r.estado_paso === 'pausado');
  if (pasoPausado) {
    return {
      nombre: pasoPausado.paso_nombre,
      estacion_nombre: pasoPausado.paso_id ? estacionesByPasoId[pasoPausado.paso_id] || null : null,
      estado: 'pausado' as const,
      etapa: pasoPausado.tipo_etapa,
    };
  }

  // Prioridad 2: Paso en proceso
  const pasoEnProceso = rutasOrdenadas.find((r) => r.estado_paso === 'en_proceso');
  if (pasoEnProceso) {
    return {
      nombre: pasoEnProceso.paso_nombre,
      estacion_nombre: pasoEnProceso.paso_id ? estacionesByPasoId[pasoEnProceso.paso_id] || null : null,
      estado: 'en_proceso' as const,
      etapa: pasoEnProceso.tipo_etapa,
    };
  }

  // Prioridad 3: Primer paso pendiente
  const pasoPendiente = rutasOrdenadas.find((r) => r.estado_paso === 'pendiente');
  if (pasoPendiente) {
    return {
      nombre: pasoPendiente.paso_nombre,
      estacion_nombre: pasoPendiente.paso_id ? estacionesByPasoId[pasoPendiente.paso_id] || null : null,
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

      const debugContext = {
        companyId: profile.company_id,
        timestamp: new Date().toISOString(),
      };
      console.info('[ProductionJobs] Iniciando carga de jobs', debugContext);

      const itemsData: any[] = [];
      let from = 0;

      while (true) {
        const to = from + QUERY_PAGE_SIZE - 1;
        const { data: itemsPage, error: itemsError } = await supabase
          .from('ordenes_trabajo_items')
          .select(`
            id,
            orden_id,
            producto_nombre,
            producto_categoria,
            cantidad,
            estado,
            created_at,
            updated_at,
            orden:ordenes_trabajo!inner(
              id,
              numero_orden,
              fecha_creacion,
              fecha_estimada_entrega,
              estado,
              cliente:clients!inner(
                id,
                nombre_fantasia,
                razon_social
              )
            ),
            configuracion
          `)
          .eq('orden.company_id', profile.company_id)
          .neq('orden.estado', 'cancelada')
          .neq('orden.estado', 'borrador')
          .neq('orden.estado', 'entregada')
          .range(from, to);

        if (itemsError) {
          console.error('[ProductionJobs] Error en query ordenes_trabajo_items', {
            ...debugContext,
            from,
            to,
            error: getSupabaseErrorDebug(itemsError),
          });
          throw itemsError;
        }

        itemsData.push(...((itemsPage as any[]) || []));

        if (!itemsPage || itemsPage.length < QUERY_PAGE_SIZE) {
          break;
        }

        from += QUERY_PAGE_SIZE;
      }

      console.info('[ProductionJobs] Items obtenidos', {
        ...debugContext,
        itemsCount: itemsData.length,
        pages: Math.ceil(itemsData.length / QUERY_PAGE_SIZE),
      });

      if (itemsData.length === 0) {
        console.info('[ProductionJobs] Sin items activos para producción', debugContext);
        setJobs([]);
        setJobsByEstado({ pendiente: [], en_proceso: [], finalizado: [] });
        setLoading(false);
        return;
      }

      // Filtrar items de cobro que no requieren producción
      const productionItems = itemsData.filter((item: any) =>
        !item.configuracion?.es_servicio_cobro
      );

      console.info('[ProductionJobs] Items filtrados para producción', {
        ...debugContext,
        totalItems: itemsData.length,
        productionItems: productionItems.length,
        serviceChargeItems: itemsData.length - productionItems.length,
      });

      if (productionItems.length === 0) {
        console.warn('[ProductionJobs] No quedaron items productivos después del filtro', debugContext);
        setJobs([]);
        setJobsByEstado({ pendiente: [], en_proceso: [], finalizado: [] });
        setLoading(false);
        return;
      }

      const sortedItemsData = productionItems.sort((a: any, b: any) => {
        const fechaA = new Date(a.orden.fecha_creacion).getTime();
        const fechaB = new Date(b.orden.fecha_creacion).getTime();
        return fechaA - fechaB;
      });

      const itemIds = (sortedItemsData as any[]).map((item) => item.id);

      console.info('[ProductionJobs] Consultando rutas de producción', {
        ...debugContext,
        itemIdsCount: itemIds.length,
      });

      const rutasChunks = chunkArray(itemIds, IN_FILTER_BATCH_SIZE);
      const rutasData: any[] = [];

      for (const [index, itemIdsChunk] of rutasChunks.entries()) {
        const { data: rutasChunkData, error: rutasError } = await supabase
          .from('ordenes_trabajo_items_rutas')
          .select('orden_item_id, paso_id, estado_paso, paso_nombre, tipo_etapa, orden')
          .in('orden_item_id', itemIdsChunk);

        if (rutasError) {
          console.error('[ProductionJobs] Error en query ordenes_trabajo_items_rutas', {
            ...debugContext,
            batchIndex: index + 1,
            totalBatches: rutasChunks.length,
            batchItemIdsCount: itemIdsChunk.length,
            itemIdsCount: itemIds.length,
            error: getSupabaseErrorDebug(rutasError),
          });
          throw rutasError;
        }

        rutasData.push(...((rutasChunkData as any[]) || []));
      }

      console.info('[ProductionJobs] Rutas obtenidas', {
        ...debugContext,
        batches: rutasChunks.length,
        rutasCount: rutasData?.length ?? 0,
      });

      const pasoIds = Array.from(
        new Set(
          ((rutasData as any[]) || [])
            .map((r) => r.paso_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      let estacionesByPasoId: Record<string, string> = {};
      if (pasoIds.length > 0) {
        console.info('[ProductionJobs] Consultando estaciones por pasos', {
          ...debugContext,
          pasoIdsCount: pasoIds.length,
        });

        const pasosChunks = chunkArray(pasoIds, IN_FILTER_BATCH_SIZE);
        const pasosData: any[] = [];

        for (const [index, pasoIdsChunk] of pasosChunks.entries()) {
          const { data: pasosChunkData, error: pasosError } = await supabase
            .from('pasos')
            .select('id, estaciones_trabajo(nombre)')
            .in('id', pasoIdsChunk);

          if (pasosError) {
            console.error('[ProductionJobs] Error en query pasos -> estaciones_trabajo', {
              ...debugContext,
              batchIndex: index + 1,
              totalBatches: pasosChunks.length,
              batchPasoIdsCount: pasoIdsChunk.length,
              pasoIdsCount: pasoIds.length,
              error: getSupabaseErrorDebug(pasosError),
            });
            throw pasosError;
          }

          pasosData.push(...((pasosChunkData as any[]) || []));
        }

        console.info('[ProductionJobs] Pasos obtenidos para estaciones', {
          ...debugContext,
          batches: pasosChunks.length,
          pasosCount: pasosData?.length ?? 0,
        });

        estacionesByPasoId = ((pasosData as any[]) || []).reduce((acc, paso) => {
          const nombre = paso?.estaciones_trabajo?.nombre;
          if (paso?.id && nombre) {
            acc[paso.id] = nombre;
          }
          return acc;
        }, {} as Record<string, string>);
      }

      const rutasByItem = ((rutasData as any[]) || []).reduce((acc, ruta) => {
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
          (r: any) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
        ).length;
        const pasosEnProceso = itemRutas.filter(
          (r: any) => r.estado_paso === 'en_proceso'
        ).length;
        const pasosPendientes = itemRutas.filter(
          (r: any) => r.estado_paso === 'pendiente'
        ).length;

        const progresoPortcentaje =
          totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;

        const pasoRelevante = encontrarPasoRelevante(itemRutas, estacionesByPasoId);

        return {
          id: item.id,
          estado: item.estado,
          producto_nombre: item.producto_nombre || 'Sin nombre',
          identificador_interno: item.configuracion?.identificador_interno || null,
          producto_categoria: item.producto_categoria,
          cantidad: item.cantidad,
          orden_id: item.orden.id,
          numero_orden: item.orden.numero_orden,
          fecha_creacion: item.orden.fecha_creacion,
          fecha_estimada_entrega: item.orden.fecha_estimada_entrega,
          updated_at: item.updated_at,
          cliente_nombre: item.orden.cliente?.nombre_fantasia || 'Sin cliente',
          cliente_razon_social: item.orden.cliente?.razon_social || '',
          total_pasos: totalPasos,
          pasos_completados: pasosCompletados,
          pasos_en_proceso: pasosEnProceso,
          pasos_pendientes: pasosPendientes,
          progreso_porcentaje: progresoPortcentaje,
          paso_relevante: pasoRelevante,
        };
      });

      const grouped: JobsByEstado = {
        pendiente: jobsWithProgress
          .filter((j) => j.estado === 'pendiente')
          .sort((a, b) => new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime()),
        en_proceso: jobsWithProgress
          .filter((j) => j.estado === 'en_proceso')
          .sort((a, b) => new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime()),
        finalizado: jobsWithProgress
          .filter((j) => j.estado === 'finalizado')
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
      };

      setJobs(jobsWithProgress);
      setJobsByEstado(grouped);
      console.info('[ProductionJobs] Jobs cargados correctamente', {
        ...debugContext,
        totalJobs: jobsWithProgress.length,
        pendiente: grouped.pendiente.length,
        enProceso: grouped.en_proceso.length,
        finalizado: grouped.finalizado.length,
      });
    } catch (err) {
      console.error('[ProductionJobs] Error fetching production jobs', {
        error: getSupabaseErrorDebug(err),
        rawError: err,
      });
      setError(getErrorMessage(err));
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
            updated_at,
            configuracion,
            orden:ordenes_trabajo!inner(
              id,
              numero_orden,
              fecha_creacion,
              fecha_estimada_entrega,
              estado,
              cliente:clients!inner(
                id,
                nombre_fantasia,
                razon_social
              )
            )
          `)
          .eq('id', itemId)
          .single();

        if (itemError) throw itemError;

        const { data: rutasData, error: rutasError } = await supabase
          .from('ordenes_trabajo_items_rutas')
          .select('orden_item_id, paso_id, estado_paso, paso_nombre, tipo_etapa, orden')
          .eq('orden_item_id', itemId);

        if (rutasError) throw rutasError;

        const itemRutas = (rutasData as any[]) || [];
        const totalPasos = itemRutas.length;
        const pasosCompletados = itemRutas.filter(
          (r) => r.estado_paso === 'completado' || r.estado_paso === 'omitido'
        ).length;
        const pasosEnProceso = itemRutas.filter((r) => r.estado_paso === 'en_proceso').length;
        const pasosPendientes = itemRutas.filter((r) => r.estado_paso === 'pendiente').length;
        const progresoPortcentaje =
          totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;

        const pasoIds = Array.from(
          new Set(
            itemRutas
              .map((r: any) => r.paso_id)
              .filter((id: any): id is string => Boolean(id))
          )
        );

        let estacionesByPasoId: Record<string, string> = {};
        if (pasoIds.length > 0) {
          const { data: pasosData, error: pasosError } = await supabase
            .from('pasos')
            .select('id, estaciones_trabajo(nombre)')
            .in('id', pasoIds);

          if (pasosError) throw pasosError;

          estacionesByPasoId = ((pasosData as any[]) || []).reduce((acc, paso) => {
            const nombre = paso?.estaciones_trabajo?.nombre;
            if (paso?.id && nombre) {
              acc[paso.id] = nombre;
            }
            return acc;
          }, {} as Record<string, string>);
        }

        const pasoRelevante = encontrarPasoRelevante(itemRutas, estacionesByPasoId);

        const itemDataAny = itemData as any;
        const updatedJob: JobItem = {
          id: itemDataAny.id,
          estado: itemDataAny.estado,
          producto_nombre: itemDataAny.producto_nombre || 'Sin nombre',
          identificador_interno: itemDataAny.configuracion?.identificador_interno || null,
          producto_categoria: itemDataAny.producto_categoria,
          cantidad: itemDataAny.cantidad,
          orden_id: (itemDataAny.orden as any).id,
          numero_orden: (itemDataAny.orden as any).numero_orden,
          fecha_creacion: (itemDataAny.orden as any).fecha_creacion,
          fecha_estimada_entrega: (itemDataAny.orden as any).fecha_estimada_entrega,
          updated_at: itemDataAny.updated_at,
          cliente_nombre: (itemDataAny.orden as any).cliente?.nombre_fantasia || 'Sin cliente',
          cliente_razon_social: (itemDataAny.orden as any).cliente?.razon_social || '',
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

          const sortByEstado = (jobs: JobItem[], estado: EstadoOrdenItem) => {
            return jobs.sort((a, b) => {
              if (estado === 'finalizado') {
                const updatedA = new Date(a.updated_at).getTime();
                const updatedB = new Date(b.updated_at).getTime();
                return updatedB - updatedA;
              } else {
                const fechaA = new Date(a.fecha_creacion).getTime();
                const fechaB = new Date(b.fecha_creacion).getTime();
                return fechaA - fechaB;
              }
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
            pendiente: sortByEstado(newPendiente, 'pendiente'),
            en_proceso: sortByEstado(newEnProceso, 'en_proceso'),
            finalizado: sortByEstado(newFinalizado, 'finalizado'),
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
