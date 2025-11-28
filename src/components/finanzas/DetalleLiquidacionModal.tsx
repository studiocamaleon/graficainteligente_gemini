import { useState, useEffect } from 'react';
import { X, FileText, Calendar, DollarSign, Package } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { EstadoLiquidacion } from '../../types/database';
import dayjs from 'dayjs';

interface DetalleLiquidacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacionId: string;
}

interface LiquidacionDetalle {
  id: string;
  numero_liquidacion: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  estado: EstadoLiquidacion;
  subtotal_ordenes: number;
  total_ajustes: number;
  total_general: number;
  total_pagado: number;
  saldo_pendiente: number;
  notas: string | null;
  cliente: {
    nombre_fantasia: string;
    razon_social: string;
    numero_documento: string;
  };
}

interface LiquidacionItem {
  id: string;
  numero_orden: string;
  descripcion: string;
  fecha_orden: string;
  monto: number;
}

export function DetalleLiquidacionModal({
  isOpen,
  onClose,
  liquidacionId,
}: DetalleLiquidacionModalProps) {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [liquidacion, setLiquidacion] = useState<LiquidacionDetalle | null>(null);
  const [items, setItems] = useState<LiquidacionItem[]>([]);

  useEffect(() => {
    if (isOpen && liquidacionId) {
      fetchDetalle();
    }
  }, [isOpen, liquidacionId]);

  const fetchDetalle = async () => {
    if (!company) return;

    setLoading(true);
    try {
      const { data: liqData, error: liqError } = await supabase
        .from('liquidaciones')
        .select(`
          *,
          cliente:clients(nombre_fantasia, razon_social, numero_documento)
        `)
        .eq('id', liquidacionId)
        .eq('company_id', company.id)
        .single();

      if (liqError) throw liqError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('liquidaciones_items')
        .select('*')
        .eq('liquidacion_id', liquidacionId)
        .order('fecha_orden', { ascending: false });

      if (itemsError) throw itemsError;

      setLiquidacion(liqData as any);
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching liquidacion detalle:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoBadge = (estado: EstadoLiquidacion) => {
    const badges: Record<EstadoLiquidacion, { color: string; text: string }> = {
      pendiente: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' },
      pagada_parcial: { color: 'bg-blue-100 text-blue-800', text: 'Pago Parcial' },
      pagada_total: { color: 'bg-green-100 text-green-800', text: 'Pagada' },
      vencida: { color: 'bg-red-100 text-red-800', text: 'Vencida' },
      cancelada: { color: 'bg-gray-100 text-gray-800', text: 'Cancelada' },
    };

    const badge = badges[estado];
    return <Badge className={badge.color}>{badge.text}</Badge>;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Detalle de Liquidación
            </h2>
            {liquidacion && (
              <p className="text-sm text-gray-500">
                {liquidacion.numero_liquidacion}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="animate-pulse bg-gray-200 h-20 rounded-lg"></div>
          <div className="animate-pulse bg-gray-200 h-40 rounded-lg"></div>
          <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
        </div>
      ) : liquidacion ? (
        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {liquidacion.cliente.nombre_fantasia}
              </h3>
              {getEstadoBadge(liquidacion.estado)}
            </div>
            <div className="text-sm text-gray-600">
              <p>{liquidacion.cliente.razon_social}</p>
              <p>CUIT/DNI: {liquidacion.cliente.numero_documento}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha de Emisión
              </p>
              <p className="text-sm font-medium text-gray-900">
                {dayjs(liquidacion.fecha_emision).format('DD/MM/YYYY')}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha de Vencimiento
              </p>
              <p className="text-sm font-medium text-gray-900">
                {liquidacion.fecha_vencimiento
                  ? dayjs(liquidacion.fecha_vencimiento).format('DD/MM/YYYY')
                  : '-'}
              </p>
            </div>

            {liquidacion.periodo_desde && liquidacion.periodo_hasta && (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Período Desde</p>
                  <p className="text-sm font-medium text-gray-900">
                    {dayjs(liquidacion.periodo_desde).format('DD/MM/YYYY')}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Período Hasta</p>
                  <p className="text-sm font-medium text-gray-900">
                    {dayjs(liquidacion.periodo_hasta).format('DD/MM/YYYY')}
                  </p>
                </div>
              </>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Órdenes Incluidas ({items.length})
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Orden
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Descripción
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {item.numero_orden}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {dayjs(item.fecha_orden).format('DD/MM/YYYY')}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {item.descripcion}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                          ${item.monto.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal Órdenes</span>
              <span className="font-medium text-gray-900">
                ${liquidacion.subtotal_ordenes.toFixed(2)}
              </span>
            </div>

            {liquidacion.total_ajustes !== 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Ajustes</span>
                <span
                  className={`font-medium ${
                    liquidacion.total_ajustes >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {liquidacion.total_ajustes >= 0 ? '+' : ''}$
                  {liquidacion.total_ajustes.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-base font-semibold pt-2 border-t">
              <span className="text-gray-900">Total General</span>
              <span className="text-gray-900">
                ${liquidacion.total_general.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Pagado</span>
              <span className="font-medium text-green-600">
                ${liquidacion.total_pagado.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between text-base font-bold pt-2 border-t">
              <span className="text-gray-900">Saldo Pendiente</span>
              <span
                className={
                  liquidacion.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'
                }
              >
                ${liquidacion.saldo_pendiente.toFixed(2)}
              </span>
            </div>
          </div>

          {liquidacion.notas && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Notas</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {liquidacion.notas}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No se pudo cargar el detalle de la liquidación
        </div>
      )}
    </Modal>
  );
}
