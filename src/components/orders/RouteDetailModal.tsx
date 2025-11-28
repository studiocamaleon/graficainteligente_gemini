import { Modal } from '../ui/Modal';
import { PasoStatusBadge } from '../production/PasoStatusBadge';
import { formatDate } from '../../utils/stringUtils';
import type { OrdenItemRuta } from '../../types/database';
import { Clock, CheckCircle2, User, FileText } from 'lucide-react';

interface RouteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  rutas: OrdenItemRuta[];
  productoNombre: string;
}

const etapaLabels: Record<string, string> = {
  pre_prensa: 'Pre-Prensa',
  principal: 'Producción',
  post_prensa: 'Post-Prensa',
  instalacion: 'Instalación',
};

const etapaColors: Record<string, string> = {
  pre_prensa: 'bg-purple-50 border-purple-200',
  principal: 'bg-blue-50 border-blue-200',
  post_prensa: 'bg-green-50 border-green-200',
  instalacion: 'bg-orange-50 border-orange-200',
};

export function RouteDetailModal({
  isOpen,
  onClose,
  rutas,
  productoNombre,
}: RouteDetailModalProps) {
  const rutasPorEtapa = rutas.reduce((acc, ruta) => {
    if (!acc[ruta.tipo_etapa]) {
      acc[ruta.tipo_etapa] = [];
    }
    acc[ruta.tipo_etapa].push(ruta);
    return acc;
  }, {} as Record<string, OrdenItemRuta[]>);

  const ordenEtapas = ['pre_prensa', 'principal', 'post_prensa', 'instalacion'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ruta de Producción: ${productoNombre}`} size="2xl">
      <div className="space-y-6">
        {ordenEtapas.map((etapa) => {
          const rutasEtapa = rutasPorEtapa[etapa];
          if (!rutasEtapa || rutasEtapa.length === 0) return null;

          return (
            <div key={etapa} className={`border rounded-lg ${etapaColors[etapa]}`}>
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-900">{etapaLabels[etapa]}</h3>
              </div>
              <div className="p-4 space-y-3">
                {rutasEtapa.map((ruta) => (
                  <div
                    key={ruta.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{ruta.paso_nombre}</h4>
                        {ruta.comentario_vendedor && (
                          <p className="text-sm text-gray-600 mt-1 flex items-start gap-2">
                            <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span>{ruta.comentario_vendedor}</span>
                          </p>
                        )}
                      </div>
                      <PasoStatusBadge estado={ruta.estado_paso} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {ruta.fecha_inicio && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="text-xs text-gray-500">Iniciado</p>
                            <p className="font-medium">{formatDate(ruta.fecha_inicio)}</p>
                          </div>
                        </div>
                      )}

                      {ruta.fecha_fin && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <div>
                            <p className="text-xs text-gray-500">Finalizado</p>
                            <p className="font-medium">{formatDate(ruta.fecha_fin)}</p>
                          </div>
                        </div>
                      )}

                      {ruta.responsable_id && (
                        <div className="flex items-center gap-2 text-gray-600 col-span-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Responsable</p>
                            <p className="font-medium">ID: {ruta.responsable_id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {ruta.notas && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Notas</p>
                        <p className="text-sm text-gray-700">{ruta.notas}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {rutas.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No hay pasos de producción definidos para este item.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
