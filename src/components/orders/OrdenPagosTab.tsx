import { Plus, DollarSign, AlertCircle, Edit2, Trash2, CheckCircle, CreditCard, FileText, ExternalLink, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Card } from '../ui/card';
import { useMediosCobro } from '../../hooks/useMediosCobro';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { formatDateDisplay, formatDateTimeDisplay } from '../../utils/dates';
import { PaymentMethodIcon } from './PaymentMethodIcon';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { CentroCopiadoOrdenResumida } from '../../types/database';
import { clampZeroMoney, roundMoney, toMoney } from '../../utils/money';

interface Totales {
  subtotal: number;
  descuentoAplicado: number;
  subtotalConDescuento: number;
  iva: number;
  total: number;
}

interface Pago {
  id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id?: string;
  metodo_pago?: string;
  referencia_pago?: string;
  notas?: string;
  comision_aplicada?: number;
  fecha_liberacion_estimada?: string;
  created_at?: string;
  created_by?: string | null;
  author_name?: string | null;
  author_email?: string | null;
}

interface OrdenPagosTabProps {
  totales: Totales;
  pagos: Pago[];
  onAgregarPago: () => void;
  onEditarPago?: (pago: Pago) => void;
  onEliminarPago?: (id: string) => void;
  readOnly?: boolean;
  ordenCopiado?: CentroCopiadoOrdenResumida | null;
}

