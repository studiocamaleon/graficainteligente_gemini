import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Egreso, CreateEgresoData, UpdateEgresoData } from '../types/tesoreria';
import { useAuth } from './useAuth';

interface FetchEgresosFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  caja_id?: string;
  tipo_egreso_id?: string;
}

import { useRegistrarConsumo } from './useTarjetas';
import { getArgentinaDateString } from '../utils/dates';

export function useEgresos(filters?: FetchEgresosFilters) {
  const { company, user } = useAuth();
  const { registrarConsumo } = useRegistrarConsumo();
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchEgresos = async () => {
    if (!company) return;

    try {
      setLoading(true);
      let query = supabase
        .from('egresos')
        .select(`
          *,
          caja:cajas(nombre, moneda, tipo),
          tipo_egreso:tipos_egreso(nombre, color, icono),
          proveedor:providers(nombre_fantasia, razon_social),
          created_by_profile:profiles!egresos_created_by_fkey(full_name)
        `)
        .eq('company_id', company.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.fecha_desde) {
        query = query.gte('fecha', filters.fecha_desde);
      }
      if (filters?.fecha_hasta) {
        query = query.lte('fecha', filters.fecha_hasta);
      }
      if (filters?.caja_id) {
        query = query.eq('caja_id', filters.caja_id);
      }
      if (filters?.tipo_egreso_id) {
        query = query.eq('tipo_egreso_id', filters.tipo_egreso_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const egresosData = (data || []) as Egreso[];
      setEgresos(egresosData);
      setTotal(egresosData.reduce((sum, e) => sum + Number(e.monto), 0));
    } catch (error) {
      console.error('Error fetching egresos:', error);
    } finally {
      setLoading(false);
    }
  };


  const createEgreso = async (data: CreateEgresoData) => {
    if (!company || !user) throw new Error('No company or user');

    // 1. Tarjetas de Crédito: Consumo a Resumen
    if (data.medio_pago === 'tarjeta' && data.tarjeta_id) {
      if (!data.cuotas) throw new Error('Cuotas requeridas para pago con tarjeta');

      await registrarConsumo({
        tarjeta_id: data.tarjeta_id,
        fecha_compra: data.fecha,
        descripcion: data.concepto,
        monto_total: data.monto,
        cuotas: data.cuotas,
        categoria_id: undefined,
        comprobante_url: undefined
      });
    }

    // 2. Cheques: Cartera de Cheques
    if (data.medio_pago === 'cheque') {
      if (!data.numero_cheque || !data.banco || !data.fecha_pago) {
        throw new Error('Faltan datos del cheque');
      }

      // Crear cheque emitido
      const { error: checkError } = await supabase
        .from('cheques_cartera')
        .insert([{
          company_id: company.id,
          tipo: 'fisico', // Default for expense
          direction: 'emitido',
          estado: 'pendiente',
          numero_cheque: data.numero_cheque,
          banco: data.banco,
          fecha_emision: getArgentinaDateString(), // Use local date
          fecha_pago: data.fecha_pago, // Vencimiento
          monto: data.monto,
          destinatario: data.destinatario || data.concepto,
          descripcion: `Pago Egreso: ${data.concepto}`,
          created_by: user.id
        }]);

      if (checkError) throw checkError;
    }

    // Preparamos datos para insert (quitando campos UI-only)
    const dbData: any = {
      ...data,
      company_id: company.id,
      created_by: user.id
    };

    // Cleanup fields not in 'egresos' table
    delete dbData.cuotas;
    delete dbData.numero_cheque;
    delete dbData.fecha_pago;
    delete dbData.banco;
    delete dbData.destinatario;
    delete dbData.tarjeta_id; // tarjeta_id is actually in egresos? Let's check type. Yes, but optional.

    // Logic for caja_id:
    // - Tarjeta: caja_id = null (Deferred via resumen)
    // - Cheque: caja_id = null (Deferred via cheque portfolio)
    if (data.medio_pago === 'tarjeta' || data.medio_pago === 'cheque') {
      dbData.caja_id = null;
    }

    const { data: newEgreso, error } = await supabase
      .from('egresos')
      .insert([dbData])
      .select(`
        *,
        caja:cajas(nombre, moneda, tipo),
        tipo_egreso:tipos_egreso(nombre, color, icono),
        proveedor:providers(nombre_fantasia, razon_social)
      `)
      .single();

    if (error) throw error;
    await fetchEgresos();
    return newEgreso;
  };

  const updateEgreso = async (id: string, data: UpdateEgresoData) => {
    const { error } = await supabase
      .from('egresos')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    await fetchEgresos();
  };

  const deleteEgreso = async (id: string) => {
    const { error } = await supabase
      .from('egresos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchEgresos();
  };

  useEffect(() => {
    fetchEgresos();
  }, [company?.id, filters?.fecha_desde, filters?.fecha_hasta, filters?.caja_id, filters?.tipo_egreso_id]);

  return {
    egresos,
    loading,
    total,
    createEgreso,
    updateEgreso,
    deleteEgreso,
    refetch: fetchEgresos,
  };
}
