import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { ordenarRutasPorEtapaYOrden } from '../utils/productionUtils';
import type { EstadoPaso, TipoEtapaRuta } from '../types/database';

export interface StationStep {
  ruta_id: string;
  paso_id: string | null;
  paso_nombre: string;
  estado_paso: EstadoPaso;
  global_task_id?: string | null;
  orden_item_id: string;
  numero_orden: string;
  cliente_nombre: string;
  producto_nombre: string;
  medida_ancho?: number | null;
  medida_alto?: number | null;
  cantidad: number;
  fecha_inicio: string | null;
  fecha_creacion_orden: string;
  fecha_estimada_entrega: string | null;
  orden_id: string;
  pausa_activa?: {
    motivo_nombre: string;
    categoria_motivo: string;
    fecha_inicio_pausa: string;
  } | null;
  tiempo_pausado_total: number;
  en_mesa_trabajo: boolean;
  mesa_owner_user_id: string | null;
  mesa_owner_name: string | null;
}

interface RutaConOrden {
  id: string;
  paso_id: string | null;
  paso_nombre: string;
  estado_paso: EstadoPaso;
  global_task_id?: string | null;
  orden: number;
  tipo_etapa: TipoEtapaRuta;
  orden_item_id: string;
  fecha_inicio: string | null;
  orden_item: any;
  paso: any;
  pausa_activa?: any;
}

export interface StationWithJobs {
  estacion_id: string;
  estacion_nombre: string;
  estacion_descripcion: string | null;
  pasos_pendientes: number;
  pasos_en_proceso: number;
  pasos_pausados: number;
  pasos_mesa_trabajo: number;
  total_pasos_activos: number;
  pasos: StationStep[];
}

interface UseProductionStationsParams {
  estacionId?: string | null;
}

