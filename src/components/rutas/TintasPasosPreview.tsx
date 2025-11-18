import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { InkBadge } from '../ui/InkBadge';
import type { TintaType } from '../../types/database';

interface TintaPasoPreview {
  id: string;
  tinta: TintaType;
  paso_id: string | null;
  paso?: {
    id: string;
    nombre: string;
    codigo: string | null;
    etapa: string;
  } | null;
}

interface TintasPasosPreviewProps {
  tintas: TintaPasoPreview[];
  loading: boolean;
  error: string | null;
}

export function TintasPasosPreview({ tintas, loading, error }: TintasPasosPreviewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 bg-gray-50 rounded-lg border-2 border-gray-200">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Cargando configuración de tintas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (tintas.length === 0) {
    return (
      <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 mb-1">
              Esta tecnología no tiene tintas configuradas
            </p>
            <p className="text-xs text-orange-700">
              Ve a ABM Core → Tecnologías y configura los tipos de tinta con sus pasos
              para poder usar esta condición.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasIncomplete = tintas.some((t) => !t.paso_id);
  const allComplete = tintas.every((t) => t.paso_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Configuración de Tintas
          </span>
          {allComplete ? (
            <Badge variant="success">
              <CheckCircle className="w-3 h-3 mr-1" />
              Completo
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertCircle className="w-3 h-3 mr-1" />
              Incompleto
            </Badge>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {tintas.length} tinta{tintas.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {tintas.map((tinta) => (
          <div
            key={tinta.id}
            className={`p-3 rounded-lg border-2 ${
              tinta.paso_id
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 pt-0.5">
                <InkBadge tinta={tinta.tinta} />
              </div>

              <div className="flex-1 min-w-0">
                {tinta.paso_id && tinta.paso ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600">
                        Paso asignado:{' '}
                        <span className="font-medium text-gray-900">
                          {tinta.paso.nombre}
                        </span>
                        {tinta.paso.codigo && (
                          <span className="text-gray-500"> ({tinta.paso.codigo})</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Etapa: {tinta.paso.etapa}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <p className="text-xs text-orange-700 font-medium">
                      Sin paso asignado
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasIncomplete && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mt-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-orange-800 font-medium mb-1">
                Configuración incompleta
              </p>
              <p className="text-xs text-orange-700">
                Algunas tintas no tienen pasos asignados. Ve a ABM Core → Tecnologías
                y asigna un paso a cada tinta antes de usar esta condición.
              </p>
            </div>
          </div>
        </div>
      )}

      {allComplete && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Cuando el producto use esta tecnología, se ejecutará el paso correspondiente
              al tipo de tinta seleccionado. La configuración se realizó en ABM Core.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
