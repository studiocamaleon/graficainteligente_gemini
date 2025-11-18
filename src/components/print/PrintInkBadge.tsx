import { getInkDisplay } from '../../utils/inkUtils';

interface PrintInkBadgeProps {
  tinta: string;
  className?: string;
}

export function PrintInkBadge({ tinta, className = '' }: PrintInkBadgeProps) {
  if (!tinta) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300 ${className}`}>
        <span className="text-xs text-gray-500 font-medium">Tipo no especificado</span>
      </div>
    );
  }

  const inkConfig = getInkDisplay(tinta);
  const label = inkConfig.label || tinta;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border-2 border-gray-300 ${className}`}>
      <div className="flex items-center gap-1">
        {inkConfig.colors.map((color, index) => {
          if (color === 'VARNISH') {
            return (
              <div
                key={index}
                className="relative w-3 h-3 rounded-full bg-gray-200 border border-gray-400 flex items-center justify-center"
                style={{
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8), inset 0 -1px 1px rgba(0, 0, 0, 0.1)'
                }}
              >
                <span className="text-[5px] font-bold text-gray-700">V</span>
              </div>
            );
          }

          return (
            <div
              key={index}
              className="w-3 h-3 rounded-full border border-gray-300"
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
        {tinta}
      </span>
    </div>
  );
}
