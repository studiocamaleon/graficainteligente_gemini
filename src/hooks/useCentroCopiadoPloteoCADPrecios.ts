import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoPloteoCADPrecio } from '../types/database';

export function useCentroCopiadoPloteoCADPrecios() {
    const { profile } = useAuth();
    const [precios, setPrecios] = useState<CentroCopiadoPloteoCADPrecio[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPrecios = useCallback(async () => {
        if (!profile?.company_id) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('centro_copiado_ploteo_cad_precios')
                .select('*')
                .eq('company_id', profile.company_id)
                .eq('is_active', true)
                .order('tipo_papel', { ascending: true })
                .order('ancho_cm', { ascending: true });

            if (error) throw error;
            setPrecios(data || []);
        } catch (error) {
            console.error('Error fetching ploteo CAD prices:', error);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => {
        fetchPrecios();
    }, [fetchPrecios]);

    const createPrecio = async (data: Omit<CentroCopiadoPloteoCADPrecio, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'is_active'>) => {
        if (!profile?.company_id) return false;

        try {
            const { error } = await supabase
                .from('centro_copiado_ploteo_cad_precios')
                .insert({
                    ...data,
                    company_id: profile.company_id,
                    is_active: true
                } as any);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error creating ploteo CAD price:', error);
            return false;
        }
    };

    const updatePrecio = async (id: string, data: Partial<Omit<CentroCopiadoPloteoCADPrecio, 'id' | 'created_at' | 'updated_at' | 'company_id'>>) => {
        try {
            const { error } = await supabase
                .from('centro_copiado_ploteo_cad_precios')
                .update(data as any)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating ploteo CAD price:', error);
            return false;
        }
    };

    const deletePrecio = async (id: string) => {
        try {
            const { error } = await supabase
                .from('centro_copiado_ploteo_cad_precios')
                .update({ is_active: false } as any)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting ploteo CAD price:', error);
            return false;
        }
    };

    return {
        precios,
        loading,
        fetchPrecios,
        createPrecio,
        updatePrecio,
        deletePrecio
    };
}
