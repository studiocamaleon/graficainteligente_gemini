import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface CashflowPoint {
    fecha: string;
    // In breakdown
    ingreso_cheques: number;
    ingreso_liquidaciones: number;
    ingreso_wip: number;
    // Out breakdown
    egreso_cheques: number;
    egreso_tarjetas: number;
    egreso_recurrentes: number;
    egreso_compras: number;
    // Overdue
    total_ingreso_vencido: number;
    total_egreso_vencido: number;
    // Totals
    total_ingresos: number;
    total_egresos: number;
    saldo_diario: number;
    saldo_acumulado: number;
    // Legacy support for older graphs if needed (mapped to total)
    ingresos: number;
    egresos: number;
}

interface CashflowRpcRow {
    fecha: string;
    ingreso_cheques: number | null;
    ingreso_liquidaciones: number | null;
    ingreso_wip: number | null;
    egreso_cheques: number | null;
    egreso_tarjetas: number | null;
    egreso_recurrentes: number | null;
    egreso_compras: number | null;
    total_ingreso_vencido: number | null;
    total_egreso_vencido: number | null;
    total_ingresos: number | null;
    total_egresos: number | null;
    saldo_diario: number | null;
    saldo_acumulado: number | null;
}

export function useCashflow(daysToProject: number = 90) {
    const { company } = useAuth();
    const [data, setData] = useState<CashflowPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCashflow = useCallback(async () => {
        if (!company) return;

        setLoading(true);
        setError(null);
        try {
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('fn_get_cashflow_projection', {
                    p_company_id: company.id,
                    p_days_to_project: daysToProject
                });

            if (rpcError) {
                throw rpcError;
            }

            const rows = Array.isArray(rpcData) ? (rpcData as CashflowRpcRow[]) : [];
            const mappedData = rows.map((d) => ({
                fecha: d.fecha,
                ingreso_cheques: Number(d.ingreso_cheques || 0),
                ingreso_liquidaciones: Number(d.ingreso_liquidaciones || 0),
                ingreso_wip: Number(d.ingreso_wip || 0),
                egreso_cheques: Number(d.egreso_cheques || 0),
                egreso_tarjetas: Number(d.egreso_tarjetas || 0),
                egreso_recurrentes: Number(d.egreso_recurrentes || 0),
                egreso_compras: Number(d.egreso_compras || 0),
                total_ingreso_vencido: Number(d.total_ingreso_vencido || 0),
                total_egreso_vencido: Number(d.total_egreso_vencido || 0),
                total_ingresos: Number(d.total_ingresos || 0),
                total_egresos: Number(d.total_egresos || 0),
                saldo_diario: Number(d.saldo_diario || 0),
                saldo_acumulado: Number(d.saldo_acumulado || 0),
                ingresos: Number(d.total_ingresos || 0),
                egresos: Number(d.total_egresos || 0),
            })) as CashflowPoint[];

            setData(mappedData);

        } catch (err) {
            console.error('Error fetching cashflow:', err);
            setData([]);
            setError(err instanceof Error ? err.message : 'No se pudo cargar la proyección de cashflow');
        } finally {
            setLoading(false);
        }
    }, [company, daysToProject]);

    useEffect(() => {
        fetchCashflow();
    }, [fetchCashflow]);

    return { data, loading, error, refresh: fetchCashflow };
}
