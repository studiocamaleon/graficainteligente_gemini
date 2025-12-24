import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface CentroCopiadoPloteoCADOption {
    tipo_papel: string;
    ancho_cm: 60 | 90;
}

export function useCentroCopiadoPloteoCADOptions() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [papeles, setPapeles] = useState<string[]>([]);
    const [anchos, setAnchos] = useState<number[]>([]);

    useEffect(() => {
        async function fetchOptions() {
            if (!profile?.company_id) return;

            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('centro_copiado_ploteo_cad_precios')
                    .select('tipo_papel, ancho_cm')
                    .eq('company_id', profile.company_id)
                    .eq('is_active', true);

                if (error) throw error;

                if (data) {
                    // Extract unique paper types
                    const uniquePapeles = Array.from(new Set(data.map(item => item.tipo_papel))).sort();
                    setPapeles(uniquePapeles);

                    // Extract unique widths
                    const uniqueAnchos = Array.from(new Set(data.map(item => item.ancho_cm))).sort((a, b) => a - b);
                    setAnchos(uniqueAnchos);
                }
            } catch (err) {
                console.error('Error fetching ploteo CAD options:', err);
                setError('Error al cargar opciones de ploteo CAD');
            } finally {
                setLoading(false);
            }
        }

        fetchOptions();
    }, [profile?.company_id]);

    return { papeles, anchos, loading, error };
}
