import { AlertTriangle, Clock, User } from 'lucide-react';
import type { PausaProlongada } from '../../hooks/usePausasAnalytics';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PausasProlongadasTableProps {
  pausas: PausaProlongada[];
  loading: boolean;
}

const categoriasConfig: Record<string, { label: string; color: string; emoji: string }> = {
  cliente: { label: 'Cliente', color: 'bg-blue-100 text-blue-800', emoji: '👤' },
  materiales: { label: 'Materiales', color: 'bg-orange-100 text-orange-800', emoji: '📦' },
  maquinaria: { label: 'Maquinaria', color: 'bg-red-100 text-red-800', emoji: '⚙️' },
  personal: { label: 'Personal', color: 'bg-purple-100 text-purple-800', emoji: '👥' },
  externo: { label: 'Externo', color: 'bg-gray-100 text-gray-800', emoji: '🌐' },
  otro: { label: 'Otro', color: 'bg-gray-100 text-gray-800', emoji: '⏸️' },
};

export function PausasProlongadasTable({ pausas, loading }: PausasProlongadasTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6 animate-pulse"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (pausas.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-6">Pausas Más Prolongadas</h3>
        <div className="text-center py-8 text-gray-400">
          <p>No hay pausas registradas en este período</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h3 className="text-lg font-semibold">Pausas Más Prolongadas</h3>
      </div>

      <div className="space-y-3">
        {pausas.map((pausa, index) => {
          const config = categoriasConfig[pausa.categoria] || categoriasConfig.otro;

          return (
            <div
              key={pausa.pausa_id}
              className={`border rounded-lg p-4 ${
                pausa.esta_activa ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {pausa.orden_numero}
                      </span>
                      {pausa.esta_activa && (
                        <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-medium rounded-full animate-pulse">
                          Activa
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{pausa.paso_nombre}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.emoji}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span className="font-bold text-red-600">
                    {pausa.duracion_horas}h
                  </span>
                </div>
              </div>

              {pausa.descripcion && (
                <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700 italic">
                  "{pausa.descripcion}"
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>
                    Inicio: {format(new Date(pausa.fecha_inicio), "d 'de' MMM, HH:mm", { locale: es })}
                  </span>
                  {pausa.fecha_fin && (
                    <span>
                      Fin: {format(new Date(pausa.fecha_fin), "d 'de' MMM, HH:mm", { locale: es })}
                    </span>
                  )}
                </div>
                <span className="font-medium">{pausa.motivo_nombre}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
