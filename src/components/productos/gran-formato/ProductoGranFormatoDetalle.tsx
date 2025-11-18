import { X, Pencil } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { ProductoGranFormatoConRelaciones } from '../../../types/database';

interface ProductoGranFormatoDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoGranFormatoConRelaciones;
  onEdit: () => void;
  canEdit: boolean;
}

export function ProductoGranFormatoDetalle({
  isOpen,
  onClose,
  producto,
  onEdit,
  canEdit,
}: ProductoGranFormatoDetalleProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Producto" size="lg">
      <div className="p-6 space-y-6">
        {/* Información General */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="font-medium text-gray-900">{producto.nombre}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tipo de Venta</p>
              <Badge variant="secondary">
                {producto.tipo_venta === 'mt2' ? 'Por M²' : 'Por Metro Lineal'}
              </Badge>
            </div>
            {producto.tipo_venta === 'mt_lineal' && producto.anchos_disponibles.length > 0 && (
              <div>
                <p className="text-sm text-gray-500">Ancho Fijo</p>
                <Badge variant="info">
                  {producto.anchos_disponibles[0]} cm
                </Badge>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Impuesto IVA</p>
              <p className="font-medium text-gray-900">{producto.impuesto_iva}%</p>
            </div>
            {producto.cantidad_minima && (
              <div>
                <p className="text-sm text-gray-500">Cantidad Mínima</p>
                <Badge variant="warning">
                  {producto.cantidad_minima} {producto.tipo_venta === 'mt2' ? 'm²' : 'mts lineales'}
                </Badge>
              </div>
            )}
            {producto.rango_precio && (
              <div>
                <p className="text-sm text-gray-500">Rango de Precios</p>
                <p className="font-medium text-gray-900">{producto.rango_precio.nombre}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <Badge variant={producto.is_active ? 'success' : 'secondary'}>
                {producto.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tecnologías y Tintas */}
        {producto.tecnologias.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tecnologías y Tintas</h3>
            <div className="space-y-3">
              {producto.tecnologias.map((tec) => (
                <div key={tec.id} className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">{tec.tecnologia_nombre}</p>
                  <div className="flex gap-2 flex-wrap">
                    {tec.tintas.map((tinta) => (
                      <Badge key={tinta} variant="info">
                        {tinta}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Material */}
        {producto.materiales.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Material</h3>
            {producto.materiales.map((mat) => (
              <div key={mat.id} className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Material</p>
                    <p className="font-medium text-gray-900">{mat.material_nombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Variante</p>
                    <p className="font-medium text-gray-900">{mat.variante_nombre}</p>
                  </div>
                  {mat.espesor && (
                    <div>
                      <p className="text-sm text-gray-500">Espesor</p>
                      <p className="font-medium text-gray-900">
                        {mat.espesor} {mat.unidad_espesor || 'mm'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Servicios */}
        {producto.servicios.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Servicios Disponibles</h3>
            <div className="flex gap-2 flex-wrap">
              {producto.servicios.map((servicio) => (
                <Badge key={servicio.id} variant={servicio.is_active ? 'success' : 'secondary'}>
                  {servicio.servicio_nombre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Acabados */}
        {producto.acabados.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Acabados Disponibles</h3>
            <div className="flex gap-2 flex-wrap">
              {producto.acabados.map((acabado) => (
                <Badge key={acabado.id} variant={acabado.is_active ? 'success' : 'secondary'}>
                  {acabado.acabado_nombre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
          {canEdit && (
            <Button onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
