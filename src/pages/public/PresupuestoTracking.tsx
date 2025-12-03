import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertCircle, Download, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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

      const { data, error: rpcError } = await supabase.rpc(
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

  const handleAprobar = async () => {
    if (!presupuesto) return;

    try {
      setSubmitting(true);

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update({
          estado: 'aprobado',
          fecha_respuesta: new Date().toISOString(),
          observaciones_cliente: observaciones || null,
        })
        .eq('id', presupuesto.id);

      if (updateError) throw updateError;

      await fetchPresupuesto();
      setShowAprobarModal(false);
      setObservaciones('');
    } catch (err: any) {
      console.error('Error aprobando:', err);
      alert('Error al aprobar el presupuesto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!presupuesto || !motivoRechazo.trim()) return;

    try {
      setSubmitting(true);

      const observacionesCompletas = observaciones
        ? `MOTIVO: ${motivoRechazo}\n\n${observaciones}`
        : `MOTIVO: ${motivoRechazo}`;

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update({
          estado: 'rechazado',
          fecha_respuesta: new Date().toISOString(),
          observaciones_cliente: observacionesCompletas,
        })
        .eq('id', presupuesto.id);

      if (updateError) throw updateError;

      await fetchPresupuesto();
      setShowRechazarModal(false);
      setMotivoRechazo('');
      setObservaciones('');
    } catch (err: any) {
      console.error('Error rechazando:', err);
      alert('Error al rechazar el presupuesto');
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
      <Badge variant={c.variant} className="flex items-center gap-1">
        <Icon className="w-4 h-4" />
        {c.label}
      </Badge>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
          {presupuesto.company.logo_url && (
            <img
              src={presupuesto.company.logo_url}
              alt={presupuesto.company.razon_social}
              className="h-16 mb-4"
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {presupuesto.company.name || presupuesto.company.razon_social}
          </h1>
          <p className="text-gray-600">{presupuesto.company.direccion}</p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
            {presupuesto.company.telefono && <span>📞 {presupuesto.company.telefono}</span>}
            {presupuesto.company.email && <span>✉️ {presupuesto.company.email}</span>}
          </div>
        </div>

        {/* Estado */}
        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {presupuesto.numero_presupuesto}
              </h2>
              <p className="text-gray-600">
                Creado: {formatDate(presupuesto.fecha_creacion)}
              </p>
            </div>
            {getEstadoBadge()}
          </div>

          {presupuesto.fecha_validez && (
            <p className="text-red-600 font-semibold">
              Válido hasta: {formatDate(presupuesto.fecha_validez)}
            </p>
          )}

          {presupuesto.estado === 'aprobado' && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-semibold">
                ✅ Tu aprobación fue registrada. Pronto nos contactaremos para continuar.
              </p>
            </div>
          )}

          {presupuesto.estado === 'rechazado' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">
                ❌ Gracias por tu respuesta. Te contactaremos pronto.
              </p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Items Cotizados</h3>
          <div className="space-y-4">
            {presupuesto.items.map((item) => {
              // Generar descripción desde configuración si no hay descripción manual
              const configuracionFormateada = formatConfiguracionProducto(
                item.configuracion,
                item.producto_categoria
              );
              const descripcionFinal = item.descripcion || configuracionFormateada;

              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.producto_nombre}</h4>
                      {descripcionFinal && (
                        <p className="text-sm text-gray-600 mt-1">{descripcionFinal}</p>
                      )}
                      {item.producto_categoria && (
                        <p className="text-xs text-gray-500 mt-1">
                          Categoría: {item.producto_categoria}
                        </p>
                      )}
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(item.precio_total)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>Cantidad: {item.cantidad}</span>
                    <span>Precio unit.: {formatCurrency(item.precio_unitario_final)}</span>
                    {item.tiempo_produccion_dias && (
                      <span>⏱️ {item.tiempo_produccion_dias} días</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">TOTAL</span>
              <span className="text-3xl font-bold text-blue-600">
                {formatCurrency(presupuesto.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Condiciones */}
        {presupuesto.condiciones_comerciales && (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Condiciones Comerciales
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {presupuesto.condiciones_comerciales}
            </p>
          </div>
        )}

        {/* Acciones */}
        {puedeInteractuar && (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">¿Qué deseas hacer?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button onClick={() => setShowAprobarModal(true)} className="w-full">
                <CheckCircle className="w-5 h-5 mr-2" />
                Aprobar
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowRechazarModal(true)}
                className="w-full"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Rechazar
              </Button>
              {presupuesto.company.telefono && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${presupuesto.company.telefono?.replace(/\D/g, '')}`,
                      '_blank'
                    )
                  }
                  className="w-full"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Consultar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Orden asociada */}
        {presupuesto.orden_trabajo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-green-900 mb-2">
              Presupuesto Convertido a Orden
            </h3>
            <p className="text-green-800 mb-4">
              Tu presupuesto fue aprobado y convertido en orden de trabajo.
            </p>
            <Button
              onClick={() =>
                window.open(`/tracking/${presupuesto.orden_trabajo?.tracking_token}`, '_blank')
              }
            >
              Ver seguimiento de orden
            </Button>
          </div>
        )}
      </div>

      {/* Modal Aprobar */}
      <Modal
        isOpen={showAprobarModal}
        onClose={() => setShowAprobarModal(false)}
        title="Aprobar Presupuesto"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Confirmas que deseas aprobar este presupuesto? Nos contactaremos contigo para
            continuar con el proceso.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Agregar comentarios..."
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleAprobar} disabled={submitting} className="flex-1">
              {submitting ? 'Confirmando...' : 'Confirmar Aprobación'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowAprobarModal(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Rechazar */}
      <Modal
        isOpen={showRechazarModal}
        onClose={() => setShowRechazarModal(false)}
        title="Rechazar Presupuesto"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo *
            </label>
            <input
              type="text"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Ej: Precio elevado, necesito más tiempo, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones adicionales (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Detalles adicionales..."
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={handleRechazar}
              disabled={submitting || !motivoRechazo.trim()}
              className="flex-1"
            >
              {submitting ? 'Confirmando...' : 'Confirmar Rechazo'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowRechazarModal(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
