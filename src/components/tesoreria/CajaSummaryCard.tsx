import { Wallet, TrendingUp, TrendingDown, ClipboardCheck, ArrowRightLeft, Banknote, Landmark, History, MinusCircle } from 'lucide-react';
import type { CajaConMediosCobro } from '../../types/medios-cobro';

interface CajaSummaryCardProps {
  caja: CajaConMediosCobro;
  onClick?: () => void;
  onClickArqueo?: (caja: CajaConMediosCobro) => void;
  onTransferir?: (caja: CajaConMediosCobro) => void;
  onHistory?: (caja: CajaConMediosCobro) => void;
  onRetiro?: (caja: CajaConMediosCobro) => void;
}

const TIPO_ICONS = { efectivo: Banknote, banco: Landmark, pasarela: Wallet };
const TIPO_LABELS = { efectivo: 'Efectivo', banco: 'Banco', pasarela: 'Pasarela' };

export function CajaSummaryCard({ caja, onClickArqueo, onTransferir, onHistory, onRetiro }: CajaSummaryCardProps) {
  const Icon = TIPO_ICONS[caja.tipo] || Wallet;
  const saldo = Number(caja.saldo_actual);
  const ingresosHoy = caja.ingresos_hoy || 0;
  const egresosHoy = caja.egresos_hoy || 0;
  const movimientosHoy = caja.movimientos_hoy || 0;

  return (
    <article className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl border p-2.5 ${caja.es_principal ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {caja.es_principal ? <Wallet className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{caja.nombre}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                {TIPO_LABELS[caja.tipo]}
              </span>
              {caja.es_principal && (
                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  Principal
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onTransferir && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                onTransferir(caja);
              }}
              title="Transferir Fondos"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
          )}

          {onClickArqueo && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                onClickArqueo(caja);
              }}
              title="Arqueo"
            >
              <ClipboardCheck className="h-4 w-4" />
            </button>
          )}

          {onHistory && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
              onClick={(e) => {
                e.stopPropagation();
                onHistory(caja);
              }}
              title="Ver Historial"
            >
              <History className="h-4 w-4" />
            </button>
          )}

          {onRetiro && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              onClick={(e) => {
                e.stopPropagation();
                onRetiro(caja);
              }}
              title="Registrar Retiro / Gasto"
            >
              <MinusCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Saldo actual</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          ${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{caja.moneda}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-emerald-700">Ingresos</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-800">
            <TrendingUp className="h-3.5 w-3.5" />${ingresosHoy.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-rose-700">Egresos</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-rose-800">
            <TrendingDown className="h-3.5 w-3.5" />${egresosHoy.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-600">Mov. hoy</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-800">{movimientosHoy}</p>
        </div>
      </div>
    </article>
  );
}
