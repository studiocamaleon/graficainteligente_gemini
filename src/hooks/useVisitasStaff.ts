import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface StaffMember {
    id: string;
    company_id: string;
    nombre: string;
    telefono: string; // whatsapp format
    rol: string;
    activo: boolean;
    created_at: string;
}

export function useVisitasStaff() {
    const { company } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadStaff = useCallback(async () => {
        if (!company?.id) return [];
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visitas_staff')
                .select('*')
                .eq('company_id', company.id)
                .order('nombre', { ascending: true });

            if (error) throw error;
            return data as StaffMember[];
        } catch (err: any) {
            console.error('Error loading staff:', err);
            setError(err.message);
            return [];
        } finally {
            setLoading(false);
        }
    }, [company?.id]);

    const createStaff = useCallback(async (member: Omit<StaffMember, 'id' | 'created_at' | 'company_id'>) => {
        if (!company?.id) return null;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visitas_staff')
                .insert({ ...member, company_id: company.id })
                .select()
                .single();

            if (error) throw error;
            return data as StaffMember;
        } catch (err: any) {
            console.error('Error creating staff:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [company?.id]);

    const updateStaff = useCallback(async (id: string, updates: Partial<StaffMember>) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('visitas_staff')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as StaffMember;
        } catch (err: any) {
            console.error('Error updating staff:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteStaff = useCallback(async (id: string) => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('visitas_staff')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err: any) {
            console.error('Error deleting staff:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        loadStaff,
        createStaff,
        updateStaff,
        deleteStaff
    };
}
