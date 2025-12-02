import { DollarSign, Package, FileText, Calendar, User } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Resumen Final
        </h2>
        <p className="text-sm text-gray-600">
          Verifica todos los datos antes de guardar
        </p>
      </div>

      {/* Datos principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cliente</p>
              <p className="font-semibold text-gray-900">{clienteNombre || '-'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Válido hasta</p>
              <p className="font-semibold text-gray-900">{formatDate(fechaValidez)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Items ({items.length})</h3>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.producto_nombre}</p>
                <p className="text-xs text-gray-500">
                  {item.cantidad} x {formatCurrency(item.precio_unitario_final)}
                </p>
              </div>
              <p className="font-semibold text-gray-900">
                {formatCurrency(item.precio_total)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-gray-700">
            <span>Subtotal</span>
            <span className="font-semibold">{formatCurrency(totales.subtotal)}</span>
          </div>
          {totales.descuentos > 0 && (
            <div className="flex items-center justify-between text-gray-700">
              <span>Descuentos</span>
              <span className="font-semibold text-red-600">
                -{formatCurrency(totales.descuentos)}
              </span>
            </div>
          )}
          <div className="pt-3 border-t-2 border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-3xl font-bold text-blue-600">
                {formatCurrency(totales.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Condiciones */}
      {condicionesText && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Condiciones Comerciales</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
              {condicionesText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
