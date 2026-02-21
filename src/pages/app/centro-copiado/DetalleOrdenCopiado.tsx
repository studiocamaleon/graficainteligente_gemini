import { useState } from 'react';
import { Switch } from '../../../components/ui/Switch';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, FileText, DollarSign, AlertCircle, Download, ExternalLink, Edit } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/card';
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
import { ChannelBadge } from '../../../components/orders/ChannelBadge';
import type { EstadoOrdenCopiado, TipoItemCopiado } from '../../../types/database';
import { useAuth } from '../../../hooks/useAuth';
import { canManagePaymentsRole, canRegisterPaymentsRole } from '../../../utils/roles';

export function DetalleOrdenCopiado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canRegisterPayments = canRegisterPaymentsRole(profile?.role);
  const canManagePayments = canManagePaymentsRole(profile?.role);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [activeTab, setActiveTab] = useState('detalles');
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagoEditando, setPagoEditando] = useState<any>(null);

  const { orden, loading, error, refetch, updateOrden } = useCentroCopiadoOrden(id);
  const { updateEstado } = useCentroCopiadoOrdenes({ enabled: false });

  // ... (previous code)

  const handleToggleFactura = async (checked: boolean) => {
    if (!orden) return;

    // Constraint: Validar si ya tiene factura
    if (orden.numero_factura && !checked) {
      openInfoDialog('Acción no permitida', 'No se puede desactivar la opción de factura porque esta orden ya tiene un número de factura asignado.');
      return;
    }

    // Constraint: Validar si es parte de una OT
    if (orden.orden_trabajo_id) {
      const otNumero = (orden as any).orden_trabajo?.numero_orden;
      openInfoDialog('Acción no permitida', `Esta orden está asociada a la Orden de Trabajo #${otNumero || ''}. Por favor, gestione la facturación desde allí.`);
      return;
    }

    try {
      // Calcular subtotal real sumando items
      const subtotal = orden.items?.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0) || 0;
      const iva = checked ? subtotal * 0.21 : 0;
      const total = subtotal + iva;

      await updateOrden(orden.id, {
        requiere_factura: checked,
        total: total
      });

    } catch (err) {
      console.error(err);
    }
  };

  const { archivos, descargarArchivo, descargarTodosArchivos } = useCentroCopiadoOrdenArchivos(id);
  const { pagos, createPago, updatePago, deletePago, calcularTotales, error: pagosError } = useCentroCopiadoOrdenPagos(id);
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

    const estilo = estilos[estado] || { variant: 'default' as const, label: estado };
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

  const getTipoItemLabel = (item: any) => {
    if (item.es_ploteo_cad) return 'Ploteo CAD';

    const labels: Record<string, string> = {
      impresion: 'Impresión',
      anillado: 'Anillado',
      plastificado: 'Plastificado',
      guillotinado: 'Guillotinado',
    };
    return labels[item.tipo_item] || item.tipo_item;
  };



  const handleDescargarArchivo = async (archivoId: string) => {
    setDescargandoId(archivoId);
    const archivo = archivos.find((a) => a.id === archivoId);
    if (archivo) {
      await descargarArchivo(archivo);
    } else {
      openInfoDialog('Error', 'No se encontró el archivo para descargar');
    }
    setDescargandoId(null);
  };

  const handleAgregarPago = () => {
    if (!canRegisterPayments) {
      openInfoDialog('Acción no permitida', 'El rol Operador de taller no puede registrar pagos.');
      return;
    }
    setPagoEditando(null);
    setShowPagoModal(true);
  };

  const handleEditarPago = (pago: any) => {
    if (!canManagePayments) {
      openInfoDialog('Acción no permitida', 'Solo superadmin puede editar pagos registrados.');
      return;
    }
    setPagoEditando(pago);
    setShowPagoModal(true);
  };

  const handleSubmitPago = async (data: any): Promise<boolean> => {
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
        openInfoDialog('Éxito', pagoEditando ? 'Pago actualizado correctamente' : 'Pago registrado correctamente');
        return true;
      } else {
        openInfoDialog('Error', 'No se pudo guardar el pago');
        return false;
      }
    } catch (error) {
      openInfoDialog('Error', error instanceof Error ? error.message : 'Error al guardar pago');
      return false;
    }
  };

  const handleEliminarPago = async (pagoId: string) => {
    if (!canManagePayments) {
      openInfoDialog('Acción no permitida', 'Solo superadmin puede eliminar pagos registrados.');
      return;
    }
    const success = await deletePago(pagoId);
    if (success) {
      openInfoDialog('Éxito', 'Pago eliminado correctamente');
    } else {
      openInfoDialog('Error', pagosError || 'No se pudo eliminar el pago');
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
  const puedeEditar = orden.estado === 'pendiente'; // Sólo permitir editar en estado pendiente
  const puedeFinalizar = orden.estado === 'pendiente' || orden.estado === 'en_proceso';
  const puedeEntregar = orden.estado === 'finalizada' || orden.estado === 'pendiente';

  // Calculate Subtotal from Items Sum to ensure it is Net
  const subtotal = orden.items?.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0) || 0;

  // Use stored discount or 0
  const descuento = Number(orden.total_descuentos) || 0;
  const subtotalConDescuento = subtotal - descuento;

  const iva = orden.requiere_factura ? subtotalConDescuento * 0.21 : 0;
  const total = subtotalConDescuento + iva;

  const totales = {
    subtotal: subtotal,
    descuentoAplicado: descuento,
    subtotalConDescuento: subtotalConDescuento,
    iva: iva,
    total: total,
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
          {puedeEditar && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/app/centro-copiado/ordenes/editar/${orden.id}`)}
              title="Editar Orden"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
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
              variant="primary"
              onClick={() => {
                openConfirm({
                  title: '¿Marcar como Entregada?',
                  message: 'Se registrará la fecha de entrega actual. ¿Continuar?',
                  variant: 'info',
                  onConfirm: () => handleCambiarEstado('entregada')
                });
              }}
            >
              Entregar
            </Button>
          )}

          {puedeCancelar && (
            <Button variant="danger" onClick={iniciarCancelacion}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 mb-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{orden.numero_orden}</h1>
                {getEstadoBadge(orden.estado)}
              </div>
              <p className="text-sm text-slate-500">Orden de copiado</p>
              {orden.orden_trabajo_id && (
                <Link
                  to={`/app/orders/${orden.orden_trabajo_id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Orden de trabajo vinculada
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 min-w-[220px]">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Total de la orden</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">${total.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Cliente</h3>
              </div>
              <p className="text-base font-semibold text-slate-900">
                {orden.cliente?.nombre_fantasia || 'N/A'}
              </p>
              <p className="text-sm text-slate-500">{orden.cliente?.numero_documento}</p>
              {orden.cliente?.whatsapp && (
                <p className="text-sm text-slate-500">WhatsApp: {orden.cliente.whatsapp}</p>
              )}
              {orden.cliente?.email && (
                <p className="text-sm text-slate-500">{orden.cliente.email}</p>
              )}

              <div className="mt-4 border-t border-slate-200 pt-3">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-medium text-slate-700">Canal de Venta</h3>
                </div>
                <ChannelBadge canal={orden.canal_venta || 'Mostrador'} showLabel={true} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Fechas</h3>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Solicitud</span>
                  <span className="font-medium text-slate-900">{formatearFecha(orden.fecha_solicitud)}</span>
                </p>
                {orden.fecha_entrega_estimada && (
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Entrega estimada</span>
                    <span className="font-medium text-slate-900">{formatearFecha(orden.fecha_entrega_estimada)}</span>
                  </p>
                )}
                {orden.fecha_entrega_real && (
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Entregada</span>
                    <span className="font-semibold text-emerald-700">{formatearFecha(orden.fecha_entrega_real)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Facturación</h3>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <Switch
                  checked={orden.requiere_factura}
                  onChange={handleToggleFactura}
                  label="Requiere Factura"
                  disabled={!!orden.numero_factura || !!orden.orden_trabajo_id}
                />

                {orden.requiere_factura && (
                  <p className="text-xs text-blue-600 mt-1 ml-11">+ IVA incluido</p>
                )}

                {orden.numero_factura ? (
                  <p className="text-xs text-amber-600 mt-1 ml-11">
                    No editable (Ya tiene factura: {orden.numero_factura})
                  </p>
                ) : orden.orden_trabajo_id ? (
                  <p className="text-xs text-amber-600 mt-1 ml-11">
                    Gestionado desde la Orden de Trabajo #{(orden as any).orden_trabajo?.numero_orden || ''}
                    {(orden as any).orden_trabajo?.numero_factura ? ` (Factura: ${(orden as any).orden_trabajo.numero_factura})` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {orden.observaciones && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-medium text-slate-700">Observaciones</h3>
              </div>
              <p className="text-sm text-slate-900">{orden.observaciones}</p>
            </div>
          )}

          {orden.created_by_profile && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                Creada por: <span className="font-medium text-slate-700">{orden.created_by_profile.full_name}</span>
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
              <>
                <Table
                  columns={[
                    {
                      key: 'numero',
                      header: '#',
                      render: (item, index) => <Badge variant="default">{index + 1}</Badge>,
                    },
                    {
                      key: 'tipo',
                      header: 'Tipo',
                      render: (item) => <span className="font-medium">{getTipoItemLabel(item)}</span>,
                    },
                    {
                      key: 'descripcion',
                      header: 'Descripción',
                      render: (item) => {
                        if (item.tipo_item === 'impresion') {
                          if (item.es_ploteo_cad) {
                            return (
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">
                                  Ploteo CAD - {item.ploteo_cad_tipo_papel}
                                </div>
                                <div className="text-gray-500">
                                  {item.ploteo_cad_ancho_rollo}cm (Ancho) × {item.ploteo_cad_metros_lineales}ml (Largo)
                                </div>
                                {item.descripcion && (
                                  <div className="mt-1 text-xs text-gray-500 italic border-t border-gray-100 pt-1">
                                    Nota: {item.descripcion}
                                  </div>
                                )}
                              </div>
                            );
                          }

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
                              {item.descripcion && (
                                <div className="mt-1 text-xs text-gray-500 italic border-t border-gray-100 pt-1">
                                  Nota: {item.descripcion}
                                </div>
                              )}
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
                          {item.con_guillotinado && <Badge variant="primary">Guillotinado</Badge>}
                          {!item.tipo_anillado && !item.tipo_plastificado && !item.con_guillotinado && (
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
                    ...(orden.requiere_factura ? [{
                      key: 'iva',
                      header: 'IVA (21%)',
                      render: (item: any) => (
                        <span className="text-sm text-gray-600">
                          ${(Number(item.subtotal || 0) * 0.21).toFixed(2)}
                        </span>
                      ),
                    }] : []),
                  ]}
                  data={orden.items}
                  keyExtractor={(item) => item.id}
                />

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <div className="w-full md:w-1/2 lg:w-1/3 ml-auto space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                    </div>

                    {totales.descuentoAplicado > 0 && (
                      <div className="flex justify-between items-center text-sm text-green-600">
                        <span>Descuento</span>
                        <span>-${totales.descuentoAplicado.toFixed(2)}</span>
                      </div>
                    )}

                    {orden.requiere_factura && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">IVA (21%)</span>
                        <span className="font-medium text-blue-600">+${iva.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-base pt-3 border-t border-gray-200">
                      <span className="font-bold text-gray-900">Total Final</span>
                      <span className="font-bold text-green-600 text-xl">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'pagos' && esOrdenIndependiente && (
        <Card>
          <div className="p-6">
            <OrdenPagosTab
              totales={totales}
              pagos={pagos.map(p => ({
                ...p,
                referencia_pago: p.referencia_pago || undefined,
                notas: p.notas || undefined,
                comision_aplicada: p.comision_aplicada || undefined,
                fecha_liberacion_estimada: p.fecha_liberacion_estimada || undefined
              }))}
              onAgregarPago={handleAgregarPago}
              onEditarPago={canManagePayments ? handleEditarPago : undefined}
              onEliminarPago={canManagePayments ? handleEliminarPago : undefined}
              readOnly={!canRegisterPayments || (orden.estado === 'cancelada' && profile?.role !== 'super_admin')}
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
          saldoPendiente={calcularTotales(totales.total).saldoPendiente}
          pago={pagoEditando}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        onConfirm={handleConfirm}
        onClose={closeConfirmDialog}
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
