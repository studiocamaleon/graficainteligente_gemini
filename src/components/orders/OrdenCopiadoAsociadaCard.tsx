import { useState } from 'react';
import { Link, FileText, Package, DollarSign, Unlink, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { CentroCopiadoOrdenResumida, EstadoOrdenCopiado } from '../../types/database';
import { DesvincularOrdenCopiadoModal } from './DesvincularOrdenCopiadoModal';

interface OrdenCopiadoAsociadaCardProps {
  ordenCopiado: CentroCopiadoOrdenResumida;
  numeroOrdenTrabajo: string;
  onDesvincular: () => Promise<void>;
  canDesvincular?: boolean;
}

const getEstadoBadge = (estado: EstadoOrdenCopiado) => {
  const estilos = {
    pendiente: { variant: 'warning' as const, label: 'Pendiente' },
    en_proceso: { variant: 'primary' as const, label: 'En Proceso' },
    finalizada: { variant: 'success' as const, label: 'Finalizada' },
    entregada: { variant: 'secondary' as const, label: 'Entregada' },
    cancelada: { variant: 'danger' as const, label: 'Cancelada' },
  };

  const estilo = estilos[estado] || { variant: 'secondary' as const, label: estado };
  return <Badge variant={estilo.variant}>{estilo.label}</Badge>;
};

const getTipoItemLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    impresion: 'Impresión',
    anillado: 'Anillado',
    plastificado: 'Plastificado',
  };
  return labels[tipo] || tipo;
};

export function OrdenCopiadoAsociadaCard({
  ordenCopiado,
  numeroOrdenTrabajo,
  onDesvincular,
  canDesvincular = false,
}: OrdenCopiadoAsociadaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDesvincularModal, setShowDesvincularModal] = useState(false);

  const handleDesvincular = async () => {
    await onDesvincular();
    setShowDesvincularModal(false);
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Orden de Copiado Asociada
                </h3>
                <p className="text-sm text-gray-600">
                  Los pagos se gestionan desde esta orden principal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getEstadoBadge(ordenCopiado.estado)}
            </div>
          </div>

          {/* Info Principal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white/80 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-600">Número de Orden</span>
              </div>
              <p className="text-lg font-bold text-blue-600">
                {ordenCopiado.numero_orden}
              </p>
            </div>

            <div className="bg-white/80 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-600">Items</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {ordenCopiado.items?.length || 0}
              </p>
            </div>

            <div className="bg-white/80 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-gray-600">Total</span>
              </div>

              {ordenCopiado.requiere_factura ? (
                <div className="flex flex-col items-end">
                  {(() => {
                    const itemsTotal = ordenCopiado.items?.reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0) || 0;
                    return (
                      <>
                        <span className="text-xs text-gray-500">Subtotal: ${itemsTotal.toFixed(2)}</span>
                        <span className="text-xs text-gray-500">IVA (21%): ${(itemsTotal * 0.21).toFixed(2)}</span>
                        <p className="text-lg font-bold text-green-600 mt-1">
                          ${Number(ordenCopiado.total).toFixed(2)}
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-lg font-bold text-green-600">
                  ${Number(ordenCopiado.total).toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Items colapsables */}
          {ordenCopiado.items && ordenCopiado.items.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full text-left px-4 py-3 bg-white/80 rounded-lg hover:bg-white transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">
                  Ver detalles de items ({ordenCopiado.items.length})
                </span>
                {expanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {expanded && (
                <div className="mt-2 space-y-2">
                  {ordenCopiado.items.map((item: any, index: number) => (
                    <div
                      key={item.id}
                      className="bg-white/80 rounded-lg p-3 border border-blue-100"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            <span className="text-sm font-medium text-gray-900">
                              {getTipoItemLabel(item.tipo_item)}
                            </span>
                          </div>
                          {item.tipo_item === 'impresion' && (
                            <p className="text-xs text-gray-600">
                              {item.tamanio_papel?.nombre || 'N/A'}
                              {' - '}
                              {item.papel?.material?.nombre || item.papel?.variante_nombre || 'N/A'}
                              {item.papel?.variante_nombre && item.papel?.material?.nombre && ` ${item.papel.variante_nombre}`}
                              {' • '}
                              {item.cantidad_hojas} hojas × {item.cantidad_unidades} copias
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          ${Number(item.subtotal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <Link to={`/app/centro-copiado/ordenes/${ordenCopiado.id}`}>
              <Button variant="primary" size="sm">
                <ExternalLink className="w-4 h-4" />
                Ver Detalle Completo
              </Button>
            </Link>

            {canDesvincular && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDesvincularModal(true)}
              >
                <Unlink className="w-4 h-4" />
                Desvincular
              </Button>
            )}
          </div>
        </div>
      </Card>

      {showDesvincularModal && (
        <DesvincularOrdenCopiadoModal
          isOpen={showDesvincularModal}
          onClose={() => setShowDesvincularModal(false)}
          onConfirm={handleDesvincular}
          ordenCopiado={ordenCopiado}
          numeroOrdenTrabajo={numeroOrdenTrabajo}
        />
      )}
    </>
  );
}
