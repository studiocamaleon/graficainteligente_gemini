import { ReactNode, forwardRef } from 'react';
import '../../styles/print.css';

interface PrintableDocumentProps {
  children: ReactNode;
  className?: string;
}

export const PrintableDocument = forwardRef<HTMLDivElement, PrintableDocumentProps>(
  ({ children, className = '' }, ref) => {
    return (
      <div ref={ref} className={`printable-document ${className}`}>
        {children}
      </div>
    );
  }
);

PrintableDocument.displayName = 'PrintableDocument';
