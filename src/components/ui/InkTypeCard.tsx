import { motion } from 'framer-motion';
import { Droplet, Check } from 'lucide-react';
import { getInkDisplay } from '../../utils/inkUtils';

interface InkTypeCardProps {
  tipo: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function InkTypeCard({ tipo, isSelected, onClick, disabled = false }: InkTypeCardProps) {
  const { label, color, bgColor } = getInkDisplay(tipo);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`
        relative p-4 rounded-lg border-2 transition-all text-left
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
          p-2 rounded-lg transition-colors
          ${isSelected ? bgColor : 'bg-gray-100'}
        `}
        >
          <Droplet className={`w-5 h-5 ${isSelected ? color : 'text-gray-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
            {label}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">Tipo de tinta</p>
        </div>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex-shrink-0"
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}
