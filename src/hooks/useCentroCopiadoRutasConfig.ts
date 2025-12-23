import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { CentroCopiadoRutaConfig } from '../types/centro_copiado_config';

export function useCentroCopiadoRutasConfig() {
    const { profile } = useAuth();
    const [configs, setConfigs] = useState<CentroCopiadoRutaConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfigs = useCallback(async () => {
        if (!profile?.company_id) return;

        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('centro_copiado_rutas_configuracion')
                .select(`
          *,
          paso:pasos(id, nombre)
        `)
                .eq('company_id', profile.company_id)
                .order('clave', { ascending: true })
                .order('valor', { ascending: true });

            if (fetchError) throw fetchError;

            setConfigs(data || []);
        } catch (err) {
            console.error('Error fetching ruta configs:', err);
            setError('Error al cargar configuraciones');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    const createConfig = async (config: Omit<CentroCopiadoRutaConfig, 'id' | 'created_at' | 'updated_at' | 'paso' | 'company_id'>) => {
        if (!profile?.company_id) return false;

        try {
            const { error: insertError } = await supabase
                .from('centro_copiado_rutas_configuracion')
                .insert([{
                    ...config,
                    company_id: profile.company_id
                }]);

            if (insertError) throw insertError;

            await fetchConfigs();
            return true;
        } catch (err: any) {
            console.error('Error creating ruta config:', err);
            if (err.code === '23505') {
                setError('Ya existe una regla para esta configuración y valor.');
            } else {
                setError('Error al crear configuración');
            }
            return false;
        }
    };

    const deleteConfig = async (id: string) => {
        try {
            const { error: deleteError } = await supabase
                .from('centro_copiado_rutas_configuracion')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            await fetchConfigs();
            return true;
        } catch (err) {
            console.error('Error deleting ruta config:', err);
            setError('Error al eliminar configuración');
            return false;
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    return {
        configs,
        loading,
        error,
        createConfig,
        deleteConfig,
        fetchConfigs
    };
}
