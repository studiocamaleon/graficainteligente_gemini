import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, FileText, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useCentroCopiadoOrden } from '../../../hooks/useCentroCopiadoOrden';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { CentroCopiadoOrdenArchivos } from '../../../components/centro-copiado/CentroCopiadoOrdenArchivos';
import type { EstadoOrdenCopiado, TipoItemCopiado } from '../../../types/database';

export function DetalleOrdenCopiado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  const { orden, loading, error, refetch } = useCentroCopiadoOrden(id);
  const { updateEstado } = useCentroCopiadoOrdenes();
  const { dialogState: confirmDialogState, closeDialog: closeConfirmDialog, handleConfirm, openConfirm } = useConfirmDialog();
  const { dialogState: infoDialogState, closeDialog: closeInfoDialog, openDialog: openInfoDialog } = useInfoDialog();

  usePageHeader(`Detalle de Orden ${orden?.numero_orden || ''}`);

  const getEstadoBadge = (estado: EstadoOrdenCopiado) => {
    const estilos = {
      pendiente: { variant: 'warning' as const, label: 'Pendiente' },
      en_proceso: { variant: 'primary' as const, label: 'En Proceso' },
      finalizada: { variant: 'success' as const, label: 'Finalizada' },
      entregada: { variant: 'secondary' as const, label: 'Entregada' },
      cancelada: { variant: 'danger' as const, label: 'Cancelada' },
    };

    const estilo = estilos[estado] || { variant: 'secondary' as const, label: estado };
    return <Badge variant={estilo.variant}>{estilo.label}</Badge>;
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCambiarEstado = async (nuevoEstado: EstadoOrdenCopiado, motivo?: string) => {
    if (!orden) return;

    try {
      const success = await updateEstado(orden.id, nuevoEstado, motivo);
      if (success) {
        openInfoDialog('Estado Actualizado', `La orden ha sido marcada como ${nuevoEstado}`);
        await refetch();
      } else {
        openInfoDialog('Error', 'No se pudo actualizar el estado de la orden');
      }
    } catch (error) {
      openInfoDialog('Error', error instanceof Error ? error.message : 'Error al actualizar estado');
    }
  };

  const iniciarCancelacion = () => {
    setShowCancelarModal(true);
  };

  const confirmarCancelacion = async () => {
    if (!motivoCancelacion.trim()) {
      openInfoDialog('Error', 'Debes proporcionar un motivo de cancelación');
      return;
    }

    await handleCambiarEstado('cancelada', motivoCancelacion);
    setShowCancelarModal(false);
    setMotivoCancelacion('');
  };

  const getTipoItemLabel = (tipo: TipoItemCopiado) => {
    const labels = {
      impresion: 'Impresión',
      anillado: 'Anillado',
      plastificado: 'Plastificado',
    };
    return labels[tipo] || tipo;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="secondary" onClick={() => navigate('/app/centro-copiado/ordenes')}>
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando orden...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="space-y-6">
        <Button variant="secondary" onClick={() => navigate('/app/centro-copiado/ordenes')}>
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <Card>
          <div className="p-12">
            <EmptyState
              icon={AlertCircle}
              title="Orden no encontrada"
              description={error || 'No se pudo cargar la información de la orden'}
              action={
                <Button variant="primary" onClick={() => navigate('/app/centro-copiado/ordenes')}>
                  Volver al Listado
                </Button>
              }
            />
          </div>
        </Card>
      </div>
    );
  }

  const puedeIniciarProceso = orden.estado === 'pendiente';
  const puedeFinalizar = orden.estado === 'en_proceso';
  const puedeEntregar = orden.estado === 'finalizada';
  const puedeCancelar = orden.estado === 'pendiente' || orden.estado === 'en_proceso';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate('/app/centro-copiado/ordenes')}>
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>

        <div className="flex items-center gap-2">
          {puedeIniciarProceso && (
            <Button
              variant="primary"
              onClick={() => {
                openConfirm({
                  title: '¿Iniciar Proceso?',
                  message: '¿Deseas marcar esta orden como "En Proceso"?',
                  variant: 'info',
                  onConfirm: () => handleCambiarEstado('en_proceso')
                });
              }}
            >
              Iniciar Proceso
            </Button>
          )}

          {puedeFinalizar && (
            <Button
              variant="success"
              onClick={() => {
                openConfirm({
                  title: '¿Finalizar Orden?',
                  message: '¿Deseas marcar esta orden como "Finalizada"?',
                  variant: 'info',
                  onConfirm: () => handleCambiarEstado('finalizada')
                });
              }}
            >
              Finalizar
            </Button>
          )}

          {puedeEntregar && (
            <Button
              variant="success"
              onClick={() => {
                openConfirm({
                  title: '¿Marcar como Entregada?',
                  message: 'Se registrará la fecha de entrega actual. ¿Continuar?',
                  variant: 'info',
                  onConfirm: () => handleCambiarEstado('entregada')
                });
              }}
            >
              Marcar Entregada
            </Button>
          )}

          {puedeCancelar && (
            <Button variant="danger" onClick={iniciarCancelacion}>
              Cancelar Orden
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{orden.numero_orden}</h1>
              <p className="text-sm text-gray-500 mt-1">ID: {orden.id}</p>
            </div>
            {getEstadoBadge(orden.estado)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">Cliente</h3>
              </div>
              <p className="text-base font-semibold text-gray-900">
                {orden.cliente?.nombre_fantasia || 'N/A'}
              </p>
              <p className="text-sm text-gray-500">{orden.cliente?.numero_documento}</p>
              {orden.cliente?.whatsapp && (
                <p className="text-sm text-gray-500">WhatsApp: {orden.cliente.whatsapp}</p>
              )}
              {orden.cliente?.email && (
                <p className="text-sm text-gray-500">{orden.cliente.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">Fechas</h3>
              </div>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-gray-600">Solicitud:</span>{' '}
                  <span className="font-medium">{formatearFecha(orden.fecha_solicitud)}</span>
                </p>
                {orden.fecha_entrega_estimada && (
                  <p className="text-sm">
                    <span className="text-gray-600">Entrega estimada:</span>{' '}
                    <span className="font-medium">{formatearFecha(orden.fecha_entrega_estimada)}</span>
                  </p>
                )}
                {orden.fecha_entrega_real && (
                  <p className="text-sm">
                    <span className="text-gray-600">Entregada:</span>{' '}
                    <span className="font-medium text-green-600">
                      {formatearFecha(orden.fecha_entrega_real)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">Total</h3>
              </div>
              <p className="text-2xl font-bold text-green-600">${Number(orden.total).toFixed(2)}</p>
            </div>
          </div>

          {orden.observaciones && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">Observaciones</h3>
              </div>
              <p className="text-sm text-gray-900">{orden.observaciones}</p>
            </div>
          )}

          {orden.created_by_profile && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-500">
                Creada por: <span className="font-medium">{orden.created_by_profile.full_name}</span>
              </p>
            </div>
          )}
        </div>
      </Card>

      <CentroCopiadoOrdenArchivos ordenId={orden.id} />

      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Items de la Orden</h2>

          {orden.items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No hay items"
              description="Esta orden no tiene items configurados"
            />
          ) : (
            <Table
              columns={[
                {
                  key: 'numero',
                  header: '#',
                  render: (item, index) => <Badge variant="secondary">{index + 1}</Badge>,
                },
                {
                  key: 'tipo',
                  header: 'Tipo',
                  render: (item) => <span className="font-medium">{getTipoItemLabel(item.tipo_item)}</span>,
                },
                {
                  key: 'descripcion',
                  header: 'Descripción',
                  render: (item) => {
                    if (item.tipo_item === 'impresion') {
                      return (
                        <div className="text-sm">
                          <div>
                            {item.tamanio_papel?.nombre} - {item.papel?.variante_nombre}
                            {item.papel?.espesor && ` ${item.papel.espesor}${item.papel.unidad_espesor}`}
                          </div>
                          <div className="text-gray-500">
                            {item.tipo_tinta === 'CMYK' ? 'Color' : 'B/N'} -{' '}
                            {item.cara_impresa === 'frente' ? 'Frente' : 'Frente y Dorso'}
                          </div>
                        </div>
                      );
                    }
                    return <span className="text-sm text-gray-600">{item.descripcion || '-'}</span>;
                  },
                },
                {
                  key: 'cantidad',
                  header: 'Cantidad',
                  render: (item) => (
                    <div className="text-sm">
                      {item.cantidad_hojas && <div>{item.cantidad_hojas} hojas</div>}
                      <div className="text-gray-500">{item.cantidad_unidades} copias</div>
                    </div>
                  ),
                },
                {
                  key: 'terminaciones',
                  header: 'Terminaciones',
                  render: (item) => (
                    <div className="space-y-1">
                      {item.tipo_anillado && (
                        <Badge variant="primary">
                          {item.tipo_anillado === 'ring_wire' ? 'Ring Wire' : 'Plástico'}
                        </Badge>
                      )}
                      {item.tipo_plastificado && <Badge variant="primary">{item.tipo_plastificado}</Badge>}
                      {!item.tipo_anillado && !item.tipo_plastificado && (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'subtotal',
                  header: 'Subtotal',
                  render: (item) => (
                    <span className="font-semibold text-green-600">
                      ${Number(item.subtotal).toFixed(2)}
                    </span>
                  ),
                },
              ]}
              data={orden.items}
              keyExtractor={(item) => item.id}
            />
          )}
        </div>
      </Card>

      <Modal
        isOpen={showCancelarModal}
        onClose={() => setShowCancelarModal(false)}
        title="Cancelar Orden"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Por favor, proporciona el motivo de cancelación de esta orden:
          </p>
          <textarea
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Motivo de cancelación..."
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowCancelarModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarCancelacion}>
              Confirmar Cancelación
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        onConfirm={handleConfirm}
        onCancel={closeConfirmDialog}
      />

      <InfoDialog
        isOpen={infoDialogState.isOpen}
        title={infoDialogState.title}
        message={infoDialogState.message}
        onClose={closeInfoDialog}
      />
    </div>
  );
}
