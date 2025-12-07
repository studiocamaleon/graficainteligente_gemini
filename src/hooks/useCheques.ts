import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Cheque } from '../types/database';

export function useCheques() {
    const { company } = useAuth();
    const [cheques, setCheques] = useState<Cheque[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCheques = async () => {
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
        } catch (err: any) {
            console.error('Error fetching cheques:', err);
            setError(err.message || 'Error al cargar cheques');
        } finally {
            setLoading(false);
        }
    };

    const createCheque = async (data: Omit<Cheque, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
        if (!company) throw new Error('No company');

        try {
            const { error } = await supabase
                .from('cheques_cartera')
                .insert([{
                    ...data,
                    company_id: company.id,
                    created_by: null // or profile.id if available
                }] as any);

            if (error) throw error;
            await fetchCheques();
        } catch (err: any) {
            throw err;
        }
    };

    const updateCheque = async (id: string, data: Partial<Cheque>) => {
        try {
            const { error } = await supabase
                .from('cheques_cartera')
                .update(data as any)
                .eq('id', id);

            if (error) throw error;
            await fetchCheques();
        } catch (err: any) {
            throw err;
        }
    };

    const deleteCheque = async (id: string) => {
        try {
            const { error } = await supabase
                .from('cheques_cartera')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchCheques();
        } catch (err: any) {
            throw err;
        }
    };

    useEffect(() => {
        fetchCheques();
    }, [company?.id]);

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
