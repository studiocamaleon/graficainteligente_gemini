import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, FileText, DollarSign, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useCentroCopiadoOrden } from '../../../hooks/useCentroCopiadoOrden';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import { useCentroCopiadoOrdenPagos } from '../../../hooks/useCentroCopiadoOrdenPagos';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { useCentroCopiadoOrdenArchivos } from '../../../hooks/useCentroCopiadoOrdenArchivos';
import { OrdenPagosTab } from '../../../components/orders/OrdenPagosTab';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import type { EstadoOrdenCopiado, TipoItemCopiado } from '../../../types/database';

export function DetalleOrdenCopiado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [activeTab, setActiveTab] = useState('detalles');
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagoEditando, setPagoEditando] = useState<any>(null);

  const { orden, loading, error, refetch } = useCentroCopiadoOrden(id);
  const { updateEstado } = useCentroCopiadoOrdenes();
  const { archivos, descargarArchivo, descargarTodosArchivos } = useCentroCopiadoOrdenArchivos(id);
  const { pagos, createPago, updatePago, deletePago, calcularTotales } = useCentroCopiadoOrdenPagos(id);
  const { dialogState: confirmDialogState, closeDialog: closeConfirmDialog, handleConfirm, openConfirm } = useConfirmDialog();
  const { dialogState: infoDialogState, closeDialog: closeInfoDialog, openDialog: openInfoDialog } = useInfoDialog();
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const [descargandoTodos, setDescargandoTodos] = useState(false);

  usePageHeader(`Detalle de Orden ${orden?.numero_orden || ''}`);

  const esOrdenIndependiente = !orden?.orden_trabajo_id;

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

  const getArchivoParaItem = (itemId: string) => {
    return archivos.find(archivo => archivo.item_generado_id === itemId);
  };

  const handleDescargarArchivo = async (archivoId: string) => {
    setDescargandoId(archivoId);
    await descargarArchivo(archivoId);
    setDescargandoId(null);
  };

  const handleAgregarPago = () => {
    setPagoEditando(null);
    setShowPagoModal(true);
  };

  const handleEditarPago = (pago: any) => {
    setPagoEditando(pago);
    setShowPagoModal(true);
  };

  const handleSubmitPago = async (data: any) => {
    if (!orden) return;

    try {
      let success = false;

      if (pagoEditando) {
        success = await updatePago(pagoEditando.id, data);
      } else {
        const result = await createPago({
          orden_copiado_id: orden.id,
          ...data,
        });
        success = !!result;
      }

      if (success) {
        setShowPagoModal(false);
        setPagoEditando(null);
        openInfoDialog('Éxito', pagoEditando ? 'Pago actualizado correctamente' : 'Pago registrado correctamente');
      } else {
        openInfoDialog('Error', 'No se pudo guardar el pago');
      }
    } catch (error) {
      openInfoDialog('Error', error instanceof Error ? error.message : 'Error al guardar pago');
    }
  };

  const handleEliminarPago = async (pagoId: string) => {
    const success = await deletePago(pagoId);
    if (success) {
      openInfoDialog('Éxito', 'Pago eliminado correctamente');
    } else {
      openInfoDialog('Error', 'No se pudo eliminar el pago');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={AlertCircle}
          title="Error al cargar"
          description={error || 'No se pudo cargar la información de la orden'}
          action={
            <Button onClick={() => navigate('/app/centro-copiado/ordenes')}>
              Volver al listado
            </Button>
          }
        />
      </div>
    );
  }

  const puedeCancelar = orden.estado !== 'cancelada' && orden.estado !== 'entregada';
  const puedeIniciar = orden.estado === 'pendiente';
  const puedeFinalizar = orden.estado === 'en_proceso';
  const puedeEntregar = orden.estado === 'finalizada';

  const totales = {
    subtotal: orden.total,
    descuentoAplicado: 0,
    subtotalConDescuento: orden.total,
    iva: 0,
    total: orden.total,
  };

  const tabs = [
    { id: 'detalles', label: 'Detalles e Items' },
    ...(esOrdenIndependiente ? [{ id: 'pagos', label: 'Pagos' }] : []),
    { id: 'archivos', label: `Archivos (${archivos.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => navigate('/app/centro-copiado/ordenes')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        <div className="flex gap-2">
          {puedeIniciar && (
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
              {orden.orden_trabajo_id && (
                <Link
                  to={`/app/orders/${orden.orden_trabajo_id}`}
                  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 mt-1"
                >
                  Ver Orden de Trabajo Principal
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
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
                {' el '}
                {formatearFecha(orden.created_at)}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'detalles' && (
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
                      <span className="font-semibold text-gray-900">${Number(item.subtotal).toFixed(2)}</span>
                    ),
                  },
                ]}
                data={orden.items}
                keyExtractor={(item) => item.id}
              />
            )}
          </div>
        </Card>
      )}

      {activeTab === 'pagos' && esOrdenIndependiente && (
        <Card>
          <div className="p-6">
            <OrdenPagosTab
              totales={totales}
              pagos={pagos}
              onAgregarPago={handleAgregarPago}
              onEditarPago={handleEditarPago}
              onEliminarPago={handleEliminarPago}
              readOnly={orden.estado === 'cancelada'}
            />
          </div>
        </Card>
      )}

      {activeTab === 'pagos' && !esOrdenIndependiente && (
        <Card>
          <div className="p-6">
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Pagos gestionados desde la Orden de Trabajo
              </h3>
              <p className="text-gray-600 mb-4">
                Esta orden está asociada a una orden de trabajo principal. Los pagos se registran desde allí.
              </p>
              {orden.orden_trabajo_id && (
                <Link to={`/app/orders/${orden.orden_trabajo_id}`}>
                  <Button variant="primary">
                    Ver Orden de Trabajo Principal
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'archivos' && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Archivos Adjuntos</h2>
              {archivos.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    setDescargandoTodos(true);
                    await descargarTodosArchivos();
                    setDescargandoTodos(false);
                  }}
                  disabled={descargandoTodos}
                >
                  {descargandoTodos ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Descargando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Todos
                    </>
                  )}
                </Button>
              )}
            </div>

            {archivos.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No hay archivos"
                description="No se han adjuntado archivos a esta orden"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivos.map((archivo) => (
                  <div key={archivo.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <FileText className="w-8 h-8 text-blue-600" />
                      {archivo.paginas_detectadas && (
                        <Badge variant="primary">{archivo.paginas_detectadas} págs</Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1 truncate" title={archivo.nombre_archivo}>
                      {archivo.nombre_archivo}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {(archivo.tamano_bytes / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDescargarArchivo(archivo.id)}
                      disabled={descargandoId === archivo.id}
                      className="w-full"
                    >
                      {descargandoId === archivo.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                          Descargando...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Descargar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

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

      {showPagoModal && (
        <PagoFormModal
          isOpen={showPagoModal}
          onClose={() => {
            setShowPagoModal(false);
            setPagoEditando(null);
          }}
          onSubmit={handleSubmitPago}
          saldoPendiente={calcularTotales(orden.total).saldoPendiente}
          pago={pagoEditando}
        />
      )}

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
