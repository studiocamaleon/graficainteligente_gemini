import { useState, useEffect } from 'react';
import { Calendar, Info, FileText, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { DatePicker } from '../ui/DatePicker';
import { supabase } from '../../lib/supabase';
import type { Client, PeriodoLiquidacion, OrdenParaLiquidar } from '../../types/database';
import dayjs from 'dayjs';

interface NuevaLiquidacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Client | null;
  onSuccess: () => void;
}

type ModoSelector = 'sugerido' | 'personalizado';

export function NuevaLiquidacionModal({
  isOpen,
  onClose,
  cliente,
  onSuccess,
}: NuevaLiquidacionModalProps) {
  const [modo, setModo] = useState<ModoSelector>('sugerido');
  const [periodoSugerido, setPeriodoSugerido] = useState<PeriodoLiquidacion | null>(null);
  const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
  const [fechaHasta, setFechaHasta] = useState<Date | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | null>(null);
  const [notas, setNotas] = useState('');
  const [ordenes, setOrdenes] = useState<OrdenParaLiquidar[]>([]);
  const [loadingPeriodo, setLoadingPeriodo] = useState(false);
  const [loadingOrdenes, setLoadingOrdenes] = useState(false);
  const [creatingLiquidacion, setCreatingLiquidacion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && cliente) {
      cargarPeriodoSugerido();
    } else {
      resetForm();
    }
  }, [isOpen, cliente]);

  useEffect(() => {
    if (fechaDesde && fechaHasta && cliente) {
      cargarOrdenesDisponibles();
    }
  }, [fechaDesde, fechaHasta, cliente]);

  const resetForm = () => {
    setModo('sugerido');
    setPeriodoSugerido(null);
    setFechaDesde(null);
    setFechaHasta(null);
    setFechaVencimiento(null);
    setNotas('');
    setOrdenes([]);
    setError(null);
  };

  const cargarPeriodoSugerido = async () => {
    if (!cliente) return;

    setLoadingPeriodo(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('fn_calcular_periodo_liquidacion', {
        p_cliente_id: cliente.id,
        p_fecha_referencia: dayjs().format('YYYY-MM-DD'),
      });

      if (rpcError) throw rpcError;

      const periodo = data as PeriodoLiquidacion;
      setPeriodoSugerido(periodo);
      setFechaDesde(dayjs(periodo.periodo_desde).toDate());
      setFechaHasta(dayjs(periodo.periodo_hasta).toDate());
      setFechaVencimiento(dayjs(periodo.fecha_vencimiento).toDate());
    } catch (err) {
      console.error('Error al cargar período sugerido:', err);
      setError('Error al calcular el período sugerido');
    } finally {
      setLoadingPeriodo(false);
    }
  };

  const cargarOrdenesDisponibles = async () => {
    if (!cliente || !fechaDesde || !fechaHasta) return;

    setLoadingOrdenes(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('fn_sugerir_ordenes_para_liquidacion', {
        p_cliente_id: cliente.id,
        p_fecha_desde: dayjs(fechaDesde).format('YYYY-MM-DD'),
        p_fecha_hasta: dayjs(fechaHasta).format('YYYY-MM-DD'),
      });

      if (rpcError) throw rpcError;

      setOrdenes(data || []);
    } catch (err) {
      console.error('Error al cargar órdenes:', err);
      setError('Error al cargar las órdenes disponibles');
    } finally {
      setLoadingOrdenes(false);
    }
  };

  const handleChangeModo = (nuevoModo: ModoSelector) => {
    setModo(nuevoModo);
    if (nuevoModo === 'sugerido' && periodoSugerido) {
      setFechaDesde(dayjs(periodoSugerido.periodo_desde).toDate());
      setFechaHasta(dayjs(periodoSugerido.periodo_hasta).toDate());
      setFechaVencimiento(dayjs(periodoSugerido.fecha_vencimiento).toDate());
    }
  };

  const handleGenerarLiquidacion = async () => {
    if (!cliente || !fechaDesde || !fechaHasta || !fechaVencimiento) {
      setError('Debe completar todas las fechas');
      return;
    }

    if (ordenes.length === 0) {
      setError('No hay órdenes para liquidar en el período seleccionado');
      return;
    }

    setCreatingLiquidacion(true);
    setError(null);

    try {
      const subtotalOrdenes = ordenes.reduce((sum, orden) => sum + orden.total, 0);
      const totalGeneral = subtotalOrdenes;

      // Los campos company_id, numero_liquidacion y created_by se auto-completan
      // mediante el trigger trigger_auto_complete_liquidacion en la base de datos
      const { data: liquidacionData, error: liquidacionError } = await supabase
        .from('liquidaciones')
        .insert({
          cliente_id: cliente.id,
          fecha_emision: dayjs().format('YYYY-MM-DD'),
          fecha_vencimiento: dayjs(fechaVencimiento).format('YYYY-MM-DD'),
          periodo_desde: dayjs(fechaDesde).format('YYYY-MM-DD'),
          periodo_hasta: dayjs(fechaHasta).format('YYYY-MM-DD'),
          estado: 'pendiente',
          subtotal_ordenes: subtotalOrdenes,
          total_ajustes: 0,
          total_general: totalGeneral,
          total_pagado: 0,
          saldo_pendiente: totalGeneral,
          notas: notas.trim() || null,
          metadata: {
            tipo_acuerdo: cliente.acuerdo_pago,
            modo_creacion: modo,
          },
        })
        .select()
        .single();

      if (liquidacionError) {
        console.error('Error al generar liquidacion:', {
          url: liquidacionError.message,
          status: liquidacionError.code,
          body: liquidacionError,
        });
        throw liquidacionError;
      }

      const itemsData = ordenes.map((orden) => ({
        liquidacion_id: liquidacionData.id,
        orden_id: orden.orden_id,
        descripcion: orden.descripcion,
        fecha_orden: orden.fecha_completado,
        numero_orden: orden.numero_orden,
        monto: orden.total,
      }));

      const { error: itemsError } = await supabase
        .from('liquidaciones_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al crear liquidación:', err);
      const errorMessage = err?.message || 'Error desconocido';
      setError(`Error al crear la liquidación: ${errorMessage}`);
    } finally {
      setCreatingLiquidacion(false);
    }
  };

  if (!cliente) return null;

  const totalLiquidar = ordenes.reduce((sum, orden) => sum + orden.total, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Liquidación" size="xl">
      <div className="space-y-6">
        {/* Info del cliente */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">{cliente.nombre_fantasia}</h3>
              <p className="text-sm text-blue-700">{cliente.razon_social}</p>
              <p className="text-sm text-blue-700">
                {cliente.tipo_documento}: {cliente.numero_documento}
              </p>
            </div>
            {cliente.acuerdo_pago && (
              <Badge className="bg-blue-100 text-blue-800">
                Acuerdo: {cliente.acuerdo_pago}
              </Badge>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Selector de modo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período de Liquidación
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleChangeModo('sugerido')}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                modo === 'sugerido'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              disabled={loadingPeriodo}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Período Sugerido</span>
                <Badge className="bg-green-100 text-green-800 text-xs">Recomendado</Badge>
              </div>
              {periodoSugerido && (
                <p className="text-sm text-gray-600">{periodoSugerido.descripcion_periodo}</p>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleChangeModo('personalizado')}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                modo === 'personalizado'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4" />
                <span className="font-medium">Período Personalizado</span>
              </div>
              <p className="text-sm text-gray-600">Seleccione fechas manualmente</p>
            </button>
          </div>
        </div>

        {/* Fechas */}
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Desde
              </label>
              <DatePicker
                selected={fechaDesde}
                onChange={(date) => {
                  setFechaDesde(date);
                  if (modo === 'personalizado') {
                    setModo('personalizado');
                  }
                }}
                placeholder="Fecha desde"
                disabled={loadingPeriodo}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Hasta
              </label>
              <DatePicker
                selected={fechaHasta}
                onChange={(date) => {
                  setFechaHasta(date);
                  if (modo === 'personalizado') {
                    setModo('personalizado');
                  }
                }}
                placeholder="Fecha hasta"
                disabled={loadingPeriodo}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Vencimiento
            </label>
            <DatePicker
              selected={fechaVencimiento}
              onChange={setFechaVencimiento}
              placeholder="Fecha de vencimiento"
              minDate={fechaHasta || undefined}
            />
          </div>
        </div>

        {/* Preview de órdenes */}
        {loadingOrdenes ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Cargando órdenes...</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">
                Órdenes a Liquidar ({ordenes.length})
              </h4>
              {ordenes.length > 0 && (
                <Badge className="bg-green-100 text-green-800">
                  Total: ${totalLiquidar.toFixed(2)}
                </Badge>
              )}
            </div>

            {ordenes.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-2">
                <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    No hay órdenes para liquidar
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    No se encontraron órdenes completadas sin liquidar en el período seleccionado.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          N° Orden
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Fecha
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {ordenes.map((orden) => (
                        <tr key={orden.orden_id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {orden.numero_orden}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {dayjs(orden.fecha_completado).format('DD/MM/YYYY')}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            ${orden.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas (opcional)
          </label>
          <Input
            as="textarea"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Agregue notas adicionales sobre esta liquidación..."
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={creatingLiquidacion}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerarLiquidacion}
            isLoading={creatingLiquidacion}
            disabled={!fechaDesde || !fechaHasta || !fechaVencimiento || ordenes.length === 0}
          >
            Generar Liquidación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
