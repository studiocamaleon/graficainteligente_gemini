import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatConfiguracionProducto } from '../../utils/formatPresupuestoConfig';

interface PresupuestoTracking {
  id: string;
  numero_presupuesto: string;
  estado: string;
  fecha_creacion: string;
  fecha_validez: string;
  fecha_enviado?: string;
  fecha_respuesta?: string;
  total: number;
  subtotal: number;
  condiciones_comerciales?: string;
  observaciones_cliente?: string;
  motivo_rechazo?: string;
  company: {
    name: string;
    razon_social: string;
    logo_url?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    sitio_web?: string;
  };
  cliente: {
    razon_social: string;
    email?: string;
    telefono?: string;
  };
  items: Array<{
    id: string;
    producto_nombre: string;
    producto_categoria?: string;
    descripcion?: string;
    configuracion?: any;
    cantidad: number;
    precio_unitario_final: number;
    precio_total: number;
    tiempo_produccion_dias?: number;
  }>;
  orden_trabajo?: {
    id: string;
    numero_orden: string;
    estado: string;
    fecha_entrega?: string;
    tracking_token: string;
  };
}

export default function PresupuestoTracking() {
  const { token } = useParams<{ token: string }>();
  const [presupuesto, setPresupuesto] = useState<PresupuestoTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAprobarModal, setShowAprobarModal] = useState(false);
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      fetchPresupuesto();
    }
  }, [token]);

  const fetchPresupuesto = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await (supabase.rpc as any)(
        'fn_get_public_presupuesto_tracking',
        { p_tracking_token: token }
      );

      if (rpcError) throw rpcError;

      if (data?.error) {
        setError(data.message);
        return;
      }

      setPresupuesto(data as PresupuestoTracking);
    } catch (err: any) {
      console.error('Error fetching presupuesto:', err);
      setError('Error al cargar el presupuesto');
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent accidental form submission
    if (!presupuesto) return;

    try {
      setSubmitting(true);

      const { data, error: rpcError } = await (supabase.rpc as any)(
        'fn_aprobar_presupuesto_public',
        {
          p_tracking_token: token,
          p_observaciones: observaciones || null
        }
      );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(data?.message || 'Error al aprobar el presupuesto');
      }

      await fetchPresupuesto();
      setShowAprobarModal(false);
      setObservaciones('');
    } catch (err: any) {
      console.error('Error aprobando:', err);
      alert(err.message || 'Error al aprobar el presupuesto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRechazar = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent accidental form submission
    if (!presupuesto || !motivoRechazo.trim()) return;

    try {
      setSubmitting(true);

      const { data, error: rpcError } = await (supabase.rpc as any)(
        'fn_rechazar_presupuesto_public',
        {
          p_tracking_token: token,
          p_motivo: motivoRechazo,
          p_observaciones: observaciones || null
        }
      );

      if (rpcError) throw rpcError;

      if (!data?.success) {
        throw new Error(data?.message || 'Error al rechazar el presupuesto');
      }

      await fetchPresupuesto();
      setShowRechazarModal(false);
      setMotivoRechazo('');
      setObservaciones('');
    } catch (err: any) {
      console.error('Error rechazando:', err);
      alert(err.message || 'Error al rechazar el presupuesto');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getEstadoBadge = () => {
    if (!presupuesto) return null;

    const config: Record<string, any> = {
      borrador: { label: 'Borrador', variant: 'secondary', icon: Clock },
      pendiente: { label: 'Pendiente', variant: 'warning', icon: Clock },
      enviado: { label: 'Enviado', variant: 'info', icon: Clock },
      aprobado: { label: 'Aprobado', variant: 'success', icon: CheckCircle },
      rechazado: { label: 'Rechazado', variant: 'danger', icon: XCircle },
      convertido: { label: 'Convertido', variant: 'success', icon: CheckCircle },
      vencido: { label: 'Vencido', variant: 'secondary', icon: Clock },
    };

    const c = config[presupuesto.estado] || config.pendiente;
    const Icon = c.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.variant === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
        c.variant === 'danger' ? 'bg-red-50 text-red-700 border-red-200' :
          c.variant === 'warning' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
            c.variant === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-gray-100 text-gray-700 border-gray-200'
        }`}>
        <Icon className="w-3 h-3 mr-1" />
        {c.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !presupuesto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Presupuesto no encontrado
          </h2>
          <p className="text-gray-600">{error || 'El token no es válido'}</p>
        </div>
      </div>
    );
  }

  const puedeInteractuar = presupuesto.estado === 'enviado';

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Document Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">

          {/* Header Section */}
          <div className="p-8 border-b border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              {/* Logo & Company Info */}
              <div className="flex-1">
                {presupuesto.company.logo_url ? (
                  <img
                    src={presupuesto.company.logo_url}
                    alt={presupuesto.company.razon_social}
                    className="h-12 w-auto object-contain mb-4"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-900 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white font-bold text-xl">{presupuesto.company.name.charAt(0)}</span>
                  </div>
                )}
                <h1 className="text-lg font-semibold text-gray-900">{presupuesto.company.name}</h1>
                <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                  {presupuesto.company.direccion && <p>{presupuesto.company.direccion}</p>}
                  {presupuesto.company.email && <p>{presupuesto.company.email}</p>}
                  {presupuesto.company.telefono && <p>{presupuesto.company.telefono}</p>}
                </div>
              </div>

              {/* Quote Details */}
              <div className="text-right">
                <div className="inline-block mb-4">
                  {getEstadoBadge()}
                </div>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Presupuesto</h2>
                <p className="text-3xl font-bold text-gray-900 tracking-tight mt-1">{presupuesto.numero_presupuesto}</p>
                <div className="mt-4 text-sm text-gray-500 space-y-1">
                  <p>Fecha: <span className="font-medium text-gray-900">{formatDate(presupuesto.fecha_creacion)}</span></p>
                  {presupuesto.fecha_validez && (
                    <p>Válido hasta: <span className="font-medium text-red-600">{formatDate(presupuesto.fecha_validez)}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Client Info Section */}
            <div className="mt-8 pt-8 border-t border-gray-50">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preparado para</h3>
              <div className="text-gray-900 font-medium text-lg">
                {presupuesto.cliente.razon_social}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {presupuesto.cliente.email && <p>{presupuesto.cliente.email}</p>}
                {presupuesto.cliente.telefono && <p>{presupuesto.cliente.telefono}</p>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Detalle de Cotización</h3>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cant.</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unit.</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {(presupuesto.items || []).map((item) => {
                    const configuracionFormateada = formatConfiguracionProducto(
                      item.configuracion,
                      item.producto_categoria
                    );
                    const descripcionFinal = item.descripcion || configuracionFormateada;

                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.producto_nombre}</div>
                          {descripcionFinal && (
                            <div className="text-sm text-gray-500 mt-0.5 max-w-md">{descripcionFinal}</div>
                          )}
                          {item.tiempo_produccion_dias && (
                            <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.tiempo_produccion_dias} días de producción
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                          {item.cantidad}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right tabular-nums">
                          {formatCurrency(item.precio_unitario_final)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right tabular-nums">
                          {formatCurrency(item.precio_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {(presupuesto.items || []).map((item) => {
                const configuracionFormateada = formatConfiguracionProducto(
                  item.configuracion,
                  item.producto_categoria
                );
                const descripcionFinal = item.descripcion || configuracionFormateada;

                return (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900">{item.producto_nombre}</div>
                      <div className="bg-white px-2 py-1 rounded text-xs font-bold text-gray-700 border border-gray-200 shadow-sm">
                        x{item.cantidad}
                      </div>
                    </div>

                    {descripcionFinal && (
                      <div className="text-sm text-gray-500 mb-3">{descripcionFinal}</div>
                    )}

                    {item.tiempo_produccion_dias && (
                      <div className="text-xs text-blue-600 mb-3 flex items-center gap-1 bg-blue-50 w-fit px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" /> {item.tiempo_produccion_dias} días
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-gray-200 pt-3 mt-2">
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-gray-700">{formatCurrency(item.precio_unitario_final)}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Unitario</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(item.precio_total)}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Subtotal</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals Section */}
            <div className="mt-8 flex justify-end">
              <div className="w-full md:w-1/2 lg:w-1/3 bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency((presupuesto.items || []).reduce((sum, i) => sum + i.precio_total, 0))}</span>
                </div>
                {/* Add Tax/Discount rows here if available in data */}
                <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900 tabular-nums block">{formatCurrency(presupuesto.total)}</span>
                    <span className="text-sm text-gray-600 font-medium block mt-1">
                      {formatCurrency(presupuesto.total * 1.21)} <span className="text-xs text-gray-500">(c/IVA)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions Section */}
          {presupuesto.condiciones_comerciales && (
            <div className="p-8 border-t border-gray-100 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Condiciones Comerciales</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {presupuesto.condiciones_comerciales}
              </p>
            </div>
          )}

          {/* Status Messages for Convertido/Rechazado */}
          {presupuesto.estado === 'aprobado' && (
            <div className="bg-green-50 border-t border-green-100 p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-green-900">¡Presupuesto Aprobado!</h3>
              <p className="text-green-700 mt-1">Gracias por tu confirmación. Nos pondremos en contacto a la brevedad.</p>
              {presupuesto.orden_trabajo && (
                <Button
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm"
                  onClick={() => window.open(`/tracking/${presupuesto.orden_trabajo?.tracking_token}`, '_blank')}
                >
                  Ver Estado de Orden
                </Button>
              )}
            </div>
          )}

          {presupuesto.estado === 'rechazado' && (
            <div className="bg-gray-50 border-t border-gray-100 p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 mb-3">
                <XCircle className="w-6 h-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Presupuesto Rechazado</h3>
              <p className="text-gray-500 mt-1">Hemos registrado tu respuesta. Gracias por avisarnos.</p>
            </div>
          )}
        </div>

        {/* Floating Action Bar (Sticky Bottom) - Only if Actionable */}
        {puedeInteractuar && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:relative md:bg-transparent md:border-0 md:shadow-none md:mt-8 md:p-0 safe-area-bottom">
            <div className="max-w-3xl mx-auto flex flex-col gap-3 md:flex-row md:justify-end">
              {presupuesto.company.telefono && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${presupuesto.company.telefono?.replace(/\D/g, '')}`,
                      '_blank'
                    )
                  }
                  className="w-full md:w-auto text-gray-600 hover:bg-gray-100 bg-white border border-gray-300 order-1 md:order-1"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Consultar
                </Button>
              )}

              <div className="flex gap-3 w-full md:w-auto order-2 md:order-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRechazarModal(true)}
                  className="flex-1 md:w-auto bg-white border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 shadow-sm justify-center"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={() => setShowAprobarModal(true)}
                  className="flex-1 md:w-auto bg-gray-900 hover:bg-black text-white shadow-lg transition-transform hover:scale-105 justify-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprobar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Spacer for mobile safe area */}
        {puedeInteractuar && <div className="h-24 md:h-0"></div>}

      </div>

      {/* Modal Aprobar (Refined) */}
      <Modal
        isOpen={showAprobarModal}
        onClose={() => setShowAprobarModal(false)}
        title="Confirmar Aprobación"
      >
        <div className="space-y-6 pt-2">
          <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-blue-800 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>Al confirmar, notificaremos a la empresa y se iniciará el proceso de producción según los tiempos estipulados.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Observaciones adicionales <span className="text-gray-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow resize-none text-sm placeholder-gray-400"
              placeholder="¿Algún comentario especial sobre la entrega o producción?"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowAprobarModal(false)}
              disabled={submitting}
              className="flex-1 justify-center border-gray-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAprobar}
              disabled={submitting}
              className="flex-1 justify-center bg-gray-900 hover:bg-black text-white"
            >
              {submitting ? 'Procesando...' : 'Confirmar Todo'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Rechazar (Refined) */}
      <Modal
        isOpen={showRechazarModal}
        onClose={() => setShowRechazarModal(false)}
        title="Rechazar Presupuesto"
      >
        <div className="space-y-6 pt-2">
          <p className="text-gray-500 text-sm">
            Lamentamos que esta propuesta no se ajuste a lo que buscas. Por favor, indícanos el motivo para poder mejorar.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm placeholder-gray-400"
              placeholder="Ej: Presupuesto elevado, Tiempo de entrega..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Comentarios adicionales
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm placeholder-gray-400"
              placeholder="Detalles extra..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowRechazarModal(false)}
              disabled={submitting}
              className="flex-1 justify-center border-gray-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRechazar}
              disabled={submitting || !motivoRechazo.trim()}
              className="flex-1 justify-center bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {submitting ? 'Enviando...' : 'Confirmar Rechazo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