export function useProductionStations(params: UseProductionStationsParams = {}) {
  const { profile } = useAuth();
  void params;

  const [stations, setStations] = useState<StationWithJobs[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStations = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      let rutasQuery = supabase
        .from('ordenes_trabajo_items_rutas')
        .select(`
          id,
          paso_id,
          paso_nombre,
          estado_paso,
          orden,
          tipo_etapa,
          orden_item_id,
          fecha_inicio,
          global_task_id,
          orden_item:ordenes_trabajo_items!inner(
            id,
            producto_nombre,
            configuracion,
            cantidad,
            orden:ordenes_trabajo!inner(
              id,
              numero_orden,
              fecha_creacion,
              fecha_estimada_entrega,
              estado,
              cliente:clients!inner(
                id,
                nombre_fantasia
              )
            )
          ),
          paso:pasos(
            id,
            estacion_id,
            estacion:estaciones_trabajo!inner(
              id,
              nombre,
              descripcion,
              is_active
            )
          )
        `)
        .eq('company_id', profile.company_id)
        .neq('orden_item.orden.estado', 'cancelada')
        .neq('orden_item.orden.estado', 'entregada')
        .eq('paso.estacion.is_active', true);

      // Eliminamos el filtro por estacionId aquí para que isPasoListo tenga el contexto completo de la ruta
      // El componente StationsView se encarga de mostrar la estación seleccionada del arreglo completo.

      const { data: rutasData, error: rutasError } = await rutasQuery;

      if (rutasError) throw rutasError;

      if (!rutasData || rutasData.length === 0) {
        setStations([]);
        setLoading(false);
        return;
      }

      // Obtener todas las pausas (activas e históricas) para las rutas visibles
      // Esto nos permite calcular el tiempo neto descontando las pausas cerradas
      const rutasIds = rutasData.map((r: any) => r.id);

      let pausasActivasMap = new Map<string, any>();
      let tiempoPausadoTotalMap = new Map<string, number>();
      let mesaTrabajoSet = new Set<string>();

      if (rutasIds.length > 0) {
        const { data: pausasData } = await supabase
          .from('ordenes_items_rutas_pausas')
          .select(`
            ruta_id,
            categoria_motivo,
            fecha_inicio_pausa,
            fecha_fin_pausa,
            motivo:pasos_motivos_pausa(
              nombre
            )
          `)
          .in('ruta_id', rutasIds);

        if (pausasData) {
          pausasData.forEach((pausa: any) => {
            // 1. Detectar Pausa Activa (sin fecha fin)
            if (!pausa.fecha_fin_pausa) {
              pausasActivasMap.set(pausa.ruta_id, {
                motivo_nombre: pausa.motivo?.nombre || 'Sin motivo',
                categoria_motivo: pausa.categoria_motivo,
                fecha_inicio_pausa: pausa.fecha_inicio_pausa,
              });
            }
            // 2. Acumular Tiempo Pausado (pausas cerradas)
            else {
              const inicio = new Date(pausa.fecha_inicio_pausa).getTime();
              const fin = new Date(pausa.fecha_fin_pausa).getTime();
              const duracionMs = fin - inicio;

              const actual = tiempoPausadoTotalMap.get(pausa.ruta_id) || 0;
              tiempoPausadoTotalMap.set(pausa.ruta_id, actual + duracionMs);
            }
          });
        }

        const { data: mesaData } = await supabase
          .from('ordenes_items_mesa_trabajo')
          .select('ruta_id, assigned_user_id')
          .eq('company_id', profile.company_id)
          .in('ruta_id', rutasIds);

        const ownerIds = (mesaData || [])
          .map((row: any) => row.assigned_user_id)
          .filter((value: any) => !!value);
        const uniqueOwnerIds = Array.from(new Set(ownerIds));

        const ownerNameMap = new Map<string, string>();
        if (uniqueOwnerIds.length > 0) {
          const { data: ownersData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uniqueOwnerIds);

          (ownersData || []).forEach((owner: any) => {
            ownerNameMap.set(owner.id, owner.full_name || 'Usuario desconocido');
          });
        }

        if (mesaData) {
          mesaTrabajoSet = new Set(
            mesaData
              .filter((row: any) => !!row.assigned_user_id)
              .map((row: any) => row.ruta_id)
          );
        }

        const mesaOwnerMap = new Map<string, { ownerId: string | null; ownerName: string | null }>();
        (mesaData || []).forEach((row: any) => {
          const ownerId = row.assigned_user_id || null;
          mesaOwnerMap.set(row.ruta_id, {
            ownerId,
            ownerName: ownerId ? ownerNameMap.get(ownerId) || 'Usuario desconocido' : 'Usuario desconocido',
          });
        });

        rutasData.forEach((ruta: any) => {
          const mesaOwner = mesaOwnerMap.get(ruta.id);
          (ruta as any).__mesa_owner = mesaOwner || { ownerId: null, ownerName: null };
        });
      }

      const rutasPorItem = new Map<string, RutaConOrden[]>();
      rutasData.forEach((ruta: any) => {
        if (!ruta.paso?.estacion) return;

        // Agregar información de pausa activa si existe
        const rutaConPausa = {
          ...ruta,
          pausa_activa: ruta.estado_paso === 'pausado' ? pausasActivasMap.get(ruta.id) : null,
        };

        if (!rutasPorItem.has(ruta.orden_item_id)) {
          rutasPorItem.set(ruta.orden_item_id, []);
        }
        rutasPorItem.get(ruta.orden_item_id)!.push(rutaConPausa as RutaConOrden);
      });

      const isPasoListo = (ruta: RutaConOrden, rutasOrdenadas: RutaConOrden[]): boolean => {
        if (ruta.estado_paso === 'en_proceso' || ruta.estado_paso === 'pausado') return true;

        const indicePasoActual = rutasOrdenadas.findIndex((r) => r.id === ruta.id);
        if (indicePasoActual === 0) return true;

        for (let i = 0; i < indicePasoActual; i++) {
          const pasoAnterior = rutasOrdenadas[i];
          if (pasoAnterior.estado_paso !== 'completado' && pasoAnterior.estado_paso !== 'omitido') {
            return false;
          }
        }
        return true;
      };

      const stepsMap = new Map<string, StationStep[]>();
      const stationsInfoMap = new Map<string, { nombre: string; descripcion: string | null }>();

      rutasPorItem.forEach((rutasDelItem, ordenItemId) => {
        const rutasOrdenadas = ordenarRutasPorEtapaYOrden(rutasDelItem);

        rutasOrdenadas.forEach((ruta) => {
          if (!ruta.paso?.estacion) return;

          const estadoEsActivo = ruta.estado_paso === 'pendiente' || ruta.estado_paso === 'en_proceso' || ruta.estado_paso === 'pausado';
          if (!estadoEsActivo) return;

          const estaListo = isPasoListo(ruta, rutasOrdenadas);
          if (!estaListo) return;

          const estacion = ruta.paso.estacion;
          const estacionId = estacion.id;

          if (!stationsInfoMap.has(estacionId)) {
            stationsInfoMap.set(estacionId, {
              nombre: estacion.nombre,
              descripcion: estacion.descripcion,
            });
          }

          const step: StationStep = {
            ruta_id: ruta.id,
            paso_id: ruta.paso_id,
            paso_nombre: ruta.paso_nombre,
            estado_paso: ruta.estado_paso,
            orden_item_id: ruta.orden_item.id,
            numero_orden: ruta.orden_item.orden.numero_orden,
            cliente_nombre: ruta.orden_item.orden.cliente.nombre_fantasia,
            producto_nombre: ruta.orden_item.producto_nombre,
            medida_ancho: ruta.orden_item.configuracion?.medida_ancho,
            medida_alto: ruta.orden_item.configuracion?.medida_alto,
            cantidad: ruta.orden_item.cantidad,
            fecha_inicio: ruta.fecha_inicio,
            fecha_creacion_orden: ruta.orden_item.orden.fecha_creacion,
            fecha_estimada_entrega: ruta.orden_item.orden.fecha_estimada_entrega,
            orden_id: ruta.orden_item.orden.id,
            pausa_activa: ruta.pausa_activa || null,
            tiempo_pausado_total: tiempoPausadoTotalMap.get(ruta.id) || 0,
            global_task_id: ruta.global_task_id,
            en_mesa_trabajo: mesaTrabajoSet.has(ruta.id),
            mesa_owner_user_id: ruta.__mesa_owner?.ownerId || null,
            mesa_owner_name: ruta.__mesa_owner?.ownerName || null,
          };

          if (!stepsMap.has(estacionId)) {
            stepsMap.set(estacionId, []);
          }
          stepsMap.get(estacionId)!.push(step);
        });
      });

      const stationsWithJobs: StationWithJobs[] = Array.from(stationsInfoMap.entries()).map(
        ([estacionId, info]) => {
          const pasos = stepsMap.get(estacionId) || [];

          pasos.sort((a, b) => {
            // Prioridad: pausado > en_proceso > pendiente
            const prioridad: Record<EstadoPaso, number> = {
              pausado: 1,
              en_proceso: 2,
              pendiente: 3,
              completado: 4,
              omitido: 5,
            };

            const prioridadA = prioridad[a.estado_paso] || 99;
            const prioridadB = prioridad[b.estado_paso] || 99;

            if (prioridadA !== prioridadB) {
              return prioridadA - prioridadB;
            }

            const fechaA = new Date(a.fecha_creacion_orden).getTime();
            const fechaB = new Date(b.fecha_creacion_orden).getTime();
            return fechaA - fechaB;
          });

          const pasosEnProceso = pasos.filter((p) => p.estado_paso === 'en_proceso').length;
          const pasosPendientes = pasos.filter((p) => p.estado_paso === 'pendiente').length;
          const pasosPausados = pasos.filter((p) => p.estado_paso === 'pausado').length;
          const pasosMesaTrabajo = pasos.filter((p) => p.en_mesa_trabajo).length;

          return {
            estacion_id: estacionId,
            estacion_nombre: info.nombre,
            estacion_descripcion: info.descripcion,
            pasos_en_proceso: pasosEnProceso,
            pasos_pendientes: pasosPendientes,
            pasos_pausados: pasosPausados,
            pasos_mesa_trabajo: pasosMesaTrabajo,
            total_pasos_activos: pasos.length,
            pasos,
          };
        }
      );

      stationsWithJobs.sort((a, b) => a.estacion_nombre.localeCompare(b.estacion_nombre));

      setStations(stationsWithJobs);
    } catch (err) {
      console.error('Error fetching production stations:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const refreshStations = useCallback(() => {
    fetchStations();
  }, [fetchStations]);

  const setMesaOwnerForRuta = useCallback((rutaId: string, ownerUserId: string | null, ownerName: string | null) => {
    setStations((prev) =>
      prev.map((station) => {
        let changed = false;
        const pasos = station.pasos.map((paso) => {
          if (paso.ruta_id !== rutaId) return paso;
          changed = true;
          return {
            ...paso,
            en_mesa_trabajo: !!ownerUserId,
            mesa_owner_user_id: ownerUserId,
            mesa_owner_name: ownerName,
          };
        });

        if (!changed) return station;

        const pasosEnProceso = pasos.filter((p) => p.estado_paso === 'en_proceso').length;
        const pasosPendientes = pasos.filter((p) => p.estado_paso === 'pendiente').length;
        const pasosPausados = pasos.filter((p) => p.estado_paso === 'pausado').length;
        const pasosMesaTrabajo = pasos.filter((p) => !!p.mesa_owner_user_id).length;

        return {
          ...station,
          pasos,
          pasos_en_proceso: pasosEnProceso,
          pasos_pendientes: pasosPendientes,
          pasos_pausados: pasosPausados,
          pasos_mesa_trabajo: pasosMesaTrabajo,
        };
      })
    );
  }, []);

  const updateStationGranular = useCallback(
    async (rutaId: string) => {
      if (!profile?.company_id) return;

      setIsUpdating(true);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await fetchStations();
        } catch (err) {
          console.error('Error updating station granularly:', err);
        } finally {
          setIsUpdating(false);
        }
      }, 300);
    },
    [profile?.company_id, fetchStations]
  );

  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('station-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ordenes_trabajo_items_rutas',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          console.log('🔄 Realtime: Ruta updated:', payload.new.id);
          updateStationGranular(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_items_mesa_trabajo',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload: any) => {
          const eventType = payload?.eventType;
          if (eventType === 'DELETE') {
            const rutaId = payload.old?.ruta_id;
            if (rutaId) {
              setMesaOwnerForRuta(rutaId, null, null);
            }
            return;
          }

          const rutaId = payload.new?.ruta_id;
          const ownerId = payload.new?.assigned_user_id || null;
          if (!rutaId) return;

          if (!ownerId) {
            setMesaOwnerForRuta(rutaId, null, null);
            return;
          }

          supabase
            .from('profiles')
            .select('full_name')
            .eq('id', ownerId)
            .single()
            .then(({ data }) => {
              setMesaOwnerForRuta(rutaId, ownerId, data?.full_name || 'Usuario desconocido');
            })
            .catch(() => {
              setMesaOwnerForRuta(rutaId, ownerId, 'Usuario desconocido');
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, updateStationGranular, setMesaOwnerForRuta]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const totalActivePasos = stations.reduce((sum, station) => sum + station.total_pasos_activos, 0);

  return {
    stations,
    loading,
    error,
    refreshStations,
    setMesaOwnerForRuta,
    totalActivePasos,
    isUpdating,
  };
}
