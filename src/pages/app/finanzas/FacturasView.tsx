import { useState } from 'react';
import { FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useFacturas, type OrdenPendienteFacturacion } from '../../../hooks/useFacturas';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FacturasKPICards } from '../../../components/facturas/FacturasKPICards';
import { FacturasFilters } from '../../../components/facturas/FacturasFilters';
import { OrdenesPendientesTable } from '../../../components/facturas/OrdenesPendientesTable';
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
            <div className="h-12 bg-gray-100 border-b border-gray-200"></div>
            <div className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-32"></div>
                </div>
              ))}
            </div>
          </div>
        ) : ordenesPendientes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No hay órdenes pendientes"
            description="No se encontraron órdenes que requieran facturación con los filtros aplicados"
          />
        ) : (
          <OrdenesPendientesTable
            ordenes={ordenesPendientes}
            onCargarFactura={handleCargarFactura}
          />
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
