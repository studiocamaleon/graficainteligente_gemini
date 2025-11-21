import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Edit2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ProductoTalonarioConRelaciones } from '../../../hooks/useProductosImpresionTalonario';

interface ProductoTalonarioDetalleProps {
  isOpen: boolean;
  onClose: () => void;
  producto: ProductoTalonarioConRelaciones;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function ProductoTalonarioDetalle({
  isOpen,
  onClose,
  producto,
  onEdit,
  canEdit = true,
}: ProductoTalonarioDetalleProps) {
  const [tintasInfo, setTintasInfo] = useState<Record<string, { codigo: string; nombre: string }>>({});
  const [loadingTintas, setLoadingTintas] = useState(false);

  useEffect(() => {
    if (producto.tecnologias.length > 0 && producto.tecnologias[0].tintas && producto.tecnologias[0].tintas.length > 0) {
      loadTintasInfo();
    }
  }, [producto.tecnologias]);

  const loadTintasInfo = async () => {
    try {
      setLoadingTintas(true);
      const tintaIds = producto.tecnologias[0].tintas;

      const { data, error } = await supabase
        .from('tintas')
        .select('id, codigo, nombre')
        .in('id', tintaIds);

      if (error) throw error;

      const tintasMap: Record<string, { codigo: string; nombre: string }> = {};
      if (data) {
        data.forEach(tinta => {
          tintasMap[tinta.id] = { codigo: tinta.codigo, nombre: tinta.nombre };
        });
      }
      setTintasInfo(tintasMap);
    } catch (error) {
      console.error('Error loading tintas info:', error);
    } finally {
      setLoadingTintas(false);
    }
  };

  const tipoVentaLabels = {
    unidades: 'Por Unidades',
    medidas: 'Por Medidas (m² o metro lineal)',
    cantidades_fijas: 'Por Cantidades Fijas',
  };

  const carasLabels: Record<string, string> = {
    solo_frente: 'Solo Frente',
    frente_y_dorso: 'Frente y Dorso',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle del Producto"
      size="lg"
    >
      <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">{producto.nombre}</h3>
            <div className="flex gap-2 mt-2">
              <Badge variant={producto.is_active ? 'success' : 'secondary'}>
                {producto.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
          {canEdit && onEdit && (
            <Button onClick={onEdit} size="sm">
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Tipo de Venta</h4>
            <p className="text-base text-gray-900">{tipoVentaLabels[producto.tipo_venta]}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Impuesto IVA</h4>
            <p className="text-base text-gray-900">{producto.impuesto_iva}%</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-3">Medidas Disponibles</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                  <th className="pb-2">Ancho (mm)</th>
                  <th className="pb-2">Alto (mm)</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-900">
                {producto.medidas_disponibles.map((medida, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0">
                    <td className="py-2">{medida.ancho}</td>
                    <td className="py-2">{medida.alto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-3">Tecnología y Tintas</h4>
          {producto.tecnologias.length > 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Tecnología</p>
                <Badge variant="primary">{producto.tecnologias[0].tecnologia_nombre}</Badge>
              </div>
              {producto.tecnologias[0].tintas && producto.tecnologias[0].tintas.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Tintas Seleccionadas</p>
                  {loadingTintas ? (
                    <p className="text-xs text-gray-400">Cargando...</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {producto.tecnologias[0].tintas.map((tintaId, index) => {
                        const tintaInfo = tintasInfo[tintaId];
                        return (
                          <Badge key={index} variant="secondary">
                            {tintaInfo ? `${tintaInfo.nombre} (${tintaInfo.codigo})` : tintaId.substring(0, 8) + '...'}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 italic">Sin tintas seleccionadas</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 italic">No hay tecnología asignada</p>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Tipos de Copia</h4>
          <div className="flex flex-wrap gap-2">
            {producto.tipo_copia.map((cara) => (
              <Badge key={cara} variant="secondary">
                {carasLabels[cara] || cara}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Material</h4>
          {producto.materiales.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <p className="text-sm font-medium text-gray-900">
                {producto.materiales[0].material_nombre}
              </p>
              <p className="text-sm text-gray-600">
                Variante: {producto.materiales[0].variante_nombre}
              </p>
              {producto.materiales[0].espesor && producto.materiales[0].unidad_espesor && (
                <p className="text-sm text-gray-600">
                  Espesor: {producto.materiales[0].espesor} {producto.materiales[0].unidad_espesor}
                </p>
              )}
            </div>
          )}
        </div>

        {producto.tipo_venta === 'cantidades_fijas' && producto.cantidades_fijas.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Cantidades Disponibles</h4>
            <div className="flex flex-wrap gap-2">
              {producto.cantidades_fijas.map((cantidad) => (
                <Badge key={cantidad} variant="secondary">
                  {cantidad}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {producto.servicios.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Servicios Disponibles</h4>
            <div className="grid grid-cols-2 gap-2">
              {producto.servicios.map((servicio) => (
                <div key={servicio.id} className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {servicio.servicio_nombre}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {producto.acabados.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Acabados Disponibles</h4>
            <div className="grid grid-cols-2 gap-2">
              {producto.acabados.map((acabado) => (
                <div key={acabado.id} className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium text-gray-900">
                    {acabado.acabado_nombre}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Creado:</span>{' '}
              {new Date(producto.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <div>
              <span className="font-medium">Actualizado:</span>{' '}
              {new Date(producto.updated_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
