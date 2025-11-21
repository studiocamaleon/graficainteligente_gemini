import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { OrdenTrabajo, EstadoOrdenTrabajo, CanalVenta } from '../types/database';

interface UseOrdenesTrabajoParams {
  searchTerm?: string;
  estado?: EstadoOrdenTrabajo | null;
  canalVenta?: CanalVenta | null;
  clienteId?: string | null;
  vendedorId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  page?: number;
  itemsPerPage?: number;
}

interface OrdenTrabajoWithRelations extends OrdenTrabajo {
  cliente?: {
    id: string;
    nombre_fantasia: string;
    numero_documento: string;
  };
  created_by_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  items_count?: number;
  total_pagado?: number;
}

interface OrdenesMetrics {
  totalOrdenes: number;
  totalFacturado: number;
  ordenesPendientes: number;
  ordenesEnProduccion: number;
  ordenesEntregadas: number;
}

export function useOrdenesTrabajo(params: UseOrdenesTrabajoParams = {}) {
  const { profile } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenTrabajoWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<OrdenesMetrics>({
    totalOrdenes: 0,
    totalFacturado: 0,
    ordenesPendientes: 0,
    ordenesEnProduccion: 0,
    ordenesEntregadas: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    searchTerm = '',
    estado = null,
    canalVenta = null,
    clienteId = null,
    vendedorId = null,
    fechaDesde = null,
    fechaHasta = null,
    page = 1,
    itemsPerPage = 25,
  } = params;

  const fetchMetrics = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error: metricsError } = await supabase
        .from('ordenes_trabajo')
        .select('estado, total')
        .eq('company_id', profile.company_id)
        .gte('fecha_creacion', startOfMonth.toISOString());

      if (metricsError) throw metricsError;

      if (data) {
        const totalOrdenes = data.length;
        const totalFacturado = data
          .filter((o) => o.estado !== 'cancelada')
          .reduce((sum, o) => sum + Number(o.total), 0);
        const ordenesPendientes = data.filter(
          (o) => o.estado === 'pendiente'
        ).length;
        const ordenesEnProduccion = data.filter((o) => o.estado === 'en_proceso').length;
        const ordenesEntregadas = data.filter((o) => o.estado === 'entregada').length;

        setMetrics({
          totalOrdenes,
          totalFacturado,
          ordenesPendientes,
          ordenesEnProduccion,
          ordenesEntregadas,
        });
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }, [profile?.company_id]);

  const fetchOrdenes = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      setError(null);

      // Nota: Usamos profiles!ordenes_trabajo_created_by_fkey para especificar explícitamente la relación
      // ya que ordenes_trabajo tiene múltiples FKs a profiles (vendedor_id, created_by, updated_by)
      let query = supabase
        .from('ordenes_trabajo')
        .select(
          `
          *,
          cliente:clients(id, nombre_fantasia, numero_documento),
          created_by_profile:profiles!ordenes_trabajo_created_by_fkey(id, full_name, avatar_url)
        `,
          { count: 'exact' }
        )
        .eq('company_id', profile.company_id);

      if (estado) {
        query = query.eq('estado', estado);
      }

      if (canalVenta) {
        query = query.eq('canal_venta', canalVenta);
      }

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      if (vendedorId) {
        // Nota: Por ahora filtramos por created_by ya que vendedor_id está reservado para futura funcionalidad
        query = query.eq('created_by', vendedorId);
      }

      if (fechaDesde) {
        query = query.gte('fecha_creacion', fechaDesde);
      }

      if (fechaHasta) {
        query = query.lte('fecha_creacion', fechaHasta);
      }

      if (searchTerm) {
        query = query.or(
          `numero_orden.ilike.%${searchTerm}%,notas_internas.ilike.%${searchTerm}%`
        );
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order('fecha_creacion', { ascending: false }).range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      if (data) {
        const ordenesWithCounts = await Promise.all(
          data.map(async (orden) => {
            const { count: itemsCount } = await supabase
              .from('ordenes_trabajo_items')
              .select('*', { count: 'exact', head: true })
              .eq('orden_id', orden.id);

            const { data: pagosData } = await supabase
              .from('ordenes_trabajo_pagos')
              .select('monto')
              .eq('orden_id', orden.id);

            const totalPagado = pagosData?.reduce((sum, p) => sum + Number(p.monto), 0) || 0;

            return {
              ...orden,
              items_count: itemsCount || 0,
              total_pagado: totalPagado,
            };
          })
        );

        setOrdenes(ordenesWithCounts as OrdenTrabajoWithRelations[]);
        setTotalCount(count || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar órdenes');
      console.error('Error fetching ordenes:', err);
    } finally {
      setLoading(false);
    }
  }, [
    profile?.company_id,
    searchTerm,
    estado,
    canalVenta,
    clienteId,
    vendedorId,
    fechaDesde,
    fechaHasta,
    page,
    itemsPerPage,
  ]);

  useEffect(() => {
    fetchOrdenes();
    fetchMetrics();
  }, [fetchOrdenes, fetchMetrics]);

  const refetch = () => {
    fetchOrdenes();
    fetchMetrics();
  };

  return {
    ordenes,
    totalCount,
    metrics,
    loading,
    error,
    refetch,
  };
}
