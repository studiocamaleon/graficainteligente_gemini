import { Trophy, TrendingUp } from 'lucide-react';
import type { VentasPorUsuario } from '../../types/reportes';

interface VentasPorUsuarioTableProps {
  data?: VentasPorUsuario[];
  loading?: boolean;
}

export function VentasPorUsuarioTable({ data, loading }: VentasPorUsuarioTableProps) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No hay datos disponibles
      </div>
    );
  }

  const getRankingIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Trophy className="w-5 h-5 text-orange-600" />;
    return null;
  };

  const getRankingColor = (index: number) => {
    if (index === 0) return 'bg-yellow-50 border-yellow-200';
    if (index === 1) return 'bg-gray-50 border-gray-200';
    if (index === 2) return 'bg-orange-50 border-orange-200';
    return '';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Ranking
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Usuario
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Total Facturado
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Órdenes
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Ticket Prom.
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              % del Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((usuario, index) => (
            <tr
              key={usuario.usuario_id}
              className={`hover:bg-gray-50 transition-colors ${getRankingColor(index)}`}
            >
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {getRankingIcon(index)}
                  <span className="text-lg font-bold text-gray-700">
                    #{index + 1}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {usuario.usuario_nombre || 'Usuario Desconocido'}
                  </span>
                  <span className="text-xs text-gray-500">{usuario.usuario_email}</span>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-sm font-bold text-gray-900">
                    ${usuario.total_ventas.toFixed(2)}
                  </span>
                  {index < 3 && <TrendingUp className="w-4 h-4 text-green-500" />}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-gray-700">{usuario.total_ordenes}</span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-gray-700">${usuario.ticket_promedio.toFixed(2)}</span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${usuario.porcentaje}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {usuario.porcentaje.toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.length > 3 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            Los primeros 3 usuarios representan el{' '}
            <span className="font-bold">
              {data.slice(0, 3).reduce((sum, u) => sum + u.porcentaje, 0).toFixed(1)}%
            </span>{' '}
            de la facturación total.
          </p>
        </div>
      )}
    </div>
  );
}
