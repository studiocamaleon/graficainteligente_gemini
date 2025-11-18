import { ReactNode, Fragment } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  fullHeight?: boolean;
  compact?: boolean;
  dense?: boolean;
  expandable?: boolean;
  expandedRowId?: string | null;
  onToggleExpand?: (id: string) => void;
  renderExpandedContent?: (item: T) => ReactNode;
  isRowExpandable?: (item: T) => boolean;
  onRowClick?: (item: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No hay datos para mostrar',
  isLoading = false,
  fullHeight = false,
  compact = false,
  dense = false,
  expandable = false,
  expandedRowId = null,
  onToggleExpand,
  renderExpandedContent,
  isRowExpandable,
  onRowClick
}: TableProps<T>) {
  const cellPadding = dense ? 'px-4 py-1.5' : compact ? 'px-4 py-2.5' : 'px-6 py-4';
  const headerPadding = dense ? 'px-4 py-2' : compact ? 'px-4 py-2' : 'px-6 py-4';

  const handleRowClick = (item: T) => {
    if (expandable && onToggleExpand && isRowExpandable && isRowExpandable(item)) {
      onToggleExpand(keyExtractor(item));
    } else if (onRowClick) {
      onRowClick(item);
    }
  };
  if (isLoading) {
    return (
      <div className={`w-full ${fullHeight ? 'h-full flex flex-col' : 'overflow-x-auto'}`}>
        <div className={fullHeight ? 'flex-1 overflow-auto' : ''}>
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`${headerPadding} text-left text-xs font-semibold text-gray-600 uppercase tracking-wider`}
                    style={{ width: column.width }}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...Array(5)].map((_, index) => (
                <tr key={`loading-${index}`} className="animate-pulse">
                  {columns.map((column) => (
                    <td key={column.key} className={cellPadding}>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
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

  if (data.length === 0) {
    return (
      <div className={`w-full ${fullHeight ? 'h-full flex items-center justify-center' : 'py-12'} text-center`}>
        <p className="text-gray-500 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  if (fullHeight) {
    return (
      <div className="w-full h-full flex flex-col border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
              <tr>
                {expandable && <th key="expand-col" className={`${headerPadding} w-12 bg-gray-50`}></th>}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`${headerPadding} text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50`}
                    style={{ width: column.width }}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item) => {
                const itemKey = keyExtractor(item);
                const isExpanded = expandedRowId === itemKey;
                const canExpand = expandable && isRowExpandable && isRowExpandable(item);

                return (
                  <Fragment key={itemKey}>
                    <tr
                      className={`transition-colors duration-150 ${
                        canExpand || onRowClick ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleRowClick(item)}
                    >
                      {expandable && (
                        <td className={`${cellPadding} w-12`}>
                          {canExpand && (
                            <div className="flex items-center justify-center">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-600 transition-transform duration-200" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-600 transition-transform duration-200" />
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.key} className={cellPadding}>
                          {column.render(item)}
                        </td>
                      ))}
                    </tr>
                    {canExpand && isExpanded && renderExpandedContent && (
                      <tr key={`${itemKey}-expanded`}>
                        <td colSpan={columns.length + (expandable ? 1 : 0)} className="p-0">
                          <div className="bg-gray-50 border-t border-gray-200">
                            <div className="px-6 py-4">
                              {renderExpandedContent(item)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto overflow-y-visible">
      <table className="w-full">
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            {expandable && <th key="expand-col" className={`${headerPadding} w-12`}></th>}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${headerPadding} text-left text-xs font-semibold text-gray-600 uppercase tracking-wider`}
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => {
            const itemKey = keyExtractor(item);
            const isExpanded = expandedRowId === itemKey;
            const canExpand = expandable && isRowExpandable && isRowExpandable(item);

            return (
              <Fragment key={itemKey}>
                <tr
                  className={`transition-colors duration-150 ${
                    canExpand || onRowClick ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleRowClick(item)}
                >
                  {expandable && (
                    <td className={`${cellPadding} w-12`}>
                      {canExpand && (
                        <div className="flex items-center justify-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-600 transition-transform duration-200" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600 transition-transform duration-200" />
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className={cellPadding}>
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
                {canExpand && isExpanded && renderExpandedContent && (
                  <tr key={`${itemKey}-expanded`}>
                    <td colSpan={columns.length + (expandable ? 1 : 0)} className="p-0">
                      <div className="bg-gray-50 border-t border-gray-200">
                        <div className="px-6 py-4">
                          {renderExpandedContent(item)}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
