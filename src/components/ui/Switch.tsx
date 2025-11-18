import { forwardRef } from 'react';
import { motion } from 'framer-motion';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  helperText?: string;
}

const sizeStyles = {
  sm: {
    container: 'w-10 h-5',
    thumb: 'w-4 h-4',
    translate: 'translate-x-5',
  },
  md: {
    container: 'w-12 h-6',
    thumb: 'w-5 h-5',
    translate: 'translate-x-6',
  },
  lg: {
    container: 'w-14 h-7',
    thumb: 'w-6 h-6',
    translate: 'translate-x-7',
  },
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, label, disabled = false, size = 'md', helperText }, ref) => {
    const { container, thumb, translate } = sizeStyles[size];

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <button
            ref={ref}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
              ${container} relative inline-flex items-center rounded-full
              transition-colors duration-200 ease-in-out
              focus:outline-none focus:ring-4 focus:ring-blue-200
              ${checked ? 'bg-gradient-to-r from-blue-600 to-cyan-600' : 'bg-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <motion.span
              animate={{ x: checked ? (size === 'sm' ? 20 : size === 'md' ? 24 : 28) : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`
                ${thumb} inline-block rounded-full bg-white shadow-lg
              `}
            />
          </button>
          {label && (
            <span className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
              {label}
            </span>
          )}
        </div>
        {helperText && (
          <p className="text-xs text-gray-500 ml-12">{helperText}</p>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
