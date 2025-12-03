import { useState } from 'react';
import { FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useFacturas, type OrdenPendienteFacturacion } from '../../../hooks/useFacturas';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FacturasKPICards } from '../../../components/facturas/FacturasKPICards';
import { FacturasFilters } from '../../../components/facturas/FacturasFilters';
import { OrdenPendienteCard } from '../../../components/facturas/OrdenPendienteCard';
import { RegistrarFacturaModal } from '../../../components/facturas/RegistrarFacturaModal';

export function FacturasView() {
  usePageHeader('Gestión de Facturas');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [estado, setEstado] = useState('');

  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenPendienteFacturacion | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { showSuccess, showError } = useToast();

  const {
    ordenesPendientes,
    estadisticas,
    loading,
    error,
    refetch,
    registrarFactura,
  } = useFacturas({
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
    cliente_id: clienteId || undefined,
    estado: estado || undefined,
  });

  const handleClearFilters = () => {
    setFechaDesde('');
    setFechaHasta('');
    setClienteId('');
    setEstado('');
  };

  const handleCargarFactura = (orden: OrdenPendienteFacturacion) => {
    setOrdenSeleccionada(orden);
    setShowModal(true);
  };

  const handleSubmitFactura = async (
    ordenId: string,
    numeroFactura: string,
    archivo: File,
    observaciones?: string
  ) => {
    setSubmitting(true);
    try {
      const result = await registrarFactura(ordenId, numeroFactura, archivo, observaciones);

      if (result.success) {
        showSuccess('Factura registrada correctamente. Se enviará notificación al cliente.');
        setShowModal(false);
        setOrdenSeleccionada(null);
      } else {
        showError(result.error || 'Error al registrar la factura');
      }
    } catch (err) {
      showError('Error inesperado al registrar la factura');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Facturas</h1>
          <p className="text-gray-600 mt-1">
            Administra las facturas de órdenes de trabajo
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={refetch}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <FacturasKPICards estadisticas={estadisticas} loading={loading} />

      <FacturasFilters
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        clienteId={clienteId}
        estado={estado}
        onFechaDesdeChange={setFechaDesde}
        onFechaHastaChange={setFechaHasta}
        onClienteChange={setClienteId}
        onEstadoChange={setEstado}
        onClear={handleClearFilters}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error al cargar datos</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Órdenes Pendientes de Facturación
            {!loading && ordenesPendientes.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({ordenesPendientes.length})
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
                <div className="h-10 bg-gray-200 rounded mt-4"></div>
              </div>
            ))}
          </div>
        ) : ordenesPendientes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay órdenes pendientes"
            description="No se encontraron órdenes que requieran facturación con los filtros aplicados"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ordenesPendientes.map((orden) => (
              <OrdenPendienteCard
                key={orden.id}
                orden={orden}
                onCargarFactura={handleCargarFactura}
              />
            ))}
          </div>
        )}
      </div>

      <RegistrarFacturaModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setOrdenSeleccionada(null);
        }}
        orden={ordenSeleccionada}
        onSubmit={handleSubmitFactura}
        loading={submitting}
      />
    </div>
  );
}
