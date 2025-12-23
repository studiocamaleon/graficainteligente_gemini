import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { Visita, VisitasConfig } from '../types/database';

export function useVisitas() {
    const { company, user } = useAuth();
    // Debug log to confirm company is now found
    console.log('UseVisitas: Company Object:', company);
    const companyId = company?.id;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadConfig = useCallback(async (): Promise<VisitasConfig | null> => {
        if (!companyId) return null;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visitas_config')
                .select('*')
                .eq('company_id', companyId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
            return data;
        } catch (err: any) {
            console.error('Error loading config:', err);
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    const updateConfig = useCallback(async (config: Partial<VisitasConfig>) => {
        console.log('UseVisitas: updateConfig called. CompanyID:', companyId);
        if (!companyId) {
            console.error('UseVisitas: No company_id found, aborting update.');
            return null;
        }
        try {
            setLoading(true);

            const payload: any = { ...config, company_id: companyId };
            console.log('UseVisitas: Saving config payload:', payload);

            const { data, error } = await supabase
                .from('visitas_config')
                .upsert(payload, { onConflict: 'company_id' })
                .select()
                .single();

            if (error) {
                console.error('UseVisitas: Update error:', error);
                throw error;
            }
            console.log('UseVisitas: Saved response:', data);
            return data;
        } catch (err: any) {
            console.error('Error updating config:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    const loadVisitas = useCallback(async (startDate: Date, endDate: Date) => {
        if (!companyId) return [];
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visitas')
                .select('*')
                .eq('company_id', companyId)
                .gte('fecha_inicio', startDate.toISOString())
                .lte('fecha_inicio', endDate.toISOString())
                .order('fecha_inicio', { ascending: true });

            if (error) throw error;
            return data as Visita[];
        } catch (err: any) {
            console.error('Error loading visitas:', err);
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    const createVisita = useCallback(async (visita: Omit<Visita, 'id' | 'created_at' | 'updated_at' | 'company_id' | 'creado_por'>) => {
        if (!companyId || !user?.id) return null;
        try {
            setLoading(true);
            const payload = {
                ...visita,
                company_id: companyId,
                creado_por: user.id
            };

            const { data, error } = await supabase
                .from('visitas')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            return data as Visita;
        } catch (err: any) {
            console.error('Error creating visita:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [companyId, user]);

    const updateVisita = useCallback(async (id: string, updates: Partial<Visita>) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visitas')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as Visita;
        } catch (err: any) {
            console.error('Error updating visita:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteVisita = useCallback(async (id: string) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('visitas')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Error deleting visita:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        loadConfig,
        updateConfig,
        loadVisitas,
        createVisita,
        updateVisita,
        deleteVisita
    };
}
