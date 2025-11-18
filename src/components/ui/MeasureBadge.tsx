import { Ruler } from 'lucide-react';

interface MeasureBadgeProps {
  ancho: number;
  alto: number;
  className?: string;
}

export function MeasureBadge({ ancho, alto, className = '' }: MeasureBadgeProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg
        bg-gradient-to-br from-gray-50 to-gray-100
        border border-gray-300
        ${className}
      `}
    >
      <div className="flex items-center justify-center w-6 h-6 bg-white rounded-md border border-gray-300">
        <Ruler className="w-3.5 h-3.5 text-gray-600" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-gray-900">{ancho}</span>
        <span className="text-xs text-gray-500">×</span>
        <span className="text-sm font-semibold text-gray-900">{alto}</span>
        <span className="text-xs text-gray-500 ml-0.5">mm</span>
      </div>
    </div>
  );
}
