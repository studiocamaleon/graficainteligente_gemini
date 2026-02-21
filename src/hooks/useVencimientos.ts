
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface Vencimiento {
    origen: 'recurrente' | 'compra' | 'tarjeta' | 'cheque';
    id_origen: string;
    descripcion: string;
    proveedor: string;
    proveedor_id: string | null;
    tipo_egreso_id: string | null;
    monto_total: number;
    monto_pagado: number;
    monto_pendiente: number;
    fecha_vencimiento: string;
    estado: 'vencido' | 'hoy' | 'proximo';
    dias_atraso: number;
}

export function useVencimientos() {
    const { company } = useAuth();
    const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (company?.id) {
            fetchVencimientos();
        }
    }, [company?.id]);

    const fetchVencimientos = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!company?.id) return;

            const { data, error } = await supabase
                .rpc('fn_get_vencimientos_pendientes', {
                    p_company_id: company.id
                });

            if (error) throw error;

            setVencimientos(data || []);
        } catch (err: any) {
            console.error('Error fetching vencimientos:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        vencimientos,
        loading,
        error,
        refreshVencimientos: fetchVencimientos
    };
}
