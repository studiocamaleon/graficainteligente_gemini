import { useState, useCallback } from 'react';
import { usePDFExport } from './usePDFExport';
import { ServiciosYAcabadosPDFTemplate } from '../components/pdf/templates/ServiciosYAcabadosPDFTemplate';

export function useServiciosYAcabadosExport() {
    const [isPreparing, setIsPreparing] = useState(false);

    // Fetch ALL data (large limit) when needed
    // We condition the fetch or just fetch always if it's cheap?
    // Better to fetch on demand. but hooks rule requires top level.
    // We can use the hooks but with a flag? No, standard hooks don't have 'skip'.
    // We will just use them with a large page size, but maybe we only want to fetch when button is clicked?
    // The existing hooks don't support lazy fetching easily without refetch.
    // We'll instantiate them but they will fetch on mount.
    // To avoid performance hit on normal load, we might want to NOT call this hook in the main component unless user interacts,
    // or accept the hit.
    // Alternative: The hook returns a function that triggers a separate fetch manually using supabase client directly.
    // That seems cleaner for "Export" actions.

    // Let's go with manual fetch integration to avoid auto-loading 2000 items.
    const { componentRef, handleDownloadPDF, isGenerating } = usePDFExport({
        filename: `lista-precios-servicios-acabados-${new Date().toISOString().split('T')[0]}.pdf`,
        pageOrientation: 'portrait',
    });

    const [data, setData] = useState<{ servicios: any[]; acabados: any[] }>({ servicios: [], acabados: [] });

    const handleExport = useCallback(async () => {
        try {
            setIsPreparing(true);

            // Dynamic import to avoid circular deps if any, or just use direct supabase call
            const { supabase } = await import('../lib/supabase');

            // 1. Fetch Servicios
            const { data: serviciosData } = await supabase
                .from('servicios')
                .select(`
                    *,
                    servicios_categorias(categoria_id, categoria:categorias(id, nombre, color)),
                    estacion:estaciones_trabajo(id, nombre),
                    niveles_precio:servicios_niveles_precio(*),
                    pasos:servicios_pasos(*)
                `)
                .eq('is_active', true)
                .order('nombre');

            // 2. Fetch Acabados
            const { data: acabadosData } = await supabase
                .from('acabados')
                .select(`
                    *,
                    acabados_categorias(categoria_id, categoria:categorias(id, nombre, color)),
                    estacion:estaciones_trabajo(id, nombre),
                    niveles_precio:acabados_niveles_precio(*),
                    pasos:acabados_pasos(*)
                `)
                .eq('is_active', true)
                .order('nombre');

            setData({
                servicios: serviciosData || [],
                acabados: acabadosData || []
            });

            // Give React time to render the template with new data
            setTimeout(async () => {
                await handleDownloadPDF();
                setIsPreparing(false);
            }, 500);

        } catch (error) {
            console.error('Export failed:', error);
            setIsPreparing(false);
        }
    }, [handleDownloadPDF]);

    return {
        handleExport,
        isExporting: isPreparing || isGenerating,
        exportData: data,
        componentRef,
    };
}
