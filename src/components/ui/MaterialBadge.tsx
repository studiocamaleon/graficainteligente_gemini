interface MaterialBadgeProps {
  materialNombre: string;
  varianteNombre: string;
  espesor?: number | null;
  unidadEspesor?: string | null;
  className?: string;
}

export function MaterialBadge({
  materialNombre,
  varianteNombre,
  espesor,
  unidadEspesor,
  className = '',
}: MaterialBadgeProps) {
  const formatMaterialText = (): string => {
    let text = `${materialNombre} ${varianteNombre}`;

    if (espesor && unidadEspesor) {
      text += ` ${espesor} ${unidadEspesor}`;
    }

    return text;
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg ${className}`}
      title={formatMaterialText()}
    >
      <div className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4 text-amber-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span className="text-sm font-medium text-amber-800 truncate max-w-xs">
          {formatMaterialText()}
        </span>
      </div>
    </div>
  );
}
