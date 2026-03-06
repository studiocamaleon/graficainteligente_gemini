import { useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { StickerSheetPreview } from './StickerSheetPreview';
import { StickerSheetSummary } from './StickerSheetSummary';
import { calculateStickerSheet } from '../../utils/stickerSheetCalculator';

const SHEET_WIDTH_MM = 325;
const SHEET_HEIGHT_MM = 500;
const USABLE_WIDTH_MM = 272;
const USABLE_HEIGHT_MM = 428;

function parseMm(value: string) {
  if (!value.trim()) return NaN;
  return Number(value.replace(',', '.'));
}

export function StickerSheetCalculator() {
  const [widthMm, setWidthMm] = useState('50');
  const [heightMm, setHeightMm] = useState('50');
  const [gapMm, setGapMm] = useState('3');

  const parsedWidth = parseMm(widthMm);
  const parsedHeight = parseMm(heightMm);
  const parsedGap = parseMm(gapMm);

  const validationError = useMemo(() => {
    if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
      return 'El ancho del sticker debe ser mayor a 0 mm.';
    }
    if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      return 'El alto del sticker debe ser mayor a 0 mm.';
    }
    if (!Number.isFinite(parsedGap) || parsedGap < 0) {
      return 'El GAP debe ser mayor o igual a 0 mm.';
    }
    return null;
  }, [parsedGap, parsedHeight, parsedWidth]);

  const result = useMemo(
    () =>
      calculateStickerSheet({
        stickerWidthMm: parsedWidth,
        stickerHeightMm: parsedHeight,
        gapMm: parsedGap,
        sheetWidthMm: SHEET_WIDTH_MM,
        sheetHeightMm: SHEET_HEIGHT_MM,
        usableWidthMm: USABLE_WIDTH_MM,
        usableHeightMm: USABLE_HEIGHT_MM,
      }),
    [parsedGap, parsedHeight, parsedWidth]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Parámetros</p>
          <p className="mt-1 text-sm text-slate-600">
            Definí el tamaño del sticker y el espacio de corte (GAP).
          </p>

          <div className="mt-4 space-y-3">
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={widthMm}
              onChange={(event) => setWidthMm(event.target.value)}
              label="Ancho sticker (mm)"
            />
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={heightMm}
              onChange={(event) => setHeightMm(event.target.value)}
              label="Alto sticker (mm)"
            />
            <Input
              type="number"
              min="0"
              step="0.1"
              value={gapMm}
              onChange={(event) => setGapMm(event.target.value)}
              label="GAP entre stickers (mm)"
              helperText="Valor por defecto: 3 mm"
            />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>Pliego total: {SHEET_WIDTH_MM} x {SHEET_HEIGHT_MM} mm</p>
            <p className="mt-1">Área útil imprimible: {USABLE_WIDTH_MM} x {USABLE_HEIGHT_MM} mm</p>
          </div>
        </div>

        {validationError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {validationError}
          </div>
        ) : (
          <StickerSheetPreview
            result={result}
            sheetWidthMm={SHEET_WIDTH_MM}
            sheetHeightMm={SHEET_HEIGHT_MM}
            usableWidthMm={USABLE_WIDTH_MM}
            usableHeightMm={USABLE_HEIGHT_MM}
          />
        )}
      </div>

      {!validationError && (
        <StickerSheetSummary result={result} usableWidthMm={USABLE_WIDTH_MM} usableHeightMm={USABLE_HEIGHT_MM} />
      )}
    </div>
  );
}
