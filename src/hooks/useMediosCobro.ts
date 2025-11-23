import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { MedioCobro, MedioCobroFormData, MedioCobroFilters, TipoMedioCobro } from '../types/medios-cobro';

export function useMediosCobro() {
  const { company } = useAuth();
  const [mediosCobro, setMediosCobro] = useState<MedioCobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMediosCobro = useCallback(async (filters?: MedioCobroFilters) => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('medios_cobro')
        .select('*')
        .eq('company_id', company.id)
        .order('orden', { ascending: true });

      if (filters?.tipo) {
        query = query.eq('tipo', filters.tipo);
      }

      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters?.search) {
        query = query.ilike('nombre', `%${filters.search}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setMediosCobro(data || []);
    } catch (err) {
      console.error('Error fetching medios de cobro:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar medios de cobro');
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  const fetchMediosCobroActivos = useCallback(async () => {
    return fetchMediosCobro({ is_active: true });
  }, [fetchMediosCobro]);

  const fetchMediosCobroPorTipo = useCallback(async (tipo: TipoMedioCobro) => {
    return fetchMediosCobro({ tipo, is_active: true });
  }, [fetchMediosCobro]);

  const createMedioCobro = async (data: MedioCobroFormData) => {
    if (!company?.id) throw new Error('No company ID');

    try {
      const maxOrden = mediosCobro.length > 0
        ? Math.max(...mediosCobro.map(m => m.orden))
        : 0;

      const { data: newMedio, error: createError } = await supabase
        .from('medios_cobro')
        .insert({
          company_id: company.id,
          ...data,
          orden: maxOrden + 1,
        })
        .select()
        .single();

      if (createError) throw createError;

      setMediosCobro(prev => [...prev, newMedio]);
      return newMedio;
    } catch (err) {
      console.error('Error creating medio de cobro:', err);
      throw err;
    }
  };

  const updateMedioCobro = async (id: string, data: Partial<MedioCobroFormData>) => {
    try {
      const { data: updatedMedio, error: updateError } = await supabase
        .from('medios_cobro')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      setMediosCobro(prev =>
        prev.map(medio => (medio.id === id ? updatedMedio : medio))
      );
      return updatedMedio;
    } catch (err) {
      console.error('Error updating medio de cobro:', err);
      throw err;
    }
  };

  const deleteMedioCobro = async (id: string) => {
    try {
      const { error: checkError } = await supabase
        .from('ordenes_trabajo_pagos')
        .select('id')
        .eq('medio_cobro_id', id)
        .limit(1)
        .single();

      if (!checkError || checkError.code !== 'PGRST116') {
        throw new Error('No se puede eliminar este medio de cobro porque tiene pagos asociados. Considere desactivarlo en su lugar.');
      }

      const { error: deleteError } = await supabase
        .from('medios_cobro')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setMediosCobro(prev => prev.filter(medio => medio.id !== id));
    } catch (err) {
      console.error('Error deleting medio de cobro:', err);
      throw err;
    }
  };

  const toggleActiveMedioCobro = async (id: string) => {
    const medio = mediosCobro.find(m => m.id === id);
    if (!medio) return;

    return updateMedioCobro(id, { is_active: !medio.is_active });
  };

  const reorderMediosCobro = async (ids: string[]) => {
    try {
      const updates = ids.map((id, index) =>
        supabase
          .from('medios_cobro')
          .update({ orden: index + 1 })
          .eq('id', id)
      );

      await Promise.all(updates);

      await fetchMediosCobro();
    } catch (err) {
      console.error('Error reordering medios de cobro:', err);
      throw err;
    }
  };

  const calcularComisionYLiberacion = (medioId: string, monto: number) => {
    const medio = mediosCobro.find(m => m.id === medioId);
    if (!medio) {
      return {
        comision: 0,
        montoNeto: monto,
        diasLiberacion: 0,
        fechaLiberacion: new Date(),
      };
    }

    const comision = (monto * medio.comision_porcentaje) / 100;
    const montoNeto = monto - comision;
    const fechaLiberacion = new Date();
    fechaLiberacion.setDate(fechaLiberacion.getDate() + medio.dias_liberacion);

    return {
      comision,
      montoNeto,
      diasLiberacion: medio.dias_liberacion,
      fechaLiberacion,
    };
  };

  useEffect(() => {
    fetchMediosCobro();
  }, [fetchMediosCobro]);

  return {
    mediosCobro,
    loading,
    error,
    fetchMediosCobro,
    fetchMediosCobroActivos,
    fetchMediosCobroPorTipo,
    createMedioCobro,
    updateMedioCobro,
    deleteMedioCobro,
    toggleActiveMedioCobro,
    reorderMediosCobro,
    calcularComisionYLiberacion,
  };
}
