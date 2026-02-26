import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { OrdenTrabajo, EstadoOrdenTrabajo, CanalVenta } from '../types/database';
import { clampZeroMoney, roundMoney, toMoney } from '../utils/money';

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
  draftsOnly?: boolean;
  includeDrafts?: boolean;
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
  ordenesFinalizadas: number;
  ordenesEntregadas: number;
  ordenesCanceladas: number;
  totalOrdenesOt: number;
  totalOrdenesCopiado: number;
  totalFacturadoOt: number;
  totalFacturadoCopiado: number;
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
    ordenesFinalizadas: 0,
    ordenesEntregadas: 0,
    ordenesCanceladas: 0,
    totalOrdenesOt: 0,
    totalOrdenesCopiado: 0,
    totalFacturadoOt: 0,
    totalFacturadoCopiado: 0,
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
    draftsOnly = false,
    includeDrafts = false,
  } = params;

  const fetchMetrics = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const [{ data: ordenesOt, error: otError }, { data: ordenesCopiado, error: ccError }] = await Promise.all([
        supabase
          .from('ordenes_trabajo')
          .select('estado, total, fecha_creacion')
          .eq('company_id', profile.company_id),
        supabase
          .from('centro_copiado_ordenes')
          .select('estado, total, created_at')
          .eq('company_id', profile.company_id),
      ]);

      if (otError) throw otError;
      if (ccError) throw ccError;

      const otRows = ordenesOt || [];
      const ccRows = ordenesCopiado || [];
      const otOperativas = otRows.filter((o) => o.estado !== 'borrador');
      const ccOperativas = ccRows.filter((o) => o.estado !== 'borrador');
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const totalOrdenesOt = otOperativas.length;
      const totalOrdenesCopiado = ccOperativas.length;
      const totalOrdenes = totalOrdenesOt + totalOrdenesCopiado;

      const totalOrdenesMesOt = otOperativas.filter(
        (o) => new Date(o.fecha_creacion).getTime() >= startOfMonth.getTime()
      ).length;
      const totalOrdenesMesCopiado = ccOperativas.filter(
        (o) => new Date(o.created_at).getTime() >= startOfMonth.getTime()
      ).length;
      const totalOrdenesMes = totalOrdenesMesOt + totalOrdenesMesCopiado;

      const totalFacturadoOt = otRows
        .filter((o) => o.estado !== 'cancelada' && o.estado !== 'borrador')
        .reduce((sum, o) => sum + roundMoney(toMoney(o.total)), 0);
      const totalFacturadoCopiado = ccRows
        .filter((o) => o.estado !== 'cancelada' && o.estado !== 'borrador')
        .reduce((sum, o) => sum + roundMoney(toMoney(o.total)), 0);
      const totalFacturado = totalFacturadoOt + totalFacturadoCopiado;

      const ordenesPendientes = otOperativas.filter((o) => o.estado === 'pendiente').length
        + ccOperativas.filter((o) => o.estado === 'pendiente').length;
      const ordenesEnProduccion = otOperativas.filter((o) => o.estado === 'en_proceso').length
        + ccOperativas.filter((o) => o.estado === 'en_proceso').length;
      const ordenesFinalizadas = otOperativas.filter((o) => o.estado === 'finalizada').length
        + ccOperativas.filter((o) => o.estado === 'finalizada').length;
      const ordenesEntregadas = otOperativas.filter((o) => o.estado === 'entregada').length
        + ccOperativas.filter((o) => o.estado === 'entregada').length;
      const ordenesCanceladas = otOperativas.filter((o) => o.estado === 'cancelada').length
        + ccOperativas.filter((o) => o.estado === 'cancelada').length;

      setMetrics({
        totalOrdenes,
        totalOrdenesMes,
        totalFacturado,
        ordenesPendientes,
        ordenesEnProduccion,
        ordenesFinalizadas,
        ordenesEntregadas,
        ordenesCanceladas,
        totalOrdenesOt,
        totalOrdenesCopiado,
        totalFacturadoOt,
        totalFacturadoCopiado,
      });
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
            p_offset: (page - 1) * itemsPerPage,
            p_include_drafts: includeDrafts,
            p_drafts_only: draftsOnly,
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
        } else if (draftsOnly) {
          query = query.eq('estado', 'borrador');
        } else if (!includeDrafts) {
          query = query.neq('estado', 'borrador');
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
    draftsOnly,
    includeDrafts,
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
