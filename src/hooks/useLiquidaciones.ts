import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  Liquidacion,
  LiquidacionConDetalles,
  LiquidacionItem,
  LiquidacionPago,
  EstadoLiquidacion
} from '../types/database';
import dayjs from 'dayjs';

interface UseLiquidacionesParams {
  clienteId?: string;
  estado?: EstadoLiquidacion;
  page?: number;
  itemsPerPage?: number;
}

export function useLiquidaciones(params: UseLiquidacionesParams = {}) {
  const { company } = useAuth();
  const { clienteId, estado, page = 1, itemsPerPage = 25 } = params;

  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLiquidaciones = async () => {
    if (!company) return;

    setLoading(true);
    try {
      let query = supabase
        .from('liquidaciones')
        .select('*', { count: 'exact' })
        .eq('company_id', company.id)
        .order('fecha_emision', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      if (estado) {
        query = query.eq('estado', estado);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setLiquidaciones((data || []) as Liquidacion[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching liquidaciones:', error);
      setLiquidaciones([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiquidaciones();
  }, [company, clienteId, estado, page, itemsPerPage]);

  return {
    liquidaciones,
    totalCount,
    loading,
    refetch: fetchLiquidaciones,
  };
}

export function useLiquidacion(liquidacionId: string | null) {
  const [liquidacion, setLiquidacion] = useState<LiquidacionConDetalles | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLiquidacion = async () => {
    if (!liquidacionId) {
      setLiquidacion(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: liqData, error: liqError } = await supabase
        .from('liquidaciones')
        .select(`
          *,
          clients!liquidaciones_cliente_id_fkey(nombre_fantasia, numero_documento)
        `)
        .eq('id', liquidacionId)
        .single();

      if (liqError) throw liqError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('liquidaciones_items')
        .select('*')
        .eq('liquidacion_id', liquidacionId)
        .order('fecha_orden', { ascending: true });

      if (itemsError) throw itemsError;

      const { data: pagosData, error: pagosError } = await supabase
        .from('liquidaciones_pagos')
        .select(`
          id,
          monto_aplicado,
          created_at,
          ordenes_trabajo_pagos!liquidaciones_pagos_pago_id_fkey(
            fecha_pago,
            monto,
            medios_cobro(nombre)
          )
        `)
        .eq('liquidacion_id', liquidacionId)
        .order('created_at', { ascending: false });

      if (pagosError) throw pagosError;

      const liquidacionCompleta: LiquidacionConDetalles = {
        ...(liqData as Liquidacion),
        cliente_nombre: (liqData as any).clients.nombre_fantasia,
        cliente_documento: (liqData as any).clients.numero_documento,
        items: (itemsData || []) as LiquidacionItem[],
        pagos: (pagosData || []).map((p: any) => ({
          id: p.id,
          fecha_pago: p.ordenes_trabajo_pagos.fecha_pago,
          monto: p.ordenes_trabajo_pagos.monto,
          medio_cobro_nombre: p.ordenes_trabajo_pagos.medios_cobro?.nombre || null,
        })),
      };

      setLiquidacion(liquidacionCompleta);
    } catch (error) {
      console.error('Error fetching liquidacion:', error);
      setLiquidacion(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiquidacion();
  }, [liquidacionId]);

  return {
    liquidacion,
    loading,
    refetch: fetchLiquidacion,
  };
}

export function useLiquidacionMutations() {
  const { company, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const crearLiquidacion = async (data: {
    cliente_id: string;
    ordenes_ids: string[];
    periodo_desde?: string;
    periodo_hasta?: string;
    total_ajustes?: number;
    notas?: string;
    acuerdo_pago: string | null;
  }) => {
    if (!company || !profile) return null;

    setLoading(true);
    try {
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('fn_generar_numero_liquidacion', {
          p_company_id: company.id
        });

      if (numeroError) throw numeroError;

      const { data: ordenesData, error: ordenesError } = await supabase
        .from('ordenes_trabajo')
        .select('id, numero_orden, fecha_creacion, total')
        .in('id', data.ordenes_ids);

      if (ordenesError) throw ordenesError;

      const subtotal = ordenesData.reduce((sum, o) => sum + Number(o.total), 0);
      const totalAjustes = data.total_ajustes || 0;
      const totalGeneral = subtotal + totalAjustes;

      const diasAcuerdo = data.acuerdo_pago === 'Semanal' ? 7 :
                         data.acuerdo_pago === 'Quincenal' ? 15 : 30;

      const fechaVencimiento = dayjs().add(diasAcuerdo, 'day').format('YYYY-MM-DD');

      const { data: newLiquidacion, error: liqError } = await supabase
        .from('liquidaciones')
        .insert({
          company_id: company.id,
          cliente_id: data.cliente_id,
          numero_liquidacion: numeroData,
          fecha_emision: dayjs().format('YYYY-MM-DD'),
          fecha_vencimiento: fechaVencimiento,
          periodo_desde: data.periodo_desde || null,
          periodo_hasta: data.periodo_hasta || null,
          estado: 'pendiente',
          subtotal_ordenes: subtotal,
          total_ajustes: totalAjustes,
          total_general: totalGeneral,
          total_pagado: 0,
          saldo_pendiente: totalGeneral,
          notas: data.notas || null,
          created_by: profile.id,
        })
        .select()
        .single();

      if (liqError) throw liqError;

      const items = ordenesData.map((orden) => ({
        liquidacion_id: newLiquidacion.id,
        orden_id: orden.id,
        descripcion: `Orden ${orden.numero_orden}`,
        fecha_orden: dayjs(orden.fecha_creacion).format('YYYY-MM-DD'),
        numero_orden: orden.numero_orden,
        monto: Number(orden.total),
      }));

      const { error: itemsError } = await supabase
        .from('liquidaciones_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return newLiquidacion as Liquidacion;
    } catch (error) {
      console.error('Error creating liquidacion:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const anularLiquidacion = async (liquidacionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('liquidaciones')
        .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', liquidacionId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error anulando liquidacion:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    crearLiquidacion,
    anularLiquidacion,
    loading,
  };
}

export function useOrdenesPendientesLiquidar(clienteId: string) {
  const { company } = useAuth();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrdenesPendientes = async (fechaDesde?: string, fechaHasta?: string) => {
    if (!company || !clienteId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_obtener_ordenes_pendientes_liquidar', {
        p_company_id: company.id,
        p_cliente_id: clienteId,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || dayjs().format('YYYY-MM-DD'),
      });

      if (error) throw error;

      setOrdenes(data || []);
    } catch (error) {
      console.error('Error fetching ordenes pendientes:', error);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    ordenes,
    loading,
    fetchOrdenesPendientes,
  };
}
