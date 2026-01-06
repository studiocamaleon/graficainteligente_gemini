import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import dayjs from 'dayjs';

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

export function useCashflow(daysToProject: number = 90) {
    const { company } = useAuth();
    const [data, setData] = useState<CashflowPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCashflow = useCallback(async () => {
        if (!company) return;

        setLoading(true);
        try {
            // 1. Try RPC (Optimized)
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('fn_get_cashflow_projection', {
                    p_company_id: company.id,
                    p_days_to_project: daysToProject
                } as any);

            if (!rpcError && rpcData) {
                // Map RPC data to interface (ensure all fields exist)
                const mappedData = (rpcData as any[]).map(d => ({
                    ...d,
                    total_ingreso_vencido: d.total_ingreso_vencido || 0,
                    total_egreso_vencido: d.total_egreso_vencido || 0,
                    ingresos: d.total_ingresos, // Map for compatibility
                    egresos: d.total_egresos   // Map for compatibility
                }));
                setData(mappedData);
                return;
            }

            console.warn('RPC failed, using fallback calculation:', rpcError);

            // 2. Fallback: Frontend Calculation
            // Fetch Cajas Balance
            const { data: cajas } = await supabase
                .from('cajas')
                .select('saldo_actual')
                .eq('company_id', company.id) as { data: { saldo_actual: number }[] | null, error: any };

            const saldoInicial = cajas?.reduce((sum, c) => sum + (c.saldo_actual || 0), 0) || 0;

            const today = dayjs();
            const todayStr = today.format('YYYY-MM-DD');

            // Fetch Cheques (Include Overdue)
            const { data: cheques } = await supabase
                .from('cheques_cartera')
                .select('fecha_pago, monto, direction, estado')
                .eq('company_id', company.id)
                .in('estado', ['pendiente']) as {
                    data: { fecha_pago: string; monto: number; direction: 'emitido' | 'recibido'; }[] | null,
                    error: any
                };

            // Fetch Tarjetas (Include Overdue)
            const { data: tarjetas } = await supabase
                .from('tarjetas_resumenes')
                .select('fecha_vencimiento, total_consumos, total_pagado, estado')
                .eq('company_id', company.id)
                .neq('estado', 'pagado') as {
                    data: { fecha_vencimiento: string; total_consumos: number; total_pagado: number; }[] | null,
                    error: any
                };

            // Fetch Compras (Pending Bills - Include Overdue)
            const { data: compras } = await supabase
                .from('compras_proveedores')
                .select('fecha_vencimiento, monto_total, id')
                .eq('company_id', company.id)
                .neq('estado', 'pagado') as {
                    data: { fecha_vencimiento: string; monto_total: number; id: string; }[] | null,
                    error: any
                };
            // Note: Fallback calculation for compras might be inaccurate if partial payments exist, 
            // as we are not fetching 'egresos' for each compra here to subtract. 
            // Ideally rely on RPC. This fallback is a simplified approximation.

            // Build Timeline
            const timeline: Record<string, {
                ing_cheques: number, ing_liqui: number, ing_wip: number,
                egr_cheques: number, egr_tarjetas: number, egr_recurrentes: number, egr_compras: number,
                vencido_ing: number, vencido_egr: number
            }> = {};

            const startDate = dayjs();

            for (let i = 0; i <= daysToProject; i++) {
                const dateStr = startDate.add(i, 'day').format('YYYY-MM-DD');
                timeline[dateStr] = {
                    ing_cheques: 0, ing_liqui: 0, ing_wip: 0,
                    egr_cheques: 0, egr_tarjetas: 0, egr_recurrentes: 0, egr_compras: 0,
                    vencido_ing: 0, vencido_egr: 0
                };
            }

            // Helper to get safe date key (Map overdue to today)
            const getSafeDate = (dateStr: string) => {
                const d = dayjs(dateStr);
                if (d.isBefore(today, 'day')) return { date: todayStr, isOverdue: true };
                return { date: d.format('YYYY-MM-DD'), isOverdue: false };
            };

            // Add Cheques
            cheques?.forEach(c => {
                const { date, isOverdue } = getSafeDate(c.fecha_pago);
                if (timeline[date]) {
                    if (c.direction === 'recibido') {
                        timeline[date].ing_cheques += c.monto;
                        if (isOverdue) timeline[date].vencido_ing += c.monto;
                    } else {
                        timeline[date].egr_cheques += c.monto;
                        if (isOverdue) timeline[date].vencido_egr += c.monto;
                    }
                }
            });

            // Add Tarjetas
            tarjetas?.forEach(t => {
                const { date, isOverdue } = getSafeDate(t.fecha_vencimiento);
                if (timeline[date]) {
                    const deuda = (t.total_consumos || 0) - (t.total_pagado || 0);
                    timeline[date].egr_tarjetas += deuda;
                    if (isOverdue) timeline[date].vencido_egr += deuda;
                }
            });

            // Add Compras
            compras?.forEach(c => {
                const { date, isOverdue } = getSafeDate(c.fecha_vencimiento);
                if (timeline[date]) {
                    timeline[date].egr_compras += c.monto_total; // Assuming full amount for fallback simplicity
                    if (isOverdue) timeline[date].vencido_egr += c.monto_total;
                }
            });

            // Convert to Array with Accumulator
            const result: CashflowPoint[] = [];
            let currentBalance = saldoInicial;

            Object.entries(timeline).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, values]) => {
                const total_ingresos = values.ing_cheques + values.ing_liqui + values.ing_wip;
                const total_egresos = values.egr_cheques + values.egr_tarjetas + values.egr_recurrentes + values.egr_compras;
                const netChange = total_ingresos - total_egresos;
                currentBalance += netChange;

                result.push({
                    fecha: date,
                    ingreso_cheques: values.ing_cheques,
                    ingreso_liquidaciones: values.ing_liqui,
                    ingreso_wip: values.ing_wip,
                    egreso_cheques: values.egr_cheques,
                    egreso_tarjetas: values.egr_tarjetas,
                    egreso_recurrentes: values.egr_recurrentes,
                    egreso_compras: values.egr_compras,
                    total_ingreso_vencido: values.vencido_ing,
                    total_egreso_vencido: values.vencido_egr,
                    total_ingresos,
                    total_egresos,
                    ingresos: total_ingresos, // Compat
                    egresos: total_egresos,   // Compat
                    saldo_diario: netChange,
                    saldo_acumulado: currentBalance
                });
            });

            setData(result);

        } catch (err) {
            console.error('Error fetching cashflow:', err);
        } finally {
            setLoading(false);
        }
    }, [company, daysToProject]);

    useEffect(() => {
        fetchCashflow();
    }, [fetchCashflow]);

    return { data, loading, refresh: fetchCashflow };
}
