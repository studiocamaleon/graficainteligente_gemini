import { Route, AlertCircle, Loader2, Package, CheckCircle, Info, MessageSquare } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { useGenerateProductionRoute, type GeneratedStep } from '../../hooks/useGenerateProductionRoute';
import { StepCommentEditor } from './StepCommentEditor';
import { StepCommentIndicator } from './StepCommentIndicator';

interface OrdenRutasTabProps {
  items: any[];
  onUpdateStepComment?: (itemIndex: number, stepId: string, comment: string | null) => void;
  readOnly?: boolean;
}

export function OrdenRutasTab({ items, onUpdateStepComment, readOnly = false }: OrdenRutasTabProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Route}
        title="No hay items en la orden"
        description="Las rutas de producción se generarán automáticamente al agregar items"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Vista previa de rutas de producción</p>
          <p className="text-blue-700">
            Estas rutas se generarán automáticamente en la base de datos al crear la orden.
            Los pasos se evalúan según los servicios y acabados seleccionados en cada producto.
            {!readOnly && ' Puedes agregar comentarios opcionales en cada paso para el operador de producción.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <ItemRoutePreview
            key={item.id || index}
            item={item}
            index={index}
            onUpdateStepComment={onUpdateStepComment}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

interface ItemRoutePreviewProps {
  item: any;
  index: number;
  onUpdateStepComment?: (itemIndex: number, stepId: string, comment: string | null) => void;
  readOnly?: boolean;
}

// Mapeo de etapas para compatibilidad entre diferentes formatos
function normalizeEtapa(etapa: string): string {
  const etapaLower = etapa.toLowerCase().replace(/[-\s]/g, '_');

  if (etapaLower === 'pre_prensa' || etapaLower.includes('pre')) return 'Pre-prensa';
  if (etapaLower === 'post_prensa' || etapaLower.includes('terminacion') || etapaLower.includes('acabado')) return 'Terminacion';
  if (etapaLower === 'principal' || etapaLower.includes('produccion') || etapaLower.includes('impresion')) return 'Produccion';

  return etapa;
}

function ItemRoutePreview({ item, index, onUpdateStepComment, readOnly = false }: ItemRoutePreviewProps) {
  // Solo generar rutas si no existen previamente
  const shouldGenerate = !item.rutas_generadas || item.rutas_generadas.length === 0;

  const { steps, loading, error } = useGenerateProductionRoute({
    productoId: shouldGenerate ? item.producto_id : '',
    categoria: shouldGenerate ? (item.configuracion?.categoria || item.categoria || 'Impresion Laser') : '',
    configuracion: shouldGenerate ? (item.configuracion || {}) : {},
  });

  // Usar rutas guardadas si existen, sino usar las generadas
  const stepsWithComments = item.rutas_generadas || steps;
  const commentCount = stepsWithComments.filter((s: any) => s.comentario_vendedor && s.comentario_vendedor.trim().length > 0).length;

  // Agrupar pasos por etapa normalizada
  const pasosPorEtapa = stepsWithComments.reduce((acc: Record<string, any[]>, paso: any) => {
    const etapaNormalizada = normalizeEtapa(paso.etapa);
    if (!acc[etapaNormalizada]) {
      acc[etapaNormalizada] = [];
    }
    acc[etapaNormalizada].push(paso);
    return acc;
  }, {} as Record<string, any[]>);

  const etapas = ['Pre-prensa', 'Produccion', 'Terminacion'];
  const totalPasos = stepsWithComments.length;

  return (
    <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header del Item */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex-shrink-0">
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <p className="font-medium text-gray-900">{item.producto_nombre}</p>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                <span>Cantidad: {item.cantidad}</span>
                {loading ? (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generando ruta...
                  </span>
                ) : error ? (
                  <span className="text-red-600">Error al generar ruta</span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    {totalPasos} {totalPasos === 1 ? 'paso' : 'pasos'}
                  </span>
                )}
                {!loading && !error && commentCount > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <MessageSquare className="w-3 h-3" />
                    {commentCount} {commentCount === 1 ? 'comentario' : 'comentarios'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido de Rutas */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Cargando plantilla de ruta...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error al generar ruta</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : totalPasos === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Sin ruta de producción</p>
              <p className="text-sm">Este producto no tiene una ruta asignada o no tiene pasos configurados</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {etapas.map((etapa) => {
              const pasosEtapa = pasosPorEtapa[etapa] || [];
              if (pasosEtapa.length === 0) return null;

              return (
                <div key={etapa} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {etapa}
                    </h4>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  <div className="space-y-2 ml-4">
                    {pasosEtapa.map((paso, pasoIndex) => {
                      const pasoConComentario = stepsWithComments.find((s: any) => s.id === paso.id) || paso;
                      const tieneComentario = pasoConComentario.comentario_vendedor && pasoConComentario.comentario_vendedor.trim().length > 0;

                      return (
                        <div key={paso.id} className="space-y-2">
                          <div
                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                              tieneComentario
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-gray-300 text-gray-600 text-xs font-medium flex-shrink-0 mt-0.5">
                              {pasoIndex + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">
                                  {paso.paso_nombre}
                                </p>
                                {paso.es_obligatorio && (
                                  <Badge variant="primary" className="text-xs">
                                    Obligatorio
                                  </Badge>
                                )}
                                <StepCommentIndicator hasComment={tieneComentario} />
                              </div>
                              {!paso.es_obligatorio && paso.razon_inclusion && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {paso.razon_inclusion}
                                </p>
                              )}
                            </div>
                          </div>

                          {!readOnly && onUpdateStepComment && (
                            <div className="ml-9 mr-3">
                              <StepCommentEditor
                                comentario={pasoConComentario.comentario_vendedor || null}
                                onSave={async (comentario) => {
                                  onUpdateStepComment(index, paso.id, comentario);
                                }}
                                disabled={false}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
