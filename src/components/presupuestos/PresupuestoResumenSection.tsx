import { Package, FileText, Calendar, User } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { PresupuestoItem } from '../../types/presupuestos';

interface PresupuestoResumenSectionProps {
  items: PresupuestoItem[];
  clienteNombre: string;
  fechaValidez: string;
  condicionesText: string;
}

export function PresupuestoResumenSection({
  items,
  clienteNombre,
  fechaValidez,
  condicionesText,
}: PresupuestoResumenSectionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const calcularTotales = () => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.precio_total), 0);
    return {
      subtotal,
      descuentos: 0,
      total: subtotal,
    };
  };

  const totales = calcularTotales();

  // Helper to render config details
  const renderConfiguracion = (config: any, tipoItem?: string) => {
    if (!config) return null;

    // Lógica específica para Centro de Copiado
    if (tipoItem === 'centro_copiado') {
      return (
        <div className="space-y-1 text-xs text-gray-600 mt-1">
          {/* Info Copias/Hojas */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{config.cantidad_copias} juegos</span>
            <span className="text-gray-300">|</span>
            <span>{config.cantidad_hojas} hojas orig.</span>
          </div>

          {/* Info Papel/Tinta */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {config.tamanio_nombre && <Badge variant="outline" className="text-[10px] h-5">{config.tamanio_nombre}</Badge>}
            {config.papel_detalle && <Badge variant="outline" className="text-[10px] h-5">{config.papel_detalle}</Badge>}
            <Badge variant={config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'purple' : 'gray'} className="text-[10px] h-5">
              {config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'Color' : 'B/N'}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              {config.cara_impresa === 'frente_y_dorso' || config.cara_impresa === 'doble' || config.cara_impresa === '1/1' ? 'Doble Faz' : 'Simple Faz'}
            </Badge>
          </div>

          {/* Terminaciones (Anillado, Plastificado, Guillotinado) */}
          {(config.anillado || config.plastificado || config.guillotinado || config.abrochado || config.corte || config.dobladillo) && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {config.anillado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Anillado {config.anillado.tipo}</Badge>
              )}
              {config.plastificado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Plastificado {config.plastificado.tipo}</Badge>
              )}
              {config.guillotinado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Guillotinado</Badge>
              )}
              {config.abrochado && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Abrochado</Badge>
              )}
              {config.corte && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Corte</Badge>
              )}
              {config.dobladillo && (
                <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Dobladillo</Badge>
              )}
            </div>
          )}

          {/* Servicios y Acabados Extra */}
          {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
            (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100">
                {config.servicios_seleccionados?.map((s: any, idx: number) => (
                  <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                    {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                  </Badge>
                ))}
                {config.acabados_seleccionados?.map((a: any, idx: number) => (
                  <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                    {a.nombre}
                  </Badge>
                ))}
              </div>
            )}
        </div>
      );
    }

    // Standard Render Logic (Existing)
    const hasServices = (config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
      (config.acabados_seleccionados && config.acabados_seleccionados.length > 0);

    if (!hasServices) return null;

    return (
      <div className="space-y-1 mt-0.5">
        {/* Services Badges */}
        <div className="flex flex-wrap gap-1 mt-1">
          {config.servicios_seleccionados?.map((s: any, idx: number) => (
            <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
              {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
            </Badge>
          ))}
          {config.acabados_seleccionados?.map((a: any, idx: number) => (
            <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
              {a.nombre}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Document Container */}
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 shadow-lg rounded-xl overflow-hidden">

        {/* Document Header Bar */}
        <div className="bg-gray-50 border-b border-gray-200 p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Resumen del Presupuesto</h2>
            <p className="text-sm text-gray-500 mt-1">Revisa los detalles antes de finalizar</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">Total Estimado</div>
            <div className="text-3xl font-bold text-blue-600 tracking-tight">
              {formatCurrency(totales.total)}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Header Grid: Cliente & Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-8 border-b border-gray-100">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{clienteNombre || 'Sin cliente seleccionado'}</p>
                  <p className="text-sm text-gray-500">Cliente Registrado</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vigencia</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{formatDate(fechaValidez)}</p>
                  <p className="text-sm text-gray-500">Fecha de Vencimiento</p>
                </div>
              </div>
            </div>
          </div>


          {/* Items Table Look */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
              <Package className="w-5 h-5 text-gray-400" />
              <h3>Items ({items.length})</h3>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Descripción</th>
                    <th className="px-4 py-3 text-right font-semibold">Cant.</th>
                    <th className="px-4 py-3 text-right font-semibold">Unitario</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.producto_nombre}</p>
                        {renderConfiguracion(item.configuracion, item.tipo_item)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.precio_unitario_final || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.precio_total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Grid: Condiciones & Totales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {/* Condiciones */}
            <div className="order-2 md:order-1">
              {condicionesText ? (
                <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 h-full">
                  <div className="flex items-center gap-2 mb-2 text-blue-800 font-medium">
                    <FileText className="w-4 h-4" />
                    <h4>Condiciones Comerciales</h4>
                  </div>
                  <p className="text-xs text-blue-900/70 whitespace-pre-wrap font-mono leading-relaxed">
                    {condicionesText}
                  </p>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm italic">
                  Sin condiciones especiales
                </div>
              )}
            </div>

            {/* Total Breakdown */}
            <div className="order-1 md:order-2 flex flex-col justify-end space-y-3">
              <div className="flex justify-between text-gray-600 text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(totales.subtotal)}</span>
              </div>
              {totales.descuentos > 0 && (
                <div className="flex justify-between text-red-600 text-sm">
                  <span>Descuentos</span>
                  <span>-{formatCurrency(totales.descuentos)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 flex justify-between items-end">
                <span className="font-bold text-xl text-gray-900">Total Final</span>
                <div className="text-right">
                  <span className="font-bold text-3xl text-gray-900 block">{formatCurrency(totales.total)}</span>
                  <span className="text-sm text-gray-600 font-medium block mt-1">
                    {formatCurrency(totales.total * 1.21)} <span className="text-xs text-gray-500">(c/IVA)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
