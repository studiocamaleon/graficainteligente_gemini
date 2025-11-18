import { motion } from 'framer-motion';
import { getInkDisplay } from '../../utils/inkUtils';

interface InkBadgeProps {
  tinta: string;
  className?: string;
}

export function InkBadge({ tinta, className = '' }: InkBadgeProps) {
  if (!tinta) {
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 border-2 border-gray-300 ${className}`}>
        <span className="text-xs text-gray-500 font-medium">Tipo no especificado</span>
      </div>
    );
  }

  const inkConfig = getInkDisplay(tinta);
  const label = inkConfig.label || tinta;
  const secondaryLabel = label.includes('(')
    ? label.split('(')[1]?.replace(')', '') || ''
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        inline-flex items-center gap-3 px-5 py-3 rounded-xl
        ${inkConfig.bgColor}
        border-2 ${inkConfig.borderColor}
        shadow-sm
        ${className}
      `}
    >
      <div className="flex items-center gap-1.5">
        {inkConfig.colors.map((color, index) => {
          // Renderizado especial para barniz (V)
          if (color === 'VARNISH') {
            return (
              <div
                key={index}
                className="relative w-4 h-4 rounded-full shadow-sm ring-2 ring-white bg-gradient-to-br from-gray-300 via-gray-200 to-gray-100 flex items-center justify-center"
                style={{
                  boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.8), inset 0 -1px 2px rgba(0, 0, 0, 0.15)'
                }}
              >
                <span className="text-[6px] font-bold text-gray-700 leading-none">V</span>
              </div>
            );
          }

          // Renderizado normal para otras tintas
          return (
            <div
              key={index}
              className="w-4 h-4 rounded-full shadow-sm ring-2 ring-white"
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${inkConfig.color} uppercase tracking-wide`}>
          {tinta}
        </span>
        {secondaryLabel && (
          <span className="text-xs text-gray-600 font-medium">
            {secondaryLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}
