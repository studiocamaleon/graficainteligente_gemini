export type StickerSheetStrategy = 'original' | 'rotated' | 'mixed';

export type StickerSheetInput = {
  stickerWidthMm: number;
  stickerHeightMm: number;
  gapMm: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  usableWidthMm?: number;
  usableHeightMm?: number;
};

export type StickerPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
};

export type StickerSheetResult = {
  total: number;
  strategy: StickerSheetStrategy;
  cols: number;
  rows: number;
  placements: StickerPlacement[];
  wasteAreaMm2: number;
  breakdown: {
    originalOnly: number;
    rotatedOnly: number;
    mixed: number;
  };
};

const DEFAULT_SHEET_WIDTH_MM = 325;
const DEFAULT_SHEET_HEIGHT_MM = 500;
const DEFAULT_USABLE_WIDTH_MM = 272;
const DEFAULT_USABLE_HEIGHT_MM = 428;

type StrategyCandidate = {
  strategy: StickerSheetStrategy;
  total: number;
  cols: number;
  rows: number;
  placements: StickerPlacement[];
  wasteAreaMm2: number;
};

type GridPlacement = {
  count: number;
  cols: number;
  rows: number;
  usedWidth: number;
  usedHeight: number;
  placements: StickerPlacement[];
};

function isValidPositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isValidNonNegativeNumber(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function getWasteArea(usableWidth: number, usableHeight: number, stickerWidth: number, stickerHeight: number, total: number) {
  const usableArea = usableWidth * usableHeight;
  const coveredArea = total * (stickerWidth * stickerHeight);
  return Math.max(0, usableArea - coveredArea);
}

function placeGrid(
  originX: number,
  originY: number,
  areaWidth: number,
  areaHeight: number,
  stickerWidth: number,
  stickerHeight: number,
  gap: number,
  rotated: boolean
): GridPlacement {
  if (areaWidth <= 0 || areaHeight <= 0) {
    return { count: 0, cols: 0, rows: 0, usedWidth: 0, usedHeight: 0, placements: [] };
  }

  const cols = Math.floor((areaWidth + gap) / (stickerWidth + gap));
  const rows = Math.floor((areaHeight + gap) / (stickerHeight + gap));

  if (cols <= 0 || rows <= 0) {
    return { count: 0, cols: 0, rows: 0, usedWidth: 0, usedHeight: 0, placements: [] };
  }

  const placements: StickerPlacement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      placements.push({
        x: originX + col * (stickerWidth + gap),
        y: originY + row * (stickerHeight + gap),
        width: stickerWidth,
        height: stickerHeight,
        rotated,
      });
    }
  }

  const usedWidth = cols * stickerWidth + (cols - 1) * gap;
  const usedHeight = rows * stickerHeight + (rows - 1) * gap;

  return {
    count: cols * rows,
    cols,
    rows,
    usedWidth,
    usedHeight,
    placements,
  };
}

function buildSingleOrientationCandidate(
  strategy: 'original' | 'rotated',
  usableWidth: number,
  usableHeight: number,
  stickerWidth: number,
  stickerHeight: number,
  gap: number,
  rotated: boolean
): StrategyCandidate {
  const base = placeGrid(0, 0, usableWidth, usableHeight, stickerWidth, stickerHeight, gap, rotated);
  return {
    strategy,
    total: base.count,
    cols: base.cols,
    rows: base.rows,
    placements: base.placements,
    wasteAreaMm2: getWasteArea(usableWidth, usableHeight, stickerWidth, stickerHeight, base.count),
  };
}

