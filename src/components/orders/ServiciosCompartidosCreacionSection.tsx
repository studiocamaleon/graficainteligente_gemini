import { useState } from 'react';
import { Plus, Trash2, Eye, AlertCircle, DollarSign } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { MetodoProrrateo } from '../../hooks/useServiciosAcabadosCompartidos';
import { calculateSharedServiceProration } from '../../utils/sharedServiceProration';
import type { ItemForProration } from '../../utils/sharedServiceProration';
import { AddServicioCompartidoModal } from './AddServicioCompartidoModal';
import { AddAcabadoCompartidoModal } from './AddAcabadoCompartidoModal';
import { VerProrateoModal } from './VerProrateoModal';

interface ServicioCompartidoTemp {
  id: string;
  servicio_id: string;
  servicio_nombre: string;
  configuracion: Record<string, any>;
  metodo_prorrateo: MetodoProrrateo;
  prorrateos: Record<string, number>;
  precio_total: number;
  notas?: string;
}

interface AcabadoCompartidoTemp {
  id: string;
  acabado_id: string;
  acabado_nombre: string;
  configuracion: Record<string, any>;
  metodo_prorrateo: MetodoProrrateo;
  prorrateos: Record<string, number>;
  precio_total: number;
  notas?: string;
}

interface ServiciosCompartidosCreacionSectionProps {
  items: ItemForProration[];
  serviciosCompartidos: ServicioCompartidoTemp[];
  acabadosCompartidos: AcabadoCompartidoTemp[];
  onServiciosChange: (servicios: ServicioCompartidoTemp[]) => void;
  onAcabadosChange: (acabados: AcabadoCompartidoTemp[]) => void;
}

