import { Receipt, Save, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { clampZeroMoney, roundMoney, toMoney } from '../../utils/money';

interface OrdenFooterTotalesProps {
  subtotal: number;
  descuentoAplicado: number;
  iva: number;
  total: number;
  requiereFactura: boolean;
  totalPagado?: number;
  mostrarSaldo?: boolean;
  actionLabel?: string;
  onActionClick?: () => void;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryActionClick?: () => void;
  secondaryActionDisabled?: boolean;
  secondaryActionLoading?: boolean;
}

export function OrdenFooterTotales({
  subtotal,
  descuentoAplicado,
  iva,
  total,
  requiereFactura,
  totalPagado = 0,
  mostrarSaldo = false,
  actionLabel,
  onActionClick,
  actionDisabled = false,
  actionLoading = false,
  secondaryActionLabel,
  onSecondaryActionClick,
  secondaryActionDisabled = false,
  secondaryActionLoading = false,
}: OrdenFooterTotalesProps) {
  const totalPagadoNorm = roundMoney(toMoney(totalPagado));
  const saldoPendiente = clampZeroMoney(roundMoney(total) - totalPagadoNorm);
  const tienePagos = totalPagadoNorm > 0.01;
  const formatMoney = (value: number) => {
    return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm lg:left-[var(--main-layout-offset)]">
      <div className="px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-gray-600">
            <Receipt className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Resumen de Totales</span>
          </div>

          <div className="flex flex-wrap items-stretch gap-2">
            <div className="min-w-[132px] rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Subtotal</div>
              <div className="text-sm font-semibold text-gray-900">{formatMoney(subtotal)}</div>
            </div>

            {descuentoAplicado > 0 && (
              <div className="min-w-[132px] rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Descuento</div>
                <div className="text-sm font-semibold text-gray-700">- {formatMoney(descuentoAplicado)}</div>
              </div>
            )}

            {requiereFactura && (
              <div className="min-w-[132px] rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">IVA (21%)</div>
                <div className="text-sm font-semibold text-gray-900">{formatMoney(iva)}</div>
              </div>
            )}

            <div className="min-w-[164px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-600">Total Orden</div>
              <div className="text-lg font-bold text-slate-900">{formatMoney(total)}</div>
            </div>

            {mostrarSaldo && tienePagos && (
              <>
                <div className="min-w-[146px] rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Pagado</div>
                  <div className="text-sm font-semibold text-gray-900">{formatMoney(totalPagadoNorm)}</div>
                </div>
                <div className={`min-w-[164px] rounded-lg border px-3 py-2 ${
                  saldoPendiente > 0.01 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`text-[11px] uppercase tracking-wide ${
                    saldoPendiente > 0.01 ? 'text-amber-700' : 'text-gray-500'
                  }`}>Saldo Pendiente</div>
                  <div className={`text-base font-bold ${
                    saldoPendiente > 0.01 ? 'text-amber-700' : 'text-gray-900'
                  }`}>{formatMoney(saldoPendiente)}</div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {secondaryActionLabel && onSecondaryActionClick && (
              <Button
                variant="secondary"
                onClick={onSecondaryActionClick}
                disabled={secondaryActionDisabled}
                className="h-10 min-w-[170px]"
              >
                {secondaryActionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {secondaryActionLabel}
                  </>
                )}
              </Button>
            )}

            {actionLabel && onActionClick && (
              <Button
                onClick={onActionClick}
                disabled={actionDisabled}
                className="h-10 min-w-[190px] bg-slate-900 text-white hover:bg-slate-800"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {actionLabel}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
