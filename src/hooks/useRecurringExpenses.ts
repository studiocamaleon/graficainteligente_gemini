import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { RecurringExpense } from '../types/database';

export function useRecurringExpenses() {
    const { company, profile } = useAuth();
    const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchExpenses = async () => {
        if (!company) return;

        try {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from('recurring_expenses')
                .select(`
          *,
          provider:providers(id, nombre_fantasia, razon_social),
          tipo:tipos_egreso(id, nombre, color)
        `)
                .eq('company_id', company.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setExpenses(data || []);
        } catch (err: any) {
            console.error('Error fetching recurring expenses:', err);
            setError(err.message || 'Error al cargar gastos recurrentes');
        } finally {
            setLoading(false);
        }
    };

    const createExpense = async (data: Omit<RecurringExpense, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
        if (!company) throw new Error('No company');

        try {
            const { error } = await supabase
                .from('recurring_expenses')
                .insert([{ ...data, company_id: company.id }]);

            if (error) throw error;
            await fetchExpenses();
        } catch (err: any) {
            throw err;
        }
    };

    const updateExpense = async (id: string, data: Partial<RecurringExpense>) => {
        try {
            const { error } = await supabase
                .from('recurring_expenses')
                .update(data)
                .eq('id', id);

            if (error) throw error;
            await fetchExpenses();
        } catch (err: any) {
            throw err;
        }
    };

    const deleteExpense = async (id: string) => {
        const canDeleteRecurring = profile?.role === 'admin' || profile?.role === 'super_admin';
        if (!canDeleteRecurring) {
            throw new Error('Solo admin o superadmin pueden eliminar gastos fijos.');
        }

        try {
            const { error } = await supabase
                .from('recurring_expenses')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
            await fetchExpenses();
        } catch (err: any) {
            throw err;
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, [company?.id]);

    return {
        expenses,
        loading,
        error,
        createExpense,
        updateExpense,
        deleteExpense,
        refetch: fetchExpenses,
    };
}
