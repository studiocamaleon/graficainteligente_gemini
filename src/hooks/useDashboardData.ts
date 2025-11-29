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

      const { data: ordenesPendientes } = await supabase
        .from('ordenes_trabajo')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('estado', 'pendiente');

      const { data: ordenesEnProceso } = await supabase
        .from('ordenes_trabajo')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('estado', 'en_proceso');

      const { data: entregasHoyData } = await supabase
        .from('ordenes_trabajo')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('estado', ['pendiente', 'en_proceso'])
        .gte('fecha_estimada_entrega', hoy.toISOString())
        .lt('fecha_estimada_entrega', manana.toISOString());

      setStats({
        ordenesPendientes: ordenesPendientes?.length || 0,
        ordenesEnProceso: ordenesEnProceso?.length || 0,
        entregasHoy: entregasHoyData?.length || 0,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [companyId]);

  const loadTasaCumplimiento = useCallback(async () => {
    if (!companyId) return;

    try {
      const { data, error } = await supabase.rpc('fn_tasa_cumplimiento', {
        p_company_id: companyId,
        p_fecha_desde: null,
        p_fecha_hasta: null,
      });

      if (error) {
        console.error('Error loading tasa cumplimiento:', error);
        return;
      }

      if (data && data.length > 0) {
        setTasaCumplimiento(data[0]);
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
        .gte('fecha_estimada_entrega', hoy.toISOString())
        .order('fecha_estimada_entrega', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Error loading próximas entregas:', error);
        return;
      }

      const entregas: ProximaEntrega[] = (data || []).map((orden: any) => {
        const totalPasos = orden.ordenes_trabajo_items?.reduce((acc: number, item: any) => {
          return acc + (item.ordenes_trabajo_items_rutas?.length || 0);
        }, 0) || 0;

        const pasosCompletados = orden.ordenes_trabajo_items?.reduce((acc: number, item: any) => {
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
      const { data, error } = await supabase
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

      if (error) {
        console.error('Error loading actividad reciente:', error);
        return;
      }

      const actividades: ActividadReciente[] = (data || [])
        .filter((item: any) => item.ordenes_trabajo)
        .map((item: any) => ({
          id: item.id,
          tipo_evento: item.tipo_evento,
          descripcion: item.descripcion,
          orden_numero: item.ordenes_trabajo.numero_orden,
          orden_id: item.ordenes_trabajo.id,
          usuario_nombre: item.profiles?.full_name || null,
          tiempo_relativo: formatTiempoRelativo(item.created_at),
          created_at: item.created_at,
        }));

      setActividadReciente(actividades);
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
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId, loadStats, loadTasaCumplimiento, loadProximasEntregas, loadActividadReciente]);

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
    refresh,
  };
}
