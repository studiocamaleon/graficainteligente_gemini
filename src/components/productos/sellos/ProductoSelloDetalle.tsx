import { Card } from '../../ui/card';
import { Badge } from '../../ui/Badge';
import type { ProductoSelloConRelaciones } from '../../../types/database';

interface ProductoSelloDetalleProps {
  producto: ProductoSelloConRelaciones;
}

const getTipoProductoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    sello: 'Sello',
    repuesto: 'Repuesto',
    polimero: 'Polímero',
    tinta: 'Tinta',
    accesorios: 'Accesorios',
  };
  return labels[tipo] || tipo;
};

const getTipoSelloLabel = (tipo: string | null): string => {
  if (!tipo) return '-';
  const labels: Record<string, string> = {
    manual: 'Manual',
    automatico: 'Automático',
  };
  return labels[tipo] || tipo;
};

const getTipoTintaLabel = (tipo: string | null): string => {
  if (!tipo) return '-';
  const labels: Record<string, string> = {
    textil: 'Textil',
    papel: 'Papel',
  };
  return labels[tipo] || tipo;
};

export function ProductoSelloDetalle({ producto }: ProductoSelloDetalleProps) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Nombre</dt>
              <dd className="mt-1 text-sm text-gray-900">{producto.nombre}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Tipo de Producto</dt>
              <dd className="mt-1">
                <Badge variant="default" className="bg-violet-600 text-white">
                  {getTipoProductoLabel(producto.tipo_producto)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Estado</dt>
              <dd className="mt-1">
                <Badge variant={producto.is_active ? 'success' : 'default'}>
                  {producto.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Impuesto IVA</dt>
              <dd className="mt-1 text-sm text-gray-900">{producto.impuesto_iva}%</dd>
            </div>
          </dl>
        </div>
      </Card>

      {producto.tipo_producto === 'sello' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Características del Sello
            </h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Tipo de Sello</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {getTipoSelloLabel(producto.tipo_sello)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Marca</dt>
                <dd className="mt-1 text-sm text-gray-900">{producto.marca || '-'}</dd>
              </div>
            </dl>
          </div>
        </Card>
      )}

      {(producto.medida_ancho || producto.medida_alto) && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medidas</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Ancho</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {producto.medida_ancho ? `${producto.medida_ancho} mm` : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Alto</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {producto.medida_alto ? `${producto.medida_alto} mm` : '-'}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      )}

      {producto.tipo_producto === 'tinta' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Tinta</h3>
            <p className="text-sm text-gray-900">
              {getTipoTintaLabel(producto.tipo_tinta)}
            </p>
          </div>
        </Card>
      )}

      {producto.ruta_produccion && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ruta de Producción</h3>
            <p className="text-sm text-gray-900">{producto.ruta_produccion.nombre}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
