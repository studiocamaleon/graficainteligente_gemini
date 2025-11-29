import { ReactNode } from 'react';
import { Loader } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

type ButtonVariant = 'primary' | 'success' | 'warning' | 'secondary' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface IconActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  tooltip?: string;
  badge?: number;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white shadow-blue-500/30 ring-blue-500',
  success: 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-green-500/30 ring-green-500',
  warning: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-orange-500/30 ring-orange-500',
  secondary: 'bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white shadow-gray-500/30 ring-gray-500',
  outline: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-gray-400 shadow-gray-300/30 ring-gray-300',
};

const sizeStyles: Record<ButtonSize, { button: string; icon: string; label: string }> = {
  sm: {
    button: 'w-10 h-10',
    icon: 'w-4 h-4',
    label: 'text-[10px]',
  },
  md: {
    button: 'w-14 h-14',
    icon: 'w-6 h-6',
    label: 'text-xs',
  },
  lg: {
    button: 'w-16 h-16',
    icon: 'w-7 h-7',
    label: 'text-sm',
  },
};

export function IconActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  tooltip,
  badge,
  size = 'md',
}: IconActionButtonProps) {
  const variantClasses = variantStyles[variant];
  const sizeClasses = sizeStyles[size];

  const buttonContent = (
    <div className="flex flex-col items-center gap-2 group">
      {/* Círculo del botón */}
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={tooltip || label}
        className={`
          relative
          ${sizeClasses.button}
          rounded-full
          flex items-center justify-center
          shadow-md
          transition-all duration-200 ease-out

          ${variantClasses}

          ${
            disabled || loading
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:shadow-lg hover:scale-105 hover:-translate-y-0.5 active:scale-95 active:shadow-md'
          }

          focus:outline-none focus:ring-2 focus:ring-offset-2

          ${disabled || loading ? '' : 'transform'}
        `}
        type="button"
      >
        {/* Icono */}
        <div className={`${sizeClasses.icon} ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
          {icon}
        </div>

        {/* Badge (si existe) */}
        {badge !== undefined && badge > 0 && !loading && (
          <span
            className="
              absolute -top-1 -right-1
              min-w-[20px] h-5 px-1
              rounded-full
              bg-red-500
              text-white text-[10px] font-bold
              flex items-center justify-center
              shadow-md shadow-red-500/50
              animate-pulse
              border-2 border-white
            "
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader className={`${sizeClasses.icon} animate-spin`} />
          </div>
        )}
      </button>

      {/* Label */}
      <span
        className={`
          ${sizeClasses.label}
          font-medium text-gray-700
          group-hover:text-gray-900
          transition-colors duration-200
          text-center
          max-w-[80px]
          leading-tight
          ${disabled || loading ? 'opacity-40' : ''}
        `}
      >
        {label}
      </span>
    </div>
  );

  // Si hay tooltip, envolver con Tooltip
  if (tooltip && !disabled && !loading) {
    return (
      <Tooltip content={tooltip} position="top">
        {buttonContent}
      </Tooltip>
    );
  }

  // Si está disabled y hay tooltip, mostrar por qué está disabled
  if (tooltip && (disabled || loading)) {
    return (
      <Tooltip content={tooltip} position="top">
        {buttonContent}
      </Tooltip>
    );
  }

  return buttonContent;
}