export function ServiciosCompartidosCreacionSection({
  items,
  serviciosCompartidos,
  acabadosCompartidos,
  onServiciosChange,
  onAcabadosChange
}: ServiciosCompartidosCreacionSectionProps) {
  const [showAddServicio, setShowAddServicio] = useState(false);
  const [showAddAcabado, setShowAddAcabado] = useState(false);
  const [selectedProrateo, setSelectedProrateo] = useState<{
    tipo: 'servicio' | 'acabado';
    nombre: string;
    prorrateos: Record<string, number>;
    costoTotal: number;
  } | null>(null);

  const handleAddServicio = (data: {
    servicio_id: string;
    servicio_nombre: string;
    configuracion?: Record<string, any>;
    metodo_prorrateo?: MetodoProrrateo;
    precio_total: number;
    notas?: string;
  }) => {
    const prorrateos = calculateSharedServiceProration({
      items,
      costoTotal: data.precio_total,
      metodo: data.metodo_prorrateo || 'proporcional'
    });

    const nuevoServicio: ServicioCompartidoTemp = {
      id: `temp-servicio-${Date.now()}`,
      servicio_id: data.servicio_id,
      servicio_nombre: data.servicio_nombre,
      configuracion: data.configuracion || {},
      metodo_prorrateo: data.metodo_prorrateo || 'proporcional',
      prorrateos,
      precio_total: data.precio_total,
      notas: data.notas
    };

    onServiciosChange([...serviciosCompartidos, nuevoServicio]);
    setShowAddServicio(false);
  };

  const handleAddAcabado = (data: {
    acabado_id: string;
    acabado_nombre: string;
    configuracion?: Record<string, any>;
    metodo_prorrateo?: MetodoProrrateo;
    precio_total: number;
    notas?: string;
  }) => {
    const prorrateos = calculateSharedServiceProration({
      items,
      costoTotal: data.precio_total,
      metodo: data.metodo_prorrateo || 'proporcional'
    });

    const nuevoAcabado: AcabadoCompartidoTemp = {
      id: `temp-acabado-${Date.now()}`,
      acabado_id: data.acabado_id,
      acabado_nombre: data.acabado_nombre,
      configuracion: data.configuracion || {},
      metodo_prorrateo: data.metodo_prorrateo || 'proporcional',
      prorrateos,
      precio_total: data.precio_total,
      notas: data.notas
    };

    onAcabadosChange([...acabadosCompartidos, nuevoAcabado]);
    setShowAddAcabado(false);
  };

  const handleDeleteServicio = (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este servicio compartido?')) return;
    onServiciosChange(serviciosCompartidos.filter(s => s.id !== id));
  };

  const handleDeleteAcabado = (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este acabado compartido?')) return;
    onAcabadosChange(acabadosCompartidos.filter(a => a.id !== id));
  };

  const handleViewProrateo = (
    tipo: 'servicio' | 'acabado',
    nombre: string,
    prorrateos: Record<string, number>,
    costoTotal: number
  ) => {
    setSelectedProrateo({ tipo, nombre, prorrateos, costoTotal });
  };

  const getMetodoBadgeColor = (metodo: MetodoProrrateo) => {
    switch (metodo) {
      case 'proporcional':
        return 'bg-blue-100 text-blue-700';
      case 'uniforme':
        return 'bg-green-100 text-green-700';
      case 'manual':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getMetodoLabel = (metodo: MetodoProrrateo) => {
    switch (metodo) {
      case 'proporcional':
        return 'Proporcional';
      case 'uniforme':
        return 'Uniforme';
      case 'manual':
        return 'Manual';
      default:
        return metodo;
    }
  };

  const totalServiciosCompartidos = serviciosCompartidos.reduce(
    (sum, s) => sum + s.precio_total,
    0
  );

  const totalAcabadosCompartidos = acabadosCompartidos.reduce(
    (sum, a) => sum + a.precio_total,
    0
  );

  const totalCompartidos = totalServiciosCompartidos + totalAcabadosCompartidos;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Servicios y Acabados Compartidos
          </h3>
          <p className="text-sm text-gray-600">
            Servicios y acabados que aplican a toda la orden con prorrateo automático
          </p>
        </div>
        {totalCompartidos > 0 && (
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Compartidos</p>
            <p className="text-xl font-bold text-gray-900">
              ${totalCompartidos.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Debes agregar al menos un item antes de poder aplicar servicios o acabados compartidos.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Servicios Compartidos</h4>
            <Button
              size="sm"
              onClick={() => setShowAddServicio(true)}
              disabled={items.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Servicio
            </Button>
          </div>

          {serviciosCompartidos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No hay servicios compartidos
            </p>
          ) : (
            <div className="space-y-3">
              {serviciosCompartidos.map((servicio) => (
                <div
                  key={servicio.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">
                        {servicio.servicio_nombre}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getMetodoBadgeColor(servicio.metodo_prorrateo)}>
                          {getMetodoLabel(servicio.metodo_prorrateo)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleViewProrateo(
                            'servicio',
                            servicio.servicio_nombre,
                            servicio.prorrateos,
                            servicio.precio_total
                          )
                        }
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver prorrateo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteServicio(servicio.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Costo Total</span>
                    <span className="font-semibold text-gray-900">
                      ${servicio.precio_total.toFixed(2)}
                    </span>
                  </div>
                  {servicio.notas && (
                    <p className="text-xs text-gray-600 mt-2">{servicio.notas}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalServiciosCompartidos > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total Servicios</span>
                <span className="text-lg font-bold text-gray-900">
                  ${totalServiciosCompartidos.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Acabados Compartidos</h4>
            <Button
              size="sm"
              onClick={() => setShowAddAcabado(true)}
              disabled={items.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Acabado
            </Button>
          </div>

          {acabadosCompartidos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No hay acabados compartidos
            </p>
          ) : (
            <div className="space-y-3">
              {acabadosCompartidos.map((acabado) => (
                <div
                  key={acabado.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">
                        {acabado.acabado_nombre}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getMetodoBadgeColor(acabado.metodo_prorrateo)}>
                          {getMetodoLabel(acabado.metodo_prorrateo)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleViewProrateo(
                            'acabado',
                            acabado.acabado_nombre,
                            acabado.prorrateos,
                            acabado.precio_total
                          )
                        }
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver prorrateo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAcabado(acabado.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Costo Total</span>
                    <span className="font-semibold text-gray-900">
                      ${acabado.precio_total.toFixed(2)}
                    </span>
                  </div>
                  {acabado.notas && (
                    <p className="text-xs text-gray-600 mt-2">{acabado.notas}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalAcabadosCompartidos > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total Acabados</span>
                <span className="text-lg font-bold text-gray-900">
                  ${totalAcabadosCompartidos.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showAddServicio && (
        <AddServicioCompartidoModal
          tipo="orden"
          id=""
          items={items}
          onClose={() => setShowAddServicio(false)}
          onSuccess={handleAddServicio}
          modoCreacion
        />
      )}

      {showAddAcabado && (
        <AddAcabadoCompartidoModal
          tipo="orden"
          id=""
          items={items}
          onClose={() => setShowAddAcabado(false)}
          onSuccess={handleAddAcabado}
          modoCreacion
        />
      )}

      {selectedProrateo && (
        <VerProrateoModal
          tipo={selectedProrateo.tipo}
          nombre={selectedProrateo.nombre}
          prorrateos={selectedProrateo.prorrateos}
          costoTotal={selectedProrateo.costoTotal}
          items={items}
          onClose={() => setSelectedProrateo(null)}
        />
      )}
    </div>
  );
}

export type { ServicioCompartidoTemp, AcabadoCompartidoTemp };
