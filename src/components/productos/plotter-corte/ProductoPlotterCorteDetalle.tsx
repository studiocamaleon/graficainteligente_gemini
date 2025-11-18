import { X, Edit, Package, Ruler, Palette, Tag, Percent, DollarSign, GitBranch, Wrench, Sparkles } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import type { ProductoPlotterCorteConRelaciones } from '../../../types/database';

interface ProductoPlotterCorteDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoPlotterCorteConRelaciones;
  onEdit: () => void;
  canEdit: boolean;
}

export function ProductoPlotterCorteDetalle({
  isOpen,
  onClose,
  producto,
  onEdit,
  canEdit,
}: ProductoPlotterCorteDetalleProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Producto" maxWidth="3xl">
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 p-6">
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{producto.nombre}</h2>
                  <Badge variant={producto.is_active ? 'success' : 'secondary'}>
                    {producto.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
              {canEdit && (
                <Button onClick={onEdit} size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Ruler className="w-5 h-5" />
              Unidad de Venta
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-semibold">Metro Lineal</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Anchos Disponibles</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {producto.anchos_disponibles.map((ancho) => (
                <div
                  key={ancho}
                  className="border border-pink-600 bg-pink-50 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl font-bold text-pink-900">{ancho}</div>
                  <div className="text-sm text-pink-700">cm</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {producto.cantidad_minima && (
          <Card>
            <div className="p-6 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Ruler className="w-5 h-5" />
                Cantidad Mínima a Cobrar
              </h3>
              <p className="text-gray-700">
                {producto.cantidad_minima} metros lineales
              </p>
            </div>
          </Card>
        )}

        <Card>
          <div className="p-6 space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Color
            </h3>
            <p className="text-gray-700">{producto.color}</p>
          </div>
        </Card>

        {producto.marca && (
          <Card>
            <div className="p-6 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Marca
              </h3>
              <p className="text-gray-700">{producto.marca}</p>
            </div>
          </Card>
        )}

        {producto.servicios.length > 0 && (
          <Card>
            <div className="p-6 space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Servicios Disponibles
              </h3>
              <div className="flex flex-wrap gap-2">
                {producto.servicios.map((servicio) => (
                  <Badge key={servicio.id} variant="info">
                    {servicio.servicio_nombre}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        )}

        {producto.acabados.length > 0 && (
          <Card>
            <div className="p-6 space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Acabados Disponibles
              </h3>
              <div className="flex flex-wrap gap-2">
                {producto.acabados.map((acabado) => (
                  <Badge key={acabado.id} variant="warning">
                    {acabado.acabado_nombre}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        )}

        {producto.rango_precio && (
          <Card>
            <div className="p-6 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Percent className="w-5 h-5" />
                Rango de Precios
              </h3>
              <p className="text-gray-700">{producto.rango_precio.nombre}</p>
            </div>
          </Card>
        )}

        <Card>
          <div className="p-6 space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Impuesto IVA
            </h3>
            <p className="text-gray-700">{producto.impuesto_iva}%</p>
          </div>
        </Card>

        {producto.ruta_produccion_id && (
          <Card>
            <div className="p-6 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Ruta de Producción
              </h3>
              <p className="text-sm text-gray-500">
                Este producto tiene una ruta de producción asignada
              </p>
            </div>
          </Card>
        )}
      </div>

      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {canEdit && (
            <Button onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Editar Producto
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
