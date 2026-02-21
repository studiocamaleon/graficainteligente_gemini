import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Cheque } from '../types/database';

export function useCheques() {
    const { company, profile } = useAuth();
    const [cheques, setCheques] = useState<Cheque[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCheques = useCallback(async () => {
        if (!company) return;

        try {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from('cheques_cartera')
                .select(`
          *,
          provider:providers(id, nombre_fantasia, razon_social),
          client:clients(id, nombre_fantasia, razon_social)
        `)
                .eq('company_id', company.id)
                .order('fecha_pago', { ascending: true });

            if (error) throw error;

            setCheques(data || []);
        } catch (err) {
            console.error('Error fetching cheques:', err);
            setError(err instanceof Error ? err.message : 'Error al cargar cheques');
        } finally {
            setLoading(false);
        }
    }, [company]);

    const createCheque = async (data: Omit<Cheque, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
        if (!company) throw new Error('No company');
        const payload = {
            ...data,
            company_id: company.id,
            created_by: profile?.id || null,
        };
        const { error } = await supabase
            .from('cheques_cartera')
            .insert([payload]);

        if (error) throw error;
        await fetchCheques();
    };

    const updateCheque = async (id: string, data: Partial<Cheque>) => {
        const { error } = await supabase
            .from('cheques_cartera')
            .update(data)
            .eq('id', id);

        if (error) throw error;
        await fetchCheques();
    };

    const deleteCheque = async (id: string) => {
        try {
            const { error } = await supabase
                .from('cheques_cartera')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchCheques();
        } catch (err) {
            const anyErr = err as { code?: string };
            const code = anyErr?.code ? String(anyErr.code) : '';
            if (code === '42501') {
                throw new Error('No tenés permisos para eliminar cheques con tu rol actual.');
            }
            throw err;
        }
    };

    useEffect(() => {
        fetchCheques();
    }, [fetchCheques]);

    return {
        cheques,
        loading,
        error,
        createCheque,
        updateCheque,
        deleteCheque,
        refetch: fetchCheques,
    };
}
