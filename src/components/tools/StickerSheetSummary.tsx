import type { StickerSheetResult } from '../../utils/stickerSheetCalculator';

interface StickerSheetSummaryProps {
  result: StickerSheetResult;
  usableWidthMm: number;
  usableHeightMm: number;
}

function strategyLabel(strategy: StickerSheetResult['strategy']) {
  if (strategy === 'mixed') return 'mixta (combinada)';
  if (strategy === 'rotated') return 'rotada';
  return 'original';
}

export function StickerSheetSummary({ result, usableWidthMm, usableHeightMm }: StickerSheetSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultado</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        Entran <span className="text-emerald-600">{result.total}</span> stickers
      </p>
      <p className="mt-1 text-sm text-slate-600">
        En el área útil ({usableWidthMm} x {usableHeightMm} mm)
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Estrategia elegida</p>
          <p className="mt-1 font-semibold capitalize text-slate-900">{strategyLabel(result.strategy)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Desperdicio estimado</p>
          <p className="mt-1 font-semibold text-slate-900">{Math.round(result.wasteAreaMm2).toLocaleString('es-AR')} mm²</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Comparativa</p>
        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <p className="font-medium text-slate-700">Original: <span className="text-slate-900">{result.breakdown.originalOnly}</span></p>
          <p className="font-medium text-slate-700">Rotada: <span className="text-slate-900">{result.breakdown.rotatedOnly}</span></p>
          <p className="font-medium text-slate-700">Mixta: <span className="text-slate-900">{result.breakdown.mixed}</span></p>
        </div>
      </div>
    </div>
  );
}
