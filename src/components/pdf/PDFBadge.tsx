interface PDFBadgeProps {
  label: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'gray';
  size?: 'sm' | 'md';
}

export function PDFBadge({ label, color = 'blue', size = 'sm' }: PDFBadgeProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colorClasses[color]} ${sizeClasses[size]}`}
    >
      {label}
    </span>
  );
}
