import { forwardRef, ReactNode } from 'react';

interface PDFLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  companyName?: string;
}

export const PDFLayout = forwardRef<HTMLDivElement, PDFLayoutProps>(
  ({ children, title, subtitle, companyName = 'Sistema de Gestión' }, ref) => {
    return (
      <div ref={ref} className="bg-white">
        <style type="text/css" media="print">
          {`
            @page {
              size: A4;
              margin: 15mm;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              .page-break {
                page-break-after: always;
                break-after: page;
              }

              .avoid-break {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }
          `}
        </style>

        <div className="pdf-header bg-blue-600 text-white p-8 mb-6 rounded-lg print:rounded-none">
          {title && (
            <h1 className="text-3xl font-bold text-center mb-2">{title}</h1>
          )}
          {subtitle && (
            <p className="text-center text-lg opacity-90">{subtitle}</p>
          )}
        </div>

        <div className="pdf-content">
          {children}
        </div>

        <div className="pdf-footer mt-8 pt-4 border-t border-gray-300 flex justify-between items-center text-sm text-gray-600">
          <span className="font-medium">{companyName}</span>
          <span>{new Date().toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
      </div>
    );
  }
);

PDFLayout.displayName = 'PDFLayout';
