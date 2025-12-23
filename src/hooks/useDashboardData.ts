import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { ProximaEntrega, ActividadReciente, DashboardStats } from '../types/dashboard';
import { TasaCumplimiento } from '../types/database';

export function useDashboardData() {
  const { company, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    ordenesPendientes: 0,
    ordenesEnProceso: 0,
    entregasHoy: 0,
  });
  const [ordenesPorDia, setOrdenesPorDia] = useState<{ fecha: string; date: string; creadas: number; finalizadas: number }[]>([]);
  const [tasaCumplimiento, setTasaCumplimiento] = useState<TasaCumplimiento | null>(null);
  const [proximasEntregas, setProximasEntregas] = useState<ProximaEntrega[]>([]);
  const [actividadReciente, setActividadReciente] = useState<ActividadReciente[]>([]);

  const companyId = profile?.company_id || company?.id;

  const calcularDiasRestantes = (fechaEntrega: string): number => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fechaEntrega);
    fecha.setHours(0, 0, 0, 0);
    const diff = fecha.getTime() - hoy.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const calcularNivelUrgencia = (diasRestantes: number): 'critico' | 'urgente' | 'proximo' | 'normal' => {
    if (diasRestantes <= 1) return 'critico';
    if (diasRestantes <= 3) return 'urgente';
    if (diasRestantes <= 7) return 'proximo';
    return 'normal';
  };

  const formatTiempoRelativo = (fecha: string): string => {
    const ahora = new Date();
    const fechaEvento = new Date(fecha);
    const diffMs = ahora.getTime() - fechaEvento.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutos < 1) return 'Justo ahora';
    if (diffMinutos < 60) return `Hace ${diffMinutos} ${diffMinutos === 1 ? 'minuto' : 'minutos'}`;
    if (diffHoras < 24) return `Hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
    if (diffDias < 7) return `Hace ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;

    return fechaEvento.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const loadStats = useCallback(async () => {
    if (!companyId) return;

    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);

      const { count: pendientesCount } = await supabase
        .from('ordenes_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('estado', 'pendiente');

      const { count: enProcesoCount } = await supabase
        .from('ordenes_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('estado', 'en_proceso');

      const { count: entregasHoyCount } = await supabase
        .from('ordenes_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('estado', ['pendiente', 'en_proceso'])
        .gte('fecha_estimada_entrega', hoy.toISOString())
        .lt('fecha_estimada_entrega', manana.toISOString());

      setStats({
        ordenesPendientes: pendientesCount || 0,
        ordenesEnProceso: enProcesoCount || 0,
        entregasHoy: entregasHoyCount || 0,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [companyId]);

  const loadOrdenesPorDia = useCallback(async () => {
    if (!companyId) return;

    try {
      const hoy = new Date();
      const hace7Dias = new Date();
      hace7Dias.setDate(hoy.getDate() - 7);

      const { data: creadasData, error: errorCreadas } = await supabase
        .from('ordenes_trabajo')
        .select('created_at')
        .eq('company_id', companyId)
        .gte('created_at', hace7Dias.toISOString())
        .order('created_at', { ascending: true });

      if (errorCreadas) throw errorCreadas;

      const { data: finalizadasData, error: errorFinalizadas } = await supabase
        .from('ordenes_trabajo')
        .select('fecha_completado')
        .eq('company_id', companyId)
        .gte('fecha_completado', hace7Dias.toISOString())
        .not('fecha_completado', 'is', null)
        .order('fecha_completado', { ascending: true });

      if (errorFinalizadas) throw errorFinalizadas;

      // Estructura para agrupar
      const agrupados: Record<string, { creadas: number; finalizadas: number }> = {};

      // Inicializar últimos 7 días con 0
      for (let i = 0; i <= 7; i++) {
        const d = new Date(hace7Dias);
        d.setDate(d.getDate() + i);
        const fechaStr = d.toISOString().split('T')[0];
        agrupados[fechaStr] = { creadas: 0, finalizadas: 0 };
      }

      (creadasData as any[])?.forEach((orden) => {
        const fechaStr = new Date(orden.created_at).toISOString().split('T')[0];
        if (agrupados[fechaStr]) {
          agrupados[fechaStr].creadas++;
        }
      });

      (finalizadasData as any[])?.forEach((orden) => {
        const fechaStr = new Date(orden.fecha_completado).toISOString().split('T')[0];
        if (agrupados[fechaStr]) {
          agrupados[fechaStr].finalizadas++;
        }
      });

      const chartData = Object.entries(agrupados).map(([fecha, datos]) => ({
        fecha,
        date: new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        creadas: datos.creadas,
        finalizadas: datos.finalizadas,
      })).sort((a, b) => a.fecha.localeCompare(b.fecha));

      setOrdenesPorDia(chartData);
    } catch (err) {
      console.error('Error loading ordenes por dia:', err);
    }
  }, [companyId]);

  const loadTasaCumplimiento = useCallback(async () => {
    if (!companyId) return;

    try {
      // @ts-ignore - Supabase RPC types might be mismatched
      const { data, error } = await supabase.rpc('fn_tasa_cumplimiento', {
        p_company_id: companyId,
        p_fecha_desde: null,
        p_fecha_hasta: null,
      });

      if (error) {
        console.error('Error loading tasa cumplimiento:', error);
        return;
      }

      if (data && (data as any[]).length > 0) {
        setTasaCumplimiento((data as any[])[0]);
      }
    } catch (err) {
      console.error('Error loading tasa cumplimiento:', err);
    }
  }, [companyId]);

  const loadProximasEntregas = useCallback(async () => {
    if (!companyId) return;

    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select(`
          id,
          numero_orden,
          fecha_estimada_entrega,
          estado,
          clientes:cliente_id (
            nombre_fantasia
          ),
          ordenes_trabajo_items (
            id,
            ordenes_trabajo_items_rutas (
              id,
              estado_paso
            )
          )
        `)
        .eq('company_id', companyId)
        .in('estado', ['pendiente', 'en_proceso'])
        .not('fecha_estimada_entrega', 'is', null)
        .order('fecha_estimada_entrega', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Error loading próximas entregas:', error);
        return;
      }

      const entregas: ProximaEntrega[] = (data || []).map((orden: any) => {
        const totalPasos = (orden.ordenes_trabajo_items as any[])?.reduce((acc: number, item: any) => {
          return acc + (item.ordenes_trabajo_items_rutas?.length || 0);
        }, 0) || 0;

        const pasosCompletados = (orden.ordenes_trabajo_items as any[])?.reduce((acc: number, item: any) => {
          return acc + (item.ordenes_trabajo_items_rutas?.filter((r: any) => r.estado_paso === 'completado').length || 0);
        }, 0) || 0;

        const progresoPorcentaje = totalPasos > 0 ? Math.round((pasosCompletados / totalPasos) * 100) : 0;
        const diasRestantes = calcularDiasRestantes(orden.fecha_estimada_entrega);

        return {
          id: orden.id,
          numero_orden: orden.numero_orden,
          cliente_nombre: orden.clientes?.nombre_fantasia || 'Sin cliente',
          fecha_estimada_entrega: orden.fecha_estimada_entrega,
          dias_restantes: diasRestantes,
          estado: orden.estado,
          progreso_porcentaje: progresoPorcentaje,
          nivel_urgencia: calcularNivelUrgencia(diasRestantes),
          total_pasos: totalPasos,
          pasos_completados: pasosCompletados,
        };
      });

      setProximasEntregas(entregas);
    } catch (err) {
      console.error('Error loading próximas entregas:', err);
    }
  }, [companyId]);

  const loadActividadReciente = useCallback(async () => {
    if (!companyId) return;

    try {
      const hace7Dias = new Date();
      hace7Dias.setDate(hace7Dias.getDate() - 7);

      const actividadesOrdenes: ActividadReciente[] = [];
      const actividadesProduccion: ActividadReciente[] = [];

      const { data: historialOrdenes } = await supabase
        .from('ordenes_trabajo_historial')
        .select(`
          id,
          tipo_evento,
          descripcion,
          created_at,
          ordenes_trabajo:orden_id (
            numero_orden,
            id,
            company_id
          ),
          profiles:usuario_id (
            full_name
          )
        `)
        .eq('ordenes_trabajo.company_id', companyId)
        .in('tipo_evento', ['creacion', 'cambio_estado', 'orden_confirmada', 'orden_cancelada'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (historialOrdenes) {
        historialOrdenes
          .filter((item: any) => item.ordenes_trabajo)
          .forEach((item: any) => {
            actividadesOrdenes.push({
              id: item.id,
              tipo: 'orden',
              tipo_evento: item.tipo_evento,
              descripcion: item.descripcion,
              orden_numero: item.ordenes_trabajo.numero_orden,
              orden_id: item.ordenes_trabajo.id,
              usuario_nombre: item.profiles?.full_name || null,
              tiempo_relativo: formatTiempoRelativo(item.created_at),
              created_at: item.created_at,
            });
          });
      }

      const { data: pasosCompletados } = await supabase
        .from('ordenes_trabajo_items_rutas')
        .select(`
          id,
          paso_nombre,
          fecha_fin,
          ordenes_trabajo_items!inner (
            ordenes_trabajo!inner (
              numero_orden,
              id,
              company_id
            )
          ),
          profiles:responsable_id (
            full_name
          )
        `)
        .eq('ordenes_trabajo_items.ordenes_trabajo.company_id', companyId)
        .eq('estado_paso', 'completado')
        .not('fecha_fin', 'is', null)
        .gte('fecha_fin', hace7Dias.toISOString())
        .order('fecha_fin', { ascending: false })
        .limit(10);

      if (pasosCompletados) {
        pasosCompletados.forEach((paso: any) => {
          actividadesProduccion.push({
            id: `paso-comp-${paso.id}`,
            tipo: 'produccion',
            tipo_evento: 'paso_completado',
            descripcion: 'Paso completado',
            orden_numero: paso.ordenes_trabajo_items.ordenes_trabajo.numero_orden,
            orden_id: paso.ordenes_trabajo_items.ordenes_trabajo.id,
            usuario_nombre: paso.profiles?.full_name || null,
            tiempo_relativo: formatTiempoRelativo(paso.fecha_fin),
            created_at: paso.fecha_fin,
            detalle_extra: paso.paso_nombre,
          });
        });
      }

      const { data: pausasRecientes } = await supabase
        .from('ordenes_items_rutas_pausas')
        .select(`
          id,
          fecha_inicio_pausa,
          fecha_fin_pausa,
          ordenes_trabajo_items_rutas!inner (
            paso_nombre,
            ordenes_trabajo_items!inner (
              ordenes_trabajo!inner (
                numero_orden,
                id,
                company_id
              )
            )
          ),
          pasos_motivos_pausa (
            nombre
          ),
          pausado_por_profile:pausado_por (
            full_name
          ),
          reanudado_por_profile:reanudado_por (
            full_name
          )
        `)
        .eq('ordenes_trabajo_items_rutas.ordenes_trabajo_items.ordenes_trabajo.company_id', companyId)
        .gte('fecha_inicio_pausa', hace7Dias.toISOString())
        .order('fecha_inicio_pausa', { ascending: false })
        .limit(10);

      if (pausasRecientes) {
        pausasRecientes.forEach((pausa: any) => {
          actividadesProduccion.push({
            id: `pausa-ini-${pausa.id}`,
            tipo: 'produccion',
            tipo_evento: 'paso_pausado',
            descripcion: 'Paso pausado',
            orden_numero: pausa.ordenes_trabajo_items_rutas.ordenes_trabajo_items.ordenes_trabajo.numero_orden,
            orden_id: pausa.ordenes_trabajo_items_rutas.ordenes_trabajo_items.ordenes_trabajo.id,
            usuario_nombre: pausa.pausado_por_profile?.full_name || null,
            tiempo_relativo: formatTiempoRelativo(pausa.fecha_inicio_pausa),
            created_at: pausa.fecha_inicio_pausa,
            detalle_extra: `${pausa.ordenes_trabajo_items_rutas.paso_nombre} - ${pausa.pasos_motivos_pausa?.nombre || 'Sin motivo'}`,
          });

          if (pausa.fecha_fin_pausa) {
            actividadesProduccion.push({
              id: `pausa-fin-${pausa.id}`,
              tipo: 'produccion',
              tipo_evento: 'paso_reanudado',
              descripcion: 'Paso reanudado',
              orden_numero: pausa.ordenes_trabajo_items_rutas.ordenes_trabajo_items.ordenes_trabajo.numero_orden,
              orden_id: pausa.ordenes_trabajo_items_rutas.ordenes_trabajo_items.ordenes_trabajo.id,
              usuario_nombre: pausa.reanudado_por_profile?.full_name || null,
              tiempo_relativo: formatTiempoRelativo(pausa.fecha_fin_pausa),
              created_at: pausa.fecha_fin_pausa,
              detalle_extra: pausa.ordenes_trabajo_items_rutas.paso_nombre,
            });
          }
        });
      }

      const todasActividades = [...actividadesOrdenes, ...actividadesProduccion]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15);

      setActividadReciente(todasActividades);
    } catch (err) {
      console.error('Error loading actividad reciente:', err);
    }
  }, [companyId]);

  const loadAllData = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadStats(),
        loadTasaCumplimiento(),
        loadProximasEntregas(),
        loadActividadReciente(),
        loadOrdenesPorDia(),
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId, loadStats, loadTasaCumplimiento, loadProximasEntregas, loadActividadReciente, loadOrdenesPorDia]);

  useEffect(() => {
    loadAllData();

    const interval = setInterval(() => {
      loadAllData();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadAllData]);

  const refresh = () => {
    loadAllData();
  };

  return {
    loading,
    error,
    stats,
    tasaCumplimiento,
    proximasEntregas,
    actividadReciente,
    ordenesPorDia,
    refresh,
  };
}
