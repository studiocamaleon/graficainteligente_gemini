import { BRAND } from '../../constants/branding';

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

export function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  const currentDate = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="border-b-2 border-gray-300 pb-6 mb-8 page-break-inside-avoid">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{title}</h1>
          {subtitle && (
            <p className="text-lg text-gray-600 font-medium">{subtitle}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{BRAND.name}</p>
          <p className="text-xs text-gray-600 mt-1">{currentDate}</p>
        </div>
      </div>
    </div>
  );
}
