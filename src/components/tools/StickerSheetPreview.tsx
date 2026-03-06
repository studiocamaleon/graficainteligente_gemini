import type { StickerSheetResult } from '../../utils/stickerSheetCalculator';

interface StickerSheetPreviewProps {
  result: StickerSheetResult;
  sheetWidthMm: number;
  sheetHeightMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
}

const MAX_RENDERED_PLACEMENTS = 3000;

export function StickerSheetPreview({
  result,
  sheetWidthMm,
  sheetHeightMm,
  usableWidthMm,
  usableHeightMm,
}: StickerSheetPreviewProps) {
  const usableOffsetX = (sheetWidthMm - usableWidthMm) / 2;
  const usableOffsetY = (sheetHeightMm - usableHeightMm) / 2;
  const shouldSimplify = result.placements.length > MAX_RENDERED_PLACEMENTS;
  const placements = shouldSimplify ? result.placements.slice(0, MAX_RENDERED_PLACEMENTS) : result.placements;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Previsualización del pliego</p>
        {shouldSimplify && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">
            Vista simplificada ({MAX_RENDERED_PLACEMENTS.toLocaleString('es-AR')} / {result.placements.length.toLocaleString('es-AR')})
          </span>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
        <svg
          viewBox={`0 0 ${sheetWidthMm} ${sheetHeightMm}`}
          className="mx-auto h-auto w-full max-w-[340px]"
          role="img"
          aria-label="Previsualización de stickers en pliego"
        >
          <rect x={0} y={0} width={sheetWidthMm} height={sheetHeightMm} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.2} />

          <rect
            x={usableOffsetX}
            y={usableOffsetY}
            width={usableWidthMm}
            height={usableHeightMm}
            fill="#f8fafc"
            stroke="#0f172a"
            strokeWidth={1}
          />

          {placements.map((placement, index) => (
            <rect
              key={`${placement.x}-${placement.y}-${index}`}
              x={usableOffsetX + placement.x}
              y={usableOffsetY + placement.y}
              width={placement.width}
              height={placement.height}
              fill={placement.rotated ? 'rgba(14, 165, 233, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
              stroke={placement.rotated ? '#0284c7' : '#059669'}
              strokeWidth={0.4}
            />
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Orientación original
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
          Orientación rotada
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          Área no utilizable
        </span>
      </div>
    </div>
  );
}
