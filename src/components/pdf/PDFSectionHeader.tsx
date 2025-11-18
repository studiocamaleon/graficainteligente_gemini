import { ReactNode } from 'react';

interface PDFSectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  color?: 'blue' | 'purple' | 'gray';
}

export function PDFSectionHeader({
  title,
  subtitle,
  badge,
  color = 'purple',
}: PDFSectionHeaderProps) {
  const colorClasses = {
    blue: 'bg-blue-100 border-l-blue-600',
    purple: 'bg-purple-100 border-l-purple-600',
    gray: 'bg-gray-100 border-l-gray-600',
  };

  return (
    <div className={`avoid-break p-4 ${colorClasses[color]} border-l-4 rounded-r-lg mb-4`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {badge && <div>{badge}</div>}
      </div>
    </div>
  );
}
