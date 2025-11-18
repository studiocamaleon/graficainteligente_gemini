import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface TechnologyMiniCardProps {
  nombre: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function TechnologyMiniCard({
  nombre,
  isSelected,
  onClick,
  disabled = false,
}: TechnologyMiniCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`
        relative px-4 py-3 rounded-lg border-2 transition-all duration-200
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 text-blue-900'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
          {nombre}
        </span>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"
          >
            <Check className="w-3 h-3 text-white" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}
