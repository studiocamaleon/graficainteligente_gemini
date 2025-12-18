import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import dayjs from 'dayjs';

export type WorkloadType = 'orden_trabajo' | 'centro_copiado';

interface UseWorkloadProps {
    type: WorkloadType;
}

export function useWorkload({ type }: UseWorkloadProps) {
    const { profile } = useAuth();
    const [workloadData, setWorkloadData] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    const fetchWorkload = useCallback(async () => {
        if (!profile?.company_id) return;

        try {
            setLoading(true);

            const tableName = type === 'orden_trabajo' ? 'ordenes_trabajo' : 'centro_copiado_ordenes';
            const dateField = type === 'orden_trabajo' ? 'fecha_estimada_entrega' : 'fecha_entrega_estimada';

            // Consultamos órdenes que no estén canceladas ni sean presupuestos (si aplica borrador)
            let query = supabase
                .from(tableName)
                .select(`id, ${dateField}`)
                .eq('company_id', profile.company_id)
                .not(dateField, 'is', null)
                .neq('estado', 'cancelada');

            // Si es orden de trabajo, evitamos los presupuestos 'borrador' o 'enviado' (que no son órdenes aún)
            // Nota: En la tabla ordenes_trabajo, el estado 'presupuesto' se usa para identificar que no es OT
            if (type === 'orden_trabajo') {
                query = query.neq('estado', 'presupuesto');
            }

            const { data, error } = await query;

            if (error) throw error;

            const counts: Record<string, number> = {};

            data?.forEach((item: any) => {
                const dateKey = dayjs(item[dateField]).format('YYYY-MM-DD');
                counts[dateKey] = (counts[dateKey] || 0) + 1;
            });

            setWorkloadData(counts);
        } catch (err) {
            console.error('Error fetching workload:', err);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id, type]);

    useEffect(() => {
        fetchWorkload();
    }, [fetchWorkload]);

    return { workloadData, loading, refresh: fetchWorkload };
}
