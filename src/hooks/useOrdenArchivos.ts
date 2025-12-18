import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface OrdenArchivo {
    id: string;
    orden_id: string | null;
    orden_temporal_id: string | null;
    company_id: string;
    nombre_archivo: string;
    nombre_storage: string;
    tipo_mime: string;
    tamano_bytes: number;
    storage_path: string;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
}

interface UseOrdenArchivosProps {
    ordenId?: string;
    ordenTemporalId?: string;
}

export function useOrdenArchivos({ ordenId, ordenTemporalId }: UseOrdenArchivosProps = {}) {
    const { profile } = useAuth();
    const [archivos, setArchivos] = useState<OrdenArchivo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchArchivos = useCallback(async () => {
        if (!profile?.company_id || (!ordenId && !ordenTemporalId)) {
            setArchivos([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('ordenes_trabajo_archivos')
                .select('*')
                .eq('company_id', profile.company_id)
                .order('created_at', { ascending: false });

            if (ordenId) {
                query = query.eq('orden_id', ordenId);
            } else if (ordenTemporalId) {
                query = query.eq('orden_temporal_id', ordenTemporalId);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setArchivos(data || []);
        } catch (err: any) {
            console.error('[useOrdenArchivos] Error fetching:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id, ordenId, ordenTemporalId]);

    useEffect(() => {
        fetchArchivos();
    }, [fetchArchivos]);

    const createArchivo = async (data: Partial<OrdenArchivo>) => {
        if (!profile?.company_id) return null;

        try {
            const { data: newArchivo, error: insertError } = await supabase
                .from('ordenes_trabajo_archivos')
                .insert({
                    ...data,
                    company_id: profile.company_id,
                    uploaded_by: profile.id
                })
                .select()
                .single();

            if (insertError) throw insertError;

            setArchivos(prev => [newArchivo, ...prev]);
            return newArchivo;
        } catch (err: any) {
            console.error('[useOrdenArchivos] Error creating:', err);
            return null;
        }
    };

    const deleteArchivo = async (id: string) => {
        try {
            const { error: deleteError } = await supabase
                .from('ordenes_trabajo_archivos')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            setArchivos(prev => prev.filter(a => a.id !== id));
            return true;
        } catch (err: any) {
            console.error('[useOrdenArchivos] Error deleting:', err);
            return false;
        }
    };

    return {
        archivos,
        loading,
        error,
        createArchivo,
        deleteArchivo,
        refetch: fetchArchivos
    };
}
