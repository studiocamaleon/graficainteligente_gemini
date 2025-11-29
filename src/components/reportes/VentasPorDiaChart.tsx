import type { VentasPorDiaSemana } from '../../types/reportes';

interface VentasPorDiaChartProps {
  data?: VentasPorDiaSemana[];
  loading?: boolean;
}

export function VentasPorDiaChart({ data, loading }: VentasPorDiaChartProps) {
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

  const maxOrdenes = Math.max(...data.map(d => d.total_ordenes));
  const mejorDia = data.reduce((prev, current) =>
    prev.total_ordenes > current.total_ordenes ? prev : current
  );

  const ordenDiasSemana = [1, 2, 3, 4, 5, 6, 0];
  const dataOrdenada = ordenDiasSemana
    .map(dia => data.find(d => d.dia_semana === dia))
    .filter(Boolean) as VentasPorDiaSemana[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {dataOrdenada.map((dia) => {
          const altura = maxOrdenes > 0 ? (dia.total_ordenes / maxOrdenes) * 100 : 0;
          const esMejorDia = dia.dia_semana === mejorDia.dia_semana;

          return (
            <div key={dia.dia_semana} className="flex flex-col items-center">
              <div className="w-full h-48 flex flex-col justify-end">
                <div
                  className={`w-full rounded-t transition-all duration-500 ${
                    esMejorDia ? 'bg-green-500' : 'bg-blue-500'
                  } hover:opacity-80`}
                  style={{ height: `${altura}%` }}
                  title={`${dia.total_ordenes} órdenes - $${dia.total_ventas.toFixed(2)}`}
                >
                  <div className="flex flex-col items-center justify-center h-full text-white text-xs font-semibold">
                    <span>{dia.total_ordenes}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-center">
                <div className="text-xs font-medium text-gray-700">
                  {dia.dia_nombre.substring(0, 3)}
                </div>
                <div className="text-xs text-gray-500">
                  {dia.porcentaje_ordenes.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="pb-2">Día</th>
              <th className="pb-2 text-right">Órdenes</th>
              <th className="pb-2 text-right">Ventas</th>
              <th className="pb-2 text-right">Ticket Prom.</th>
            </tr>
          </thead>
          <tbody>
            {dataOrdenada.map((dia) => {
              const esMejorDia = dia.dia_semana === mejorDia.dia_semana;
              return (
                <tr key={dia.dia_semana} className={`border-b ${esMejorDia ? 'bg-green-50' : ''}`}>
                  <td className="py-2 font-medium">
                    {dia.dia_nombre}
                    {esMejorDia && (
                      <span className="ml-2 text-xs text-green-600 font-semibold">
                        Mejor Día
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">{dia.total_ordenes}</td>
                  <td className="py-2 text-right">${dia.total_ventas.toFixed(2)}</td>
                  <td className="py-2 text-right">${dia.ticket_promedio.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
