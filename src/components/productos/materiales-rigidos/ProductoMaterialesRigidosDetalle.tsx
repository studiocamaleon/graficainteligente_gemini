import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Pencil, Package, Ruler, Layers, Wrench, Sparkles, DollarSign, FileText } from 'lucide-react';
import type { ProductoMaterialesRigidosConRelaciones } from '../../../hooks/useProductosMaterialesRigidos';

interface ProductoMaterialesRigidosDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoMaterialesRigidosConRelaciones;
  onEdit: () => void;
  canEdit?: boolean;
}

export function ProductoMaterialesRigidosDetalle({
  isOpen,
  onClose,
  producto,
  onEdit,
  canEdit = true,
}: ProductoMaterialesRigidosDetalleProps) {
  // Agrupar combinaciones por variante
  const combinacionesPorVariante = new Map<string, number[]>();

  producto.materiales?.forEach((mat) => {
    if (!combinacionesPorVariante.has(mat.variante_nombre)) {
      combinacionesPorVariante.set(mat.variante_nombre, []);
    }
    combinacionesPorVariante.get(mat.variante_nombre)!.push(mat.espesor);
  });

  // Ordenar espesores dentro de cada variante
  combinacionesPorVariante.forEach((espesores) => {
    espesores.sort((a, b) => a - b);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle del Producto"
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{producto.nombre}</h3>
                <Badge variant={producto.is_active ? 'success' : 'secondary'}>
                  {producto.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </div>
          {canEdit && (
            <Button onClick={onEdit} size="sm">
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="w-4 h-4 text-gray-600" />
                <h4 className="text-sm font-medium text-gray-700">Dimensión de Materia Prima</h4>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {producto.medidas_ancho} x {producto.medidas_alto} cm
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ancho x Alto
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-600" />
                <h4 className="text-sm font-medium text-gray-700">Tipo de Venta</h4>
              </div>
              <Badge variant="secondary">Por Metro Cuadrado (m²)</Badge>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-gray-600" />
                <h4 className="text-sm font-medium text-gray-700">Impuesto IVA</h4>
              </div>
              <p className="text-lg font-semibold text-gray-900">{producto.impuesto_iva}%</p>
            </div>

            {producto.cantidad_minima && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-700">Cantidad Mínima</h4>
                </div>
                <Badge variant="warning">{producto.cantidad_minima} m²</Badge>
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo a facturar aunque se solicite menos
                </p>
              </div>
            )}

            {producto.rango_precio && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-700">Rango de Precio</h4>
                </div>
                <Badge variant="primary">{producto.rango_precio.nombre}</Badge>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {combinacionesPorVariante.size > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-700">
                    Variantes y Espesores
                  </h4>
                </div>
                <div className="space-y-3">
                  {Array.from(combinacionesPorVariante.entries()).map(([variante, espesores]) => (
                    <div key={variante} className="border-l-4 border-blue-400 pl-3">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {variante}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {espesores.map((espesor) => (
                          <Badge key={espesor} variant="secondary" className="text-xs">
                            {espesor} mm
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {espesores.length} {espesores.length === 1 ? 'espesor' : 'espesores'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    Total: {producto.materiales?.length || 0} combinaciones de variante-espesor
                  </p>
                </div>
              </div>
            )}

            {producto.servicios && producto.servicios.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-700">Servicios</h4>
                </div>
                <p className="text-sm text-gray-600">
                  {producto.servicios.length} {producto.servicios.length === 1 ? 'servicio' : 'servicios'} configurados
                </p>
              </div>
            )}

            {producto.acabados && producto.acabados.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-700">Acabados</h4>
                </div>
                <p className="text-sm text-gray-600">
                  {producto.acabados.length} {producto.acabados.length === 1 ? 'acabado' : 'acabados'} configurados
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
