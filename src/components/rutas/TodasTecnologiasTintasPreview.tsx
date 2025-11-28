import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { InkBadge } from '../ui/InkBadge';
import { useTodasTecnologiasTintas } from '../../hooks/useTodasTecnologiasTintas';
import type { TecnologiaConTintas } from '../../hooks/useTodasTecnologiasTintas';

export function TodasTecnologiasTintasPreview() {
  const { tecnologias, loading, error, tecnologiasIncompletas, tecnologiasSinTintas } = useTodasTecnologiasTintas();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-gray-200">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Cargando configuración de tecnologías...</span>
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

  if (tecnologias.length === 0) {
    return (
      <div className="p-6 bg-orange-50 border-2 border-orange-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 mb-2">
              No hay tecnologías configuradas en el sistema
            </p>
            <p className="text-xs text-orange-700 mb-3">
              Para usar esta condición, primero debes crear tecnologías y configurar sus tipos de tinta con pasos asociados.
            </p>
            <a
              href="/app/abm-core/tecnologias"
              className="inline-flex items-center gap-2 text-xs font-medium text-orange-800 hover:text-orange-900 underline"
            >
              <ExternalLink className="w-3 h-3" />
              Ir a configurar tecnologías
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Configuración de Tecnologías y Tintas
          </label>
          <p className="text-xs text-gray-500 mt-1">
            {tecnologias.length} {tecnologias.length === 1 ? 'tecnología configurada' : 'tecnologías configuradas'} en el sistema
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {tecnologias.map((tecnologia) => (
          <TecnologiaAccordionItem
            key={tecnologia.tecnologia.id}
            tecnologia={tecnologia}
            isExpanded={expandedIds.has(tecnologia.tecnologia.id)}
            onToggle={() => toggleExpanded(tecnologia.tecnologia.id)}
          />
        ))}
      </div>

      {(tecnologiasIncompletas > 0 || tecnologiasSinTintas > 0) && (
        <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 mb-1">
                {tecnologiasIncompletas > 0 && tecnologiasSinTintas > 0
                  ? `${tecnologiasIncompletas + tecnologiasSinTintas} tecnologías requieren configuración`
                  : tecnologiasIncompletas > 0
                  ? `${tecnologiasIncompletas} ${tecnologiasIncompletas === 1 ? 'tecnología tiene' : 'tecnologías tienen'} tintas sin paso asignado`
                  : `${tecnologiasSinTintas} ${tecnologiasSinTintas === 1 ? 'tecnología no tiene' : 'tecnologías no tienen'} tintas configuradas`
                }
              </p>
              <p className="text-xs text-orange-700 mb-2">
                Configura todas las tintas de cada tecnología para que esta condición funcione correctamente.
              </p>
              <a
                href="/app/abm-core/tecnologias"
                className="inline-flex items-center gap-2 text-xs font-medium text-orange-800 hover:text-orange-900 underline"
              >
                <ExternalLink className="w-3 h-3" />
                Ir a ABM Core → Tecnologías para completar configuración
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            <strong>Funcionamiento:</strong> Cuando un cliente elija un producto, el sistema evaluará automáticamente
            su tecnología y tipo de tinta, y ejecutará el paso correspondiente configurado arriba. No necesitas
            seleccionar una tecnología específica, esta condición funciona para TODAS las tecnologías del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

interface TecnologiaAccordionItemProps {
  tecnologia: TecnologiaConTintas;
  isExpanded: boolean;
  onToggle: () => void;
}

function TecnologiaAccordionItem({ tecnologia, isExpanded, onToggle }: TecnologiaAccordionItemProps) {
  const { tecnologia: tech, tintas, tieneTodasTintasConfiguradas, tintasConfiguradas, tintasTotal } = tecnologia;

  const statusVariant = tintasTotal === 0
    ? 'secondary'
    : tieneTodasTintasConfiguradas
    ? 'success'
    : 'warning';

  const statusText = tintasTotal === 0
    ? 'Sin tintas'
    : tieneTodasTintasConfiguradas
    ? 'Completo'
    : `${tintasConfiguradas}/${tintasTotal}`;

  return (
    <div className="border-2 rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {tech.nombre}
              </span>
              {tech.codigo && (
                <span className="text-xs text-gray-500">({tech.codigo})</span>
              )}
            </div>
            {!isExpanded && tintasTotal > 0 && (
              <span className="text-xs text-gray-500">
                {tintasTotal} {tintasTotal === 1 ? 'tinta' : 'tintas'}
              </span>
            )}
          </div>
        </div>
        <Badge variant={statusVariant}>
          {statusVariant === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
          {statusVariant === 'warning' && <AlertCircle className="w-3 h-3 mr-1" />}
          {statusText}
        </Badge>
      </button>

      {isExpanded && (
        <div className="border-t-2 border-gray-100 bg-gray-50 p-4">
          {tintas.length === 0 ? (
            <div className="text-center py-4">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Esta tecnología no tiene tintas configuradas</p>
              <p className="text-xs text-gray-500 mt-1">
                Ve a ABM Core → Tecnologías y agrega tipos de tinta con sus pasos asociados
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tintas.map((tinta) => (
                <div
                  key={tinta.id}
                  className={`p-3 rounded-lg border ${
                    tinta.paso_id
                      ? 'bg-white border-green-200'
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
                            <p className="text-xs text-gray-900 font-medium">
                              {tinta.paso.nombre}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {tinta.paso.codigo && `${tinta.paso.codigo} • `}Etapa: {tinta.paso.etapa}
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
          )}
        </div>
      )}
    </div>
  );
}
