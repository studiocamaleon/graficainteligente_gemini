import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { InkBadge } from '../../ui/InkBadge';
import { Pencil } from 'lucide-react';
import type { ProductoPortabannerConRelaciones } from '../../../types/database';

interface ProductoPortabannerDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoPortabannerConRelaciones;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function ProductoPortabannerDetalle({
  isOpen,
  onClose,
  producto,
  onEdit,
  canEdit = false,
}: ProductoPortabannerDetalleProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle del Producto"
      size="lg"
      actions={
        canEdit && onEdit ? (
          <Button onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Nombre</h3>
            <p className="text-base font-semibold text-gray-900">{producto.nombre}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Estado</h3>
            <Badge variant={producto.is_active ? 'success' : 'secondary'}>
              {producto.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Medidas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Ancho</p>
              <p className="text-xl font-bold text-gray-900">{producto.ancho_cm} cm</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Alto</p>
              <p className="text-xl font-bold text-gray-900">{producto.alto_cm} cm</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tecnología de Impresión</h3>
          {producto.tecnologia && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tecnología</p>
                <Badge variant="secondary">{producto.tecnologia.nombre}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Tintas disponibles</p>
                <div className="flex flex-wrap gap-2">
                  {producto.tintas.map((tinta) => (
                    <InkBadge key={tinta} tinta={tinta} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {producto.servicios.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Servicios Adicionales</h3>
            <div className="flex flex-wrap gap-2">
              {producto.servicios.map((servicio) => (
                <Badge key={servicio.id} variant="info">
                  {servicio.servicio_nombre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {producto.acabados.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Acabados</h3>
            <div className="flex flex-wrap gap-2">
              {producto.acabados.map((acabado) => (
                <Badge key={acabado.id} variant="secondary">
                  {acabado.acabado_nombre}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Adicional</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">IVA</p>
              <p className="text-base font-medium text-gray-900">{producto.impuesto_iva}%</p>
            </div>
            {producto.rango_precio && (
              <div>
                <p className="text-sm text-gray-600">Rango de Precio</p>
                <p className="text-base font-medium text-gray-900">{producto.rango_precio.nombre}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