function buildMixedCandidate(
  usableWidth: number,
  usableHeight: number,
  baseWidth: number,
  baseHeight: number,
  altWidth: number,
  altHeight: number,
  gap: number,
  baseRotated: boolean,
  altRotated: boolean
): StrategyCandidate {
  const base = placeGrid(0, 0, usableWidth, usableHeight, baseWidth, baseHeight, gap, baseRotated);

  const rightStartX = base.cols > 0 ? base.usedWidth + gap : 0;
  const rightWidth = Math.max(0, usableWidth - rightStartX);
  const right = placeGrid(rightStartX, 0, rightWidth, usableHeight, altWidth, altHeight, gap, altRotated);

  const bottomStartY = base.rows > 0 ? base.usedHeight + gap : 0;
  const bottomHeight = Math.max(0, usableHeight - bottomStartY);
  const bottomWidth = base.cols > 0 ? base.usedWidth : usableWidth;
  const bottom = placeGrid(0, bottomStartY, bottomWidth, bottomHeight, altWidth, altHeight, gap, altRotated);

  const total = base.count + right.count + bottom.count;

  return {
    strategy: 'mixed',
    total,
    cols: base.cols,
    rows: base.rows,
    placements: [...base.placements, ...right.placements, ...bottom.placements],
    wasteAreaMm2: getWasteArea(usableWidth, usableHeight, baseWidth, baseHeight, total),
  };
}

function pickBestCandidate(candidates: StrategyCandidate[]) {
  return candidates.reduce((best, current) => {
    if (current.total > best.total) return current;
    if (current.total < best.total) return best;

    if (current.strategy === 'mixed' && best.strategy !== 'mixed') return current;
    if (best.strategy === 'mixed' && current.strategy !== 'mixed') return best;

    if (current.wasteAreaMm2 < best.wasteAreaMm2) return current;
    if (current.wasteAreaMm2 > best.wasteAreaMm2) return best;

    if (current.strategy === 'original' && best.strategy !== 'original') return current;
    return best;
  });
}

export function calculateStickerSheet(input: StickerSheetInput): StickerSheetResult {
  const sheetWidth = input.sheetWidthMm ?? DEFAULT_SHEET_WIDTH_MM;
  const sheetHeight = input.sheetHeightMm ?? DEFAULT_SHEET_HEIGHT_MM;
  const usableWidth = input.usableWidthMm ?? DEFAULT_USABLE_WIDTH_MM;
  const usableHeight = input.usableHeightMm ?? DEFAULT_USABLE_HEIGHT_MM;

  const stickerWidth = input.stickerWidthMm;
  const stickerHeight = input.stickerHeightMm;
  const gap = input.gapMm;

  const emptyResult: StickerSheetResult = {
    total: 0,
    strategy: 'original',
    cols: 0,
    rows: 0,
    placements: [],
    wasteAreaMm2: Math.max(0, usableWidth * usableHeight),
    breakdown: {
      originalOnly: 0,
      rotatedOnly: 0,
      mixed: 0,
    },
  };

  if (
    !isValidPositiveNumber(sheetWidth) ||
    !isValidPositiveNumber(sheetHeight) ||
    !isValidPositiveNumber(usableWidth) ||
    !isValidPositiveNumber(usableHeight) ||
    !isValidPositiveNumber(stickerWidth) ||
    !isValidPositiveNumber(stickerHeight) ||
    !isValidNonNegativeNumber(gap)
  ) {
    return emptyResult;
  }

  const originalCandidate = buildSingleOrientationCandidate(
    'original',
    usableWidth,
    usableHeight,
    stickerWidth,
    stickerHeight,
    gap,
    false
  );
  const rotatedCandidate = buildSingleOrientationCandidate(
    'rotated',
    usableWidth,
    usableHeight,
    stickerHeight,
    stickerWidth,
    gap,
    true
  );
  const mixedBaseOriginal = buildMixedCandidate(
    usableWidth,
    usableHeight,
    stickerWidth,
    stickerHeight,
    stickerHeight,
    stickerWidth,
    gap,
    false,
    true
  );
  const mixedBaseRotated = buildMixedCandidate(
    usableWidth,
    usableHeight,
    stickerHeight,
    stickerWidth,
    stickerWidth,
    stickerHeight,
    gap,
    true,
    false
  );
  const mixedCandidate = mixedBaseOriginal.total >= mixedBaseRotated.total ? mixedBaseOriginal : mixedBaseRotated;
  const best = pickBestCandidate([originalCandidate, rotatedCandidate, mixedCandidate]);

  return {
    ...best,
    breakdown: {
      originalOnly: originalCandidate.total,
      rotatedOnly: rotatedCandidate.total,
      mixed: mixedCandidate.total,
    },
  };
}
