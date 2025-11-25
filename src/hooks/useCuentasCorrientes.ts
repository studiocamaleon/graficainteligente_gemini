import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ClienteConSaldo,
  EstadoCuentaMovimiento,
  CuentaCorrienteMovimiento
} from '../types/database';
import dayjs from 'dayjs';

interface UseCuentasCorrientesParams {
  searchTerm?: string;
  estadoCC?: 'al_dia' | 'proximo_vencer' | 'vencido' | null;
}

export function useCuentasCorrientes(params: UseCuentasCorrientesParams = {}) {
  const { company } = useAuth();
  const { searchTerm = '', estadoCC = null } = params;

  const [clientes, setClientes] = useState<ClienteConSaldo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientesConCC = async () => {
    if (!company) return;

    setLoading(true);
    try {
      const { data: clientesData, error: clientesError } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', company.id)
        .eq('tiene_cuenta_corriente', true)
        .eq('is_active', true);

      if (clientesError) throw clientesError;

      const clientesConSaldo: ClienteConSaldo[] = await Promise.all(
        (clientesData || []).map(async (cliente) => {
          const { data: saldoData } = await supabase
            .rpc('fn_calcular_saldo_cuenta_corriente', {
              p_cliente_id: cliente.id,
              p_fecha_hasta: dayjs().format('YYYY-MM-DD')
            });

          const saldo = saldoData || 0;

          const diasVencimiento = cliente.acuerdo_pago
            ? calcularDiasVencimiento(cliente.id, cliente.acuerdo_pago)
            : null;

          const estadoCC = determinarEstadoCC(saldo, diasVencimiento);

          return {
            id: cliente.id,
            nombre_fantasia: cliente.nombre_fantasia,
            razon_social: cliente.razon_social,
            numero_documento: cliente.numero_documento,
            acuerdo_pago: cliente.acuerdo_pago,
            saldo_actual: saldo,
            dias_vencimiento: diasVencimiento,
            estado_cc: estadoCC,
          };
        })
      );

      let filtrados = clientesConSaldo;

      if (searchTerm) {
        filtrados = filtrados.filter(
          (c) =>
            c.nombre_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.numero_documento.includes(searchTerm)
        );
      }

      if (estadoCC) {
        filtrados = filtrados.filter((c) => c.estado_cc === estadoCC);
      }

      setClientes(filtrados);
    } catch (error) {
      console.error('Error fetching clientes con CC:', error);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientesConCC();
  }, [company, searchTerm, estadoCC]);

  return {
    clientes,
    loading,
    refetch: fetchClientesConCC,
  };
}

function calcularDiasVencimiento(clienteId: string, acuerdoPago: string): number {
  const diasAcuerdo = acuerdoPago === 'Semanal' ? 7 : acuerdoPago === 'Quincenal' ? 15 : 30;
  return diasAcuerdo;
}

function determinarEstadoCC(
  saldo: number,
  diasVencimiento: number | null
): 'al_dia' | 'proximo_vencer' | 'vencido' {
  if (saldo === 0) return 'al_dia';
  if (!diasVencimiento) return 'vencido';
  if (diasVencimiento <= 3) return 'proximo_vencer';
  return 'vencido';
}

export function useEstadoCuenta(clienteId: string) {
  const { company } = useAuth();
  const [movimientos, setMovimientos] = useState<EstadoCuentaMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [saldoFinal, setSaldoFinal] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchEstadoCuenta = useCallback(async (fechaDesde?: string, fechaHasta?: string) => {
    if (!company || !clienteId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fn_obtener_estado_cuenta', {
        p_company_id: company.id,
        p_cliente_id: clienteId,
        p_fecha_desde: fechaDesde || null,
        p_fecha_hasta: fechaHasta || dayjs().format('YYYY-MM-DD'),
      });

      if (error) throw error;

      const movs = (data || []) as EstadoCuentaMovimiento[];
      setMovimientos(movs);

      if (movs.length > 0) {
        const primerMov = movs[0];
        const saldoIni = primerMov.saldo_acumulado - primerMov.monto_debe + primerMov.monto_haber;
        setSaldoInicial(saldoIni);
        setSaldoFinal(movs[movs.length - 1].saldo_acumulado);
      } else {
        setSaldoInicial(0);
        setSaldoFinal(0);
      }
    } catch (error) {
      console.error('Error fetching estado cuenta:', error);
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [company, clienteId]);

  useEffect(() => {
    if (company && clienteId && !isInitialized) {
      const fechaDesde = dayjs().subtract(30, 'days').format('YYYY-MM-DD');
      const fechaHasta = dayjs().format('YYYY-MM-DD');
      fetchEstadoCuenta(fechaDesde, fechaHasta);
      setIsInitialized(true);
    }
  }, [company, clienteId, isInitialized, fetchEstadoCuenta]);

  useEffect(() => {
    setIsInitialized(false);
  }, [clienteId]);

  return {
    movimientos,
    loading,
    saldoInicial,
    saldoFinal,
    fetchEstadoCuenta,
  };
}

export function useMovimientosCC() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(false);

  const crearAjuste = async (data: {
    cliente_id: string;
    monto: number;
    tipo: 'debe' | 'haber';
    descripcion: string;
  }) => {
    if (!company) return null;

    setLoading(true);
    try {
      const { data: ultimoMov } = await supabase
        .from('cuentas_corrientes_movimientos')
        .select('saldo_acumulado')
        .eq('cliente_id', data.cliente_id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const saldoAnterior = ultimoMov?.saldo_acumulado || 0;
      const montoDebe = data.tipo === 'debe' ? data.monto : 0;
      const montoHaber = data.tipo === 'haber' ? data.monto : 0;
      const nuevoSaldo = saldoAnterior + montoDebe - montoHaber;

      const { data: newMovimiento, error } = await supabase
        .from('cuentas_corrientes_movimientos')
        .insert({
          company_id: company.id,
          cliente_id: data.cliente_id,
          tipo_movimiento: 'ajuste',
          fecha: dayjs().format('YYYY-MM-DD'),
          descripcion: data.descripcion,
          monto_debe: montoDebe,
          monto_haber: montoHaber,
          saldo_acumulado: nuevoSaldo,
        })
        .select()
        .single();

      if (error) throw error;

      return newMovimiento as CuentaCorrienteMovimiento;
    } catch (error) {
      console.error('Error creating ajuste:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    crearAjuste,
    loading,
  };
}
