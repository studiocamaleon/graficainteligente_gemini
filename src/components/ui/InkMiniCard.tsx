import { motion } from 'framer-motion';
import { Droplet } from 'lucide-react';

interface InkMiniCardProps {
  tinta: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  displayOnly?: boolean;
}

export function InkMiniCard({
  tinta,
  isSelected,
  onClick,
  disabled = false,
  displayOnly = false,
}: InkMiniCardProps) {
  if (displayOnly) {
    return (
      <div
        className="
          inline-flex items-center gap-2 px-3 py-2 rounded-lg
          bg-gradient-to-br from-blue-50 to-blue-100
          border border-blue-300
        "
      >
        <div className="flex items-center justify-center w-6 h-6 bg-white rounded-md border border-blue-300">
          <Droplet className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-sm font-semibold text-blue-900">{tinta}</span>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`
        w-full px-3 py-1.5 rounded-md border transition-all duration-200 text-xs font-medium
        ${
          isSelected
            ? 'border-blue-400 bg-blue-500 text-white shadow-sm'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
      `}
    >
      {tinta}
    </motion.button>
  );
}