export function OrdenPagosTab({
  totales,
  pagos,
  onAgregarPago,
  onEditarPago,
  onEliminarPago,
  readOnly = false,
  ordenCopiado,
}: OrdenPagosTabProps) {
  const { mediosCobro } = useMediosCobro();
  const { showConfirm, dialogState, closeDialog, handleConfirm, isLoading: isConfirmLoading } = useConfirmDialog();
  const { profile } = useAuth();
  const [recibosByPagoId, setRecibosByPagoId] = useState<Record<string, { token: string; ready: boolean }>>({});

  const totalPagado = roundMoney(pagos.reduce((sum, p) => sum + toMoney(p.monto), 0));
  const saldoPendiente = clampZeroMoney(roundMoney(totales.total) - roundMoney(totalPagado));

  const pagoIds = useMemo(() => pagos.map((p) => p.id).filter(Boolean), [pagos]);

  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId || readOnly || pagoIds.length === 0) return;

    let canceled = false;
    let interval: number | null = null;
    let attempts = 0;

    const run = async () => {
      // Buscar recibos vinculados a estos pagos (OT o Copiado).
      const idsList = pagoIds.join(',');
      const { data, error } = await supabase
        .from('recibos_pagos' as any)
        .select('token_corto,pdf_storage_path,pago_ot_id,pago_copiado_id')
        .eq('company_id', companyId)
        .or(`pago_ot_id.in.(${idsList}),pago_copiado_id.in.(${idsList})`);

      if (canceled) return;
      if (error) {
        // No bloquear UI si el feature aún no está deployado en el entorno.
        return;
      }

      const next: Record<string, { token: string; ready: boolean }> = {};
      (data || []).forEach((r: any) => {
        const pagoId = r.pago_ot_id || r.pago_copiado_id;
        if (!pagoId) return;
        next[pagoId] = { token: r.token_corto, ready: Boolean(r.pdf_storage_path) };
      });
      setRecibosByPagoId(next);

      // Si hay recibos sin PDF, reintentar un par de veces para que el UI pase de "Generando..." a "Ver recibo"
      // sin necesidad de refrescar la página.
      const hasPending = Object.values(next).some((r) => r && !r.ready);
      if (hasPending && interval == null) {
        interval = window.setInterval(async () => {
          if (canceled) return;
          attempts += 1;
          if (attempts > 12) {
            if (interval != null) window.clearInterval(interval);
            interval = null;
            return;
          }
          await run();
        }, 5000);
      }
    };

    run();
    return () => {
      canceled = true;
      if (interval != null) window.clearInterval(interval);
    };
  }, [profile?.company_id, readOnly, pagoIds]);

  const getMedioCobro = (medioId?: string) => {
    if (!medioId) return null;
    return mediosCobro.find(m => m.id === medioId);
  };

  const handleEliminar = async (id: string) => {
    if (!onEliminarPago) return;

    const confirmed = await showConfirm({
      title: 'Eliminar Pago',
      message: '¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      onEliminarPago(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner informativo cuando hay orden de copiado asociada */}
      {ordenCopiado && (
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">
                  Orden con Servicios de Copiado Incluidos
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  Esta orden incluye una <strong>Orden de Copiado asociada</strong>. Los pagos registrados aquí cubren el total consolidado de ambas órdenes.
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-900">
                      <strong>OC {ordenCopiado.numero_orden}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">
                      Total OC: <strong>${Number(ordenCopiado.total).toFixed(2)}</strong>
                    </span>
                  </div>
                  <Link to={`/app/centro-copiado/ordenes/${ordenCopiado.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4" />
                      Ver Detalle de OC
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-700 mb-1">
            Total de la Orden{ordenCopiado ? ' (Consolidado)' : ''}
          </div>
          <div className="text-2xl font-bold text-blue-900">
            ${totales.total.toFixed(2)}
          </div>
          {ordenCopiado && (
            <div className="text-xs text-blue-600 mt-1">
              Incluye OC de ${Number(ordenCopiado.total).toFixed(2)}
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700 mb-1">Total Pagado</div>
          <div className="text-2xl font-bold text-green-900">
            ${totalPagado.toFixed(2)}
          </div>
          {pagos.length > 0 && (
            <div className="text-xs text-green-600 mt-1">
              {pagos.length} pago{pagos.length > 1 ? 's' : ''} registrado{pagos.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className={`
          border rounded-lg p-4
          ${saldoPendiente > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}
        `}>
          <div className={`text-sm mb-1 ${saldoPendiente > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
            Saldo Pendiente
          </div>
          <div className={`text-2xl font-bold ${saldoPendiente > 0 ? 'text-amber-900' : 'text-gray-900'}`}>
            ${saldoPendiente.toFixed(2)}
          </div>
          {saldoPendiente <= 0 && pagos.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <CheckCircle className="w-3 h-3" />
              Orden pagada
            </div>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center space-x-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-sm text-amber-800">
            Los pagos se podrán registrar una vez que la orden esté creada.
          </p>
        </div>
      )}

      {!readOnly && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pagos Registrados</h3>
            <Button onClick={onAgregarPago} disabled={saldoPendiente <= 0.01}>
              <Plus className="w-4 h-4" />
              Registrar Pago
            </Button>
          </div>

          {pagos.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No hay pagos registrados"
              description="Registra los pagos recibidos para esta orden"
              action={
                <Button onClick={onAgregarPago}>
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Primer Pago
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {pagos.map(pago => {
                const medio = getMedioCobro(pago.medio_cobro_id);
                const recibo = recibosByPagoId[pago.id];
                const reciboUrl =
                  recibo?.token && profile?.company_id
                    ? `/${profile.company_id}/recibos/${recibo.token}`
                    : null;

                return (
                  <div
                    key={pago.id}
                    className="group relative flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                        {medio ? (
                          <PaymentMethodIcon metodo={medio.nombre} size="lg" />
                        ) : pago.metodo_pago ? (
                          <PaymentMethodIcon metodo={pago.metodo_pago} size="lg" />
                        ) : (
                          <CreditCard className="w-6 h-6 text-blue-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-base font-semibold text-gray-900">
                            {medio?.nombre || pago.metodo_pago || 'Sin especificar'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDateDisplay(pago.fecha_pago)}
                          </span>
                        </div>

                        {(pago.referencia_pago || pago.notas) && (
                          <div className="text-xs text-gray-500 truncate">
                            {pago.referencia_pago && (
                              <span className="mr-2">Ref: {pago.referencia_pago}</span>
                            )}
                            {pago.notas && (
                              <span>{pago.notas}</span>
                            )}
                          </div>
                        )}
                        {(pago.author_name || pago.author_email || pago.created_at) && (
                          <div className="mt-1 text-xs text-gray-500">
                            Registrado por {pago.author_name || pago.author_email || 'Usuario'}
                            {pago.created_at ? ` · ${formatDateTimeDisplay(pago.created_at)}` : ''}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          ${pago.monto.toFixed(2)}
                        </div>
                        {reciboUrl && (
                          <a
                            href={reciboUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1 mt-1 text-xs ${
                              recibo.ready ? 'text-blue-700 hover:text-blue-800' : 'text-gray-400'
                            }`}
                            title={recibo.ready ? 'Ver recibo' : 'Recibo en proceso'}
                          >
                            <FileText className="w-3 h-3" />
                            <span>{recibo.ready ? 'Ver recibo' : 'Generando recibo...'}</span>
                            {recibo.ready && <ExternalLink className="w-3 h-3" />}
                          </a>
                        )}
                        {(pago.comision_aplicada || 0) > 0 && (
                          <div className="text-xs text-orange-600 mt-0.5">
                            -${(pago.comision_aplicada || 0).toFixed(2)} comisión
                          </div>
                        )}
                      </div>
                    </div>

                    {onEditarPago && onEliminarPago && (
                      <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditarPago(pago)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar pago"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(pago.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar pago"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pagos.length > 0 && pagos.some(p => p.comision_aplicada && p.comision_aplicada > 0) && (
            <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <span className="text-sm font-medium text-orange-900">Total de Comisiones</span>
              <span className="text-lg font-bold text-orange-900">
                ${pagos.reduce((sum, p) => sum + (p.comision_aplicada || 0), 0).toFixed(2)}
              </span>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
