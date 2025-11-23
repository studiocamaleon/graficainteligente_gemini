import { Plus, DollarSign, AlertCircle, Edit2, Trash2, TrendingDown, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { useMediosCobro } from '../../hooks/useMediosCobro';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

interface Totales {
  subtotal: number;
  descuentoAplicado: number;
  subtotalConDescuento: number;
  iva: number;
  total: number;
}

interface Pago {
  id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id?: string;
  metodo_pago?: string;
  referencia_pago?: string;
  notas?: string;
  comision_aplicada?: number;
  fecha_liberacion_estimada?: string;
}

interface OrdenPagosTabProps {
  totales: Totales;
  pagos: Pago[];
  onAgregarPago: () => void;
  onEditarPago?: (pago: Pago) => void;
  onEliminarPago?: (id: string) => void;
  readOnly?: boolean;
}

export function OrdenPagosTab({
  totales,
  pagos,
  onAgregarPago,
  onEditarPago,
  onEliminarPago,
  readOnly = false,
}: OrdenPagosTabProps) {
  const { mediosCobro } = useMediosCobro();
  const { showConfirm } = useConfirmDialog();

  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const saldoPendiente = totales.total - totalPagado;

  const getMedioCobro = (medioId?: string) => {
    if (!medioId) return null;
    return mediosCobro.find(m => m.id === medioId);
  };

  const handleEliminar = async (id: string) => {
    if (!onEliminarPago) return;

    const confirmed = await showConfirm({
      title: 'Eliminar Pago',
      message: '¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });

    if (confirmed) {
      onEliminarPago(id);
    }
  };

  const calcularDiasRestantes = (fechaLiberacion: string) => {
    const hoy = new Date();
    const fecha = new Date(fechaLiberacion);
    const diff = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-700 mb-1">Total de la Orden</div>
          <div className="text-2xl font-bold text-blue-900">
            ${totales.total.toFixed(2)}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700 mb-1">Total Pagado</div>
          <div className="text-2xl font-bold text-green-900">
            ${totalPagado.toFixed(2)}
          </div>
          {pagos.length > 0 && (
            <div className="text-xs text-green-600 mt-1">
              {pagos.length} pago{pagos.length > 1 ? 's' : ''} registrado{pagos.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className={`
          border rounded-lg p-4
          ${saldoPendiente > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}
        `}>
          <div className={`text-sm mb-1 ${saldoPendiente > 0 ? 'text-amber-700' : 'text-gray-700'}`}>
            Saldo Pendiente
          </div>
          <div className={`text-2xl font-bold ${saldoPendiente > 0 ? 'text-amber-900' : 'text-gray-900'}`}>
            ${saldoPendiente.toFixed(2)}
          </div>
          {saldoPendiente <= 0 && pagos.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <CheckCircle className="w-3 h-3" />
              Orden pagada
            </div>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="flex items-center space-x-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-sm text-amber-800">
            Los pagos se podrán registrar una vez que la orden esté creada.
          </p>
        </div>
      )}

      {!readOnly && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pagos Registrados</h3>
            <Button onClick={onAgregarPago} disabled={saldoPendiente <= 0}>
              <Plus className="w-4 h-4" />
              Registrar Pago
            </Button>
          </div>

          {pagos.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No hay pagos registrados"
              description="Registra los pagos recibidos para esta orden"
              action={
                <Button onClick={onAgregarPago}>
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Primer Pago
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {pagos.map(pago => {
                const medio = getMedioCobro(pago.medio_cobro_id);
                const diasRestantes = pago.fecha_liberacion_estimada
                  ? calcularDiasRestantes(pago.fecha_liberacion_estimada)
                  : null;

                return (
                  <div
                    key={pago.id}
                    className="flex items-start justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-3 mb-2">
                        <span className="font-bold text-xl text-gray-900">
                          ${pago.monto.toFixed(2)}
                        </span>
                        {medio ? (
                          <Badge variant="primary">{medio.nombre}</Badge>
                        ) : pago.metodo_pago ? (
                          <Badge variant="secondary">{pago.metodo_pago}</Badge>
                        ) : null}
                        <span className="text-sm text-gray-500">
                          {new Date(pago.fecha_pago).toLocaleDateString('es-AR')}
                        </span>
                      </div>

                      {pago.referencia_pago && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Ref:</span> {pago.referencia_pago}
                        </div>
                      )}

                      {pago.notas && (
                        <div className="text-sm text-gray-600 mb-2">
                          {pago.notas}
                        </div>
                      )}

                      {/* Información adicional de medios de cobro */}
                      {medio && (
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {pago.comision_aplicada && pago.comision_aplicada > 0 && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                              <TrendingDown className="w-3 h-3" />
                              Comisión: ${pago.comision_aplicada.toFixed(2)}
                            </div>
                          )}
                          {pago.fecha_liberacion_estimada && diasRestantes !== null && (
                            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                              diasRestantes <= 0
                                ? 'text-green-600 bg-green-50'
                                : 'text-purple-600 bg-purple-50'
                            }`}>
                              <Calendar className="w-3 h-3" />
                              {diasRestantes <= 0 ? (
                                'Liberado'
                              ) : (
                                `Liberación en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {onEditarPago && onEliminarPago && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => onEditarPago(pago)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar pago"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(pago.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar pago"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resumen de comisiones si hay pagos */}
          {pagos.length > 0 && pagos.some(p => p.comision_aplicada && p.comision_aplicada > 0) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-900">Total de Comisiones</span>
                <span className="text-lg font-bold text-orange-900">
                  ${pagos.reduce((sum, p) => sum + (p.comision_aplicada || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
