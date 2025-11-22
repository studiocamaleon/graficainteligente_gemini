import { ReactNode } from 'react';

interface SimpleTableProps {
  children: ReactNode;
  className?: string;
}

export function SimpleTable({ children, className = '' }: SimpleTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full ${className}`}>
        {children}
      </table>
    </div>
  );
}
