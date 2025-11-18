import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface NivelPreview {
  id: string;
  nombre: string;
  tipo_impacto: string;
  valor_impacto: number;
  valor_impacto_secundario: number | null;
  paso_id: string | null;
  paso?: {
    id: string;
    nombre: string;
    codigo: string | null;
    etapa: string;
  } | null;
}

interface NivelesPreviewListProps {
  niveles: NivelPreview[];
  loading: boolean;
  error: string | null;
  tipo: 'servicio' | 'acabado';
}

const getTipoImpactoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    sin_impacto: 'Sin Impacto',
    precio_fijo: 'Precio Fijo',
    por_unidad: 'Por Unidad',
    por_minuto: 'Por Minuto',
    porcentual: 'Porcentual (%)',
    por_mt2: 'Por m²',
    por_mt_lineal: 'Por Metro Lineal',
    fijo_porcentual: 'Fijo + Porcentual',
    fijo_mt2: 'Fijo + Por m²',
    fijo_mt_lineal: 'Fijo + Por Metro Lineal',
    fijo_minuto: 'Fijo + Por Minuto',
  };
  return labels[tipo] || tipo;
};

export function NivelesPreviewList({ niveles, loading, error, tipo }: NivelesPreviewListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 bg-gray-50 rounded-lg border-2 border-gray-200">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Cargando niveles...</span>
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

  if (niveles.length === 0) {
    return (
      <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 mb-1">
              Este {tipo} no tiene niveles de precio configurados
            </p>
            <p className="text-xs text-orange-700">
              Ve a ABM Core → {tipo === 'servicio' ? 'Servicios' : 'Acabados'} y agrega niveles de precio
              para poder usar esta condición.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasIncomplete = niveles.some((n) => !n.paso_id);
  const allComplete = niveles.every((n) => n.paso_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Configuración de Niveles
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
          {niveles.length} nivel{niveles.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {niveles.map((nivel, index) => (
          <div
            key={nivel.id}
            className={`p-3 rounded-lg border-2 ${
              nivel.paso_id
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-7 h-7 bg-white rounded-full font-semibold text-sm flex-shrink-0 border-2 border-gray-300">
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 text-sm">{nivel.nombre}</h4>
                  <Badge variant="neutral" size="sm">
                    {getTipoImpactoLabel(nivel.tipo_impacto)}
                  </Badge>
                </div>

                {nivel.paso_id && nivel.paso ? (
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600">
                        Paso asignado:{' '}
                        <span className="font-medium text-gray-900">
                          {nivel.paso.nombre}
                        </span>
                        {nivel.paso.codigo && (
                          <span className="text-gray-500"> ({nivel.paso.codigo})</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Etapa: {nivel.paso.etapa}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
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
                Algunos niveles no tienen pasos asignados. Ve a ABM Core →{' '}
                {tipo === 'servicio' ? 'Servicios' : 'Acabados'} y asigna un paso a cada nivel
                antes de usar esta condición.
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
              Los pasos se ejecutarán automáticamente según el nivel elegido por el cliente.
              La configuración se realizó en ABM Core.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
