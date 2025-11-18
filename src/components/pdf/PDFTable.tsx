import { ReactNode } from 'react';

interface PDFTableColumn {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface PDFTableProps {
  columns: PDFTableColumn[];
  data: Record<string, any>[];
  title?: string;
  className?: string;
}

export function PDFTable({ columns, data, title, className = '' }: PDFTableProps) {
  return (
    <div className={`avoid-break ${className}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
      )}
      <div className="overflow-hidden border border-gray-300 rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-sm font-semibold border-r border-blue-500 last:border-r-0 text-${column.align || 'left'}`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-gray-700 border-r border-gray-200 last:border-r-0 text-${column.align || 'left'}`}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
