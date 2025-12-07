import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TarjetaCredito, TarjetaResumen } from '../types/database';

export function useTarjetas() {
    const { profile } = useAuth();
    const [tarjetas, setTarjetas] = useState<TarjetaCredito[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTarjetas = useCallback(async () => {
        if (!profile?.company_id) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tarjetas_credito')
                .select('*')
                .eq('company_id', profile.company_id)
                .order('nombre');

            if (error) throw error;
            setTarjetas(data || []);
        } catch (err: any) {
            console.error('Error fetching tarjetas:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => {
        fetchTarjetas();
    }, [fetchTarjetas]);

    const crearTarjeta = async (data: Omit<TarjetaCredito, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'created_by'>) => {
        if (!profile?.company_id) throw new Error('No company ID');

        const { error } = await supabase
            .from('tarjetas_credito')
            .insert({ ...data, company_id: profile.company_id, created_by: profile.id });

        if (error) throw error;
        await fetchTarjetas();
    };

    const actualizarTarjeta = async (id: string, data: Partial<TarjetaCredito>) => {
        const { error } = await supabase
            .from('tarjetas_credito')
            .update(data)
            .eq('id', id);

        if (error) throw error;
        await fetchTarjetas();
    };

    const eliminarTarjeta = async (id: string) => {
        const { error } = await supabase
            .from('tarjetas_credito')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchTarjetas();
    };

    return {
        tarjetas,
        loading,
        error,
        crearTarjeta,
        actualizarTarjeta,
        eliminarTarjeta,
        refetch: fetchTarjetas
    };
}

export function useResumenes(tarjetaId?: string) {
    const { profile } = useAuth();
    const [resumenes, setResumenes] = useState<TarjetaResumen[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchResumenes = useCallback(async () => {
        if (!profile?.company_id) return;
        if (!tarjetaId) {
            setResumenes([]);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tarjetas_resumenes')
                .select('*')
                .eq('tarjeta_id', tarjetaId)
                .order('periodo', { ascending: false }); // "MM/YYYY" sorting might be tricky string-wise, better sort by fecha_cierre

            if (error) throw error;

            // Sort manually by date derived from period/dates to be safe
            const sorted = (data || []).sort((a, b) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime());

            setResumenes(sorted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id, tarjetaId]);

    useEffect(() => {
        fetchResumenes();
    }, [fetchResumenes]);

    return { resumenes, loading, refetch: fetchResumenes };
}

export function useRegistrarConsumo() {
    const { profile } = useAuth();

    const registrarConsumo = async (data: {
        tarjeta_id: string;
        fecha_compra: string;
        descripcion: string;
        monto_total: number;
        cuotas: number;
        categoria_id?: string;
        comprobante_url?: string;
    }) => {
        if (!profile?.company_id) throw new Error('No company ID');

        // 1. Obtener datos de la tarjeta para calcular fechas
        const { data: tarjeta, error: errTarjeta } = await supabase
            .from('tarjetas_credito')
            .select('*')
            .eq('id', data.tarjeta_id)
            .single();

        if (errTarjeta) throw errTarjeta;

        const montoCuota = data.monto_total / data.cuotas;
        const purchaseDate = new Date(data.fecha_compra);
        // Ajustamos la fecha para evitar problemas de zona horaria al obtener día
        // Asumimos que la fecha viene YYYY-MM-DD
        const dayOfPurchase = parseInt(data.fecha_compra.split('-')[2]);

        let startMonth = parseInt(data.fecha_compra.split('-')[1]) - 1; // 0-indexed
        let startYear = parseInt(data.fecha_compra.split('-')[0]);

        // Si la compra fue DESPUÉS del cierre, entra en el resumen del mes siguiente
        if (dayOfPurchase > tarjeta.dia_cierre) {
            startMonth++;
            if (startMonth > 11) {
                startMonth = 0;
                startYear++;
            }
        }

        // 2. Iterar por cuotas
        for (let i = 0; i < data.cuotas; i++) {
            let currentMonth = startMonth + i;
            let currentYear = startYear + Math.floor(currentMonth / 12);
            currentMonth = currentMonth % 12;

            // Formato Periodo "MM/YYYY"
            const periodo = `${(currentMonth + 1).toString().padStart(2, '0')}/${currentYear}`;

            // Calcular fecha cierre y vencimiento para este periodo
            // Fecha cierre: dia_cierre del mes actual
            // Fecha vencimiento: dia_vencimiento del mes SIGUIENTE (generalmente)
            // NOTA: Esto varía según el banco, asumimos modelo estándar: Cierra 25/Mes, Vence 5/Mes+1

            const fechaCierre = new Date(currentYear, currentMonth, tarjeta.dia_cierre);

            // Logica vencimiento: Si dia_vencimiento < dia_cierre, es al mes siguiente.
            // Si dia_vencimiento > dia_cierre, podría ser mismo mes (raro).
            // Asumimos vencimiento es al mes siguiente del cierre.
            let vtoMonth = currentMonth + 1;
            let vtoYear = currentYear;
            if (vtoMonth > 11) {
                vtoMonth = 0;
                vtoYear++;
            }
            const fechaVencimiento = new Date(vtoYear, vtoMonth, tarjeta.dia_vencimiento);

            // 3. Buscar o Crear Resumen
            const { data: resumenExistente } = await supabase
                .from('tarjetas_resumenes')
                .select('id')
                .eq('tarjeta_id', tarjeta.id)
                .eq('periodo', periodo)
                .single();

            let resumenId = resumenExistente?.id;

            if (!resumenId) {
                const { data: newResumen, error: errResumen } = await supabase
                    .from('tarjetas_resumenes')
                    .insert({
                        tarjeta_id: tarjeta.id,
                        company_id: profile.company_id,
                        periodo: periodo,
                        fecha_cierre: fechaCierre.toISOString().split('T')[0],
                        fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
                        estado: 'abierto'
                    })
                    .select()
                    .single();

                if (errResumen) throw errResumen;
                resumenId = newResumen.id;
            }

            // 4. Insertar Consumo
            const { error: errConsumo } = await supabase
                .from('tarjetas_consumos')
                .insert({
                    resumen_id: resumenId,
                    tarjeta_id: tarjeta.id,
                    company_id: profile.company_id,
                    fecha_compra: data.fecha_compra,
                    descripcion: `${data.descripcion} (Cuota ${i + 1}/${data.cuotas})`,
                    monto_original: data.monto_total,
                    monto_cuota: montoCuota,
                    cuotas_total: data.cuotas,
                    nro_cuota: i + 1,
                    categoria_id: data.categoria_id,
                    comprobante_url: data.comprobante_url,
                    created_by: profile.id
                });

            if (errConsumo) throw errConsumo;

            // 5. Actualizar total del resumen
            // Podríamos usar un trigger en DB, pero por simplicidad actualizamos aquí
            // RPC call sería ideal, pero lo hacemos manual
            // get current total
            const { data: resumenUpdated } = await supabase
                .from('tarjetas_resumenes')
                .select('total_consumos')
                .eq('id', resumenId)
                .single();

            const newTotal = (resumenUpdated?.total_consumos || 0) + montoCuota;

            await supabase
                .from('tarjetas_resumenes')
                .update({ total_consumos: newTotal })
                .eq('id', resumenId);
        }
    };

    return { registrarConsumo };
}
