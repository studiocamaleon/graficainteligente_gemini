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

export interface OrdenTrabajoWithRelations extends OrdenTrabajo {
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
  totalOrdenesMes: number;
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
    totalOrdenesMes: 0,
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
      const { data, error: metricsError } = await supabase
        .from('ordenes_trabajo')
        .select('estado, total, fecha_creacion')
        .eq('company_id', profile.company_id);

      if (metricsError) throw metricsError;

      if (data) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const totalOrdenes = data.length;
        const totalOrdenesMes = data.filter(
          (o) => new Date(o.fecha_creacion).getTime() >= startOfMonth.getTime()
        ).length;
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
          totalOrdenesMes,
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

      let data: any[] | null = null;
      let count: number | null = 0;

      // START OF SEARCH LOGIC
      const normalizedSearchTerm = searchTerm.trim();
      if (normalizedSearchTerm.length > 0) {
        // Use RPC for search
        const { data: searchData, error: searchError } = await supabase
          .rpc('fn_search_ordenes_trabajo', {
            p_search_term: normalizedSearchTerm,
            p_company_id: profile.company_id,
            p_limit: itemsPerPage,
            p_offset: (page - 1) * itemsPerPage
          });

        if (searchError) throw searchError;

        data = searchData;
        // RPC now returns full_count in each row (window function)
        // If data exists, take the count from the first row. If no data, count is 0.
        if (searchData && searchData.length > 0) {
          count = searchData[0].full_count;
        } else {
          count = 0;
        }

      } else {
        // Standard Fetch Logic
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

        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        query = query.order('fecha_creacion', { ascending: false }).range(from, to);

        const { data: standardData, error: standardError, count: standardCount } = await query;
        if (standardError) throw standardError;

        data = standardData;
        count = standardCount;
      }

      if (data) {
        // If it came from RPC, the structure is flat (except for what we defined)
        // RPC returns: id, numero_orden, cliente_nombre, etc.
        // We need to map it to OrdenTrabajoWithRelations interface mostly for the UI to work.

        const mappedData = await Promise.all(data.map(async (item: any) => {
          // If RPC source, we have flat fields. If Standard source, we have nested objects.
          const isRpc = Object.prototype.hasOwnProperty.call(item, 'full_count');

          if (isRpc) {
            return {
              id: item.id,
              numero_orden: item.numero_orden,
              fecha_creacion: item.fecha_creacion,
              estado: item.estado,
              total: item.total,
              company_id: profile.company_id, // Implied
              // Reconstruct relationships
              cliente: item.cliente_id ? {
                id: item.cliente_id,
                nombre_fantasia: item.cliente_nombre || 'Sin cliente',
                numero_documento: item.cliente_documento || ''
              } : undefined,
              items_count: item.items_count,
              total_pagado: item.total_pagado,
              // Some fields might be missing in RPC return, fill defaults or fetch if critical
            } as OrdenTrabajoWithRelations;
          } else {
            // Standard Logic: fetch counts manually as before
            const { count: itemsCount } = await supabase
              .from('ordenes_trabajo_items')
              .select('*', { count: 'exact', head: true })
              .eq('orden_id', item.id);

            const { data: pagosData } = await supabase
              .from('ordenes_trabajo_pagos')
              .select('monto')
              .eq('orden_id', item.id);

            const totalPagado = pagosData?.reduce((sum, p) => sum + Number(p.monto), 0) || 0;

            return {
              ...item,
              items_count: itemsCount || 0,
              total_pagado: totalPagado
            } as OrdenTrabajoWithRelations;
          }
        }));

        setOrdenes(mappedData);
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
