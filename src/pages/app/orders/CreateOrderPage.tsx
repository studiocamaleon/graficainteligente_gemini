import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Tabs';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useAuth } from '../../../hooks/useAuth';
import { useOrdenTrabajo } from '../../../hooks/useOrdenTrabajo';
import { usePrompt } from '../../../hooks/usePrompt';
import { useItemRoutesComments } from '../../../hooks/useItemRoutesComments';
import { useToast } from '../../../contexts/ToastContext';
import { useClients } from '../../../hooks/useClients';
import { OrdenGeneralSection } from '../../../components/orders/OrdenGeneralSection';
import { OrdenItemsTab } from '../../../components/orders/OrdenItemsTab';
import { OrdenPagosTab } from '../../../components/orders/OrdenPagosTab';
import { OrdenRutasTab } from '../../../components/orders/OrdenRutasTab';
import { OrdenHistorialTab } from '../../../components/orders/OrdenHistorialTab';
import { OrdenAdjuntosTab } from '../../../components/orders/OrdenAdjuntosTab';
import { OrdenFooterTotales } from '../../../components/orders/OrdenFooterTotales';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import { useOrdenLinks } from '../../../hooks/useOrdenLinks';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import type { CanalVenta } from '../../../types/database';

interface PagoTemporal {
  id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago?: string;
  notas?: string;
}

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // ID de orden para editar
  const isEditing = Boolean(id);

  const { profile } = useAuth();
  const { createOrdenConItems, updateOrdenCompleta, getOrdenById, loading, error } = useOrdenTrabajo();
  const { showSuccess, showError } = useToast();
  const { createOrden: createOrdenCopiado } = useCentroCopiadoOrdenes({});

  usePageHeader(isEditing ? 'Editar Orden de Trabajo' : 'Crear nueva orden de trabajo');


  const [activeTab, setActiveTab] = useState('items');
  const [clienteId, setClienteId] = useState('');
  const [canalVenta, setCanalVenta] = useState<CanalVenta>('Mostrador');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [requiereFactura, setRequiereFactura] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [descuentoTotal, setDescuentoTotal] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [ordenCreada, setOrdenCreada] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Estado para pagos
  const [pagos, setPagos] = useState<PagoTemporal[]>([]);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [editingPago, setEditingPago] = useState<PagoTemporal | undefined>();

  // Estado para órdenes de copiado asociadas
  const [ordenesCopiadoAsociadas, setOrdenesCopiadoAsociadas] = useState<any[]>([]);

  const { updateStepComment, countAllComments } = useItemRoutesComments({
    items,
    setItems,
  });


  // Hook para obtener clientes
  const { clients } = useClients({ page: 1, itemsPerPage: 1000 });
  // En modo edición, si el cliente no está en la lista inicial, deberíamos asegurarnos de cargarlo
  // o confiar en que la lista es suficiente. Por simplicidad asumimos que está en los top 1000.
  const clienteSeleccionado = clients.find((c) => c.id === clienteId);

  const resetFormulario = () => {
    setActiveTab('items');
    setClienteId('');
    setCanalVenta('Mostrador');
    setFechaEntrega('');
    setNotasInternas('');
    setRequiereFactura(false);
    setItems([]);
    setDescuentoTotal(0);
    setFormErrors({});
    setOrdenCreada(false);
    setPagos([]);
    setShowPagoForm(false);
    setEditingPago(undefined);
    setOrdenesCopiadoAsociadas([]);
  };

  // Carga inicial (Nuevo o Edición)
  useEffect(() => {
    if (isEditing && id) {
      loadOrderData(id);
    } else {
      resetFormulario();
    }
  }, [id, isEditing]);

  const loadOrderData = async (orderId: string) => {
    setIsLoadingData(true);
    try {
      const orden = await getOrdenById(orderId);
      if (!orden) {
        showError('No se encontró la orden');
        navigate('/app/orders/ordenes');
        return;
      }

      setClienteId(orden.cliente_id);
      setCanalVenta(orden.canal_venta || 'Mostrador');
      setFechaEntrega(orden.fecha_estimada_entrega ? orden.fecha_estimada_entrega.split('T')[0] : '');
      setNotasInternas(orden.notas_internas || '');
      setRequiereFactura(orden.requiere_factura || false);

      // Calcular descuento % basado en total y descuentos $
      const totalSinDescuento = (orden.subtotal || 0); // Aproximación básica
      const descuentoPorcentaje = totalSinDescuento > 0 ? ((orden.total_descuentos || 0) / totalSinDescuento) * 100 : 0;
      setDescuentoTotal(Math.round(descuentoPorcentaje * 100) / 100);

      // Mapear Items
      const mappedItems = (orden.items || []).map(item => ({
        ...item,
        id: item.id, // Importante para updates
        // Aseguramos que la config esté presente
        configuracion: item.configuracion || {},
        rutas_generadas: (item as any).rutas || [] // Cargar rutas para visualizar en edición
      }));

      // Mapear Servicios Adicionales como Items de Cobro
      const mappedServices = (orden.servicios || []).map(servicio => ({
        id: servicio.id, // Importante
        es_servicio_cobro: true,
        tipo_item: 'personalizado',
        producto_nombre: servicio.descripcion,
        cantidad: servicio.cantidad,
        precio_unitario_final: servicio.precio_unitario,
        precio_total: servicio.subtotal,
        precio_base: servicio.precio_unitario, // Asumido
        precio_servicios: 0,
        precio_acabados: 0,
        servicio_id: servicio.servicio_id // Para mantener referencia original
      }));

      setItems([...mappedItems, ...mappedServices]);

      // Mapear Pagos
      if (orden.pagos) {
        setPagos(orden.pagos.map(p => ({
          id: p.id,
          fecha_pago: p.fecha_pago,
          monto: p.monto,
          medio_cobro_id: p.medio_cobro_id || '',
          referencia_pago: p.referencia_pago || '',
          notas: p.notas || ''
        })));
      }

      // TODO: Cargar órdenes de copiado asociadas si aplica
      // Actualmente getOrdenById trae 'ordenCopiado' pero solo una vinculada directamente por campo?
      // La estructura actual parece soportar múltiples en UI, pero la DB usa tabla intermedia o FK.
      // Asumiremos que por ahora no se editan las asociaciones de copiado en este flujo complejo.

    } catch (err) {
      console.error('Error loading order:', err);
      showError('Error al cargar la orden');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Cleanup al cerrar pestaña o refrescar página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Si hay cambios sin guardar y orden no creada
      if (!ordenCreada && formularioTieneDatos()) {
        // Mostrar prompt nativo del navegador
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [ordenCreada]);

  const isCreatingOrderRef = useRef(false);

  const formularioTieneDatos = () => {
    return clienteId !== '' || items.length > 0 || notasInternas !== '' || fechaEntrega !== '' || ordenesCopiadoAsociadas.length > 0;
  };

  const { showPrompt, isPromptOpen, closePrompt, confirmPrompt } = usePrompt(
    '¿Estás seguro de que deseas salir? Se perderán los cambios no guardados.',
    !ordenCreada && formularioTieneDatos()
  );

  const handleVolver = async () => {
    if (formularioTieneDatos() && !ordenCreada) {
      showPrompt(async () => {
        navigate('/app/orders/ordenes');
      });
      return;
    }
    navigate('/app/orders/ordenes');
  };

  const calcularTotales = () => {
    const subtotalItems = items.reduce((sum, item) => sum + item.precio_total, 0);
    const subtotalOrdenesCopiad = ordenesCopiadoAsociadas.reduce((sum, oc) => sum + oc.total, 0);
    const subtotal = subtotalItems + subtotalOrdenesCopiad;
    const descuentoAplicado = subtotal * (descuentoTotal / 100);
    const subtotalConDescuento = subtotal - descuentoAplicado;
    const iva = requiereFactura ? subtotalConDescuento * 0.21 : 0;
    const total = subtotalConDescuento + iva;

    return {
      subtotal,
      descuentoAplicado,
      subtotalConDescuento,
      iva,
      total,
    };
  };

  const calcularSaldoPendiente = () => {
    const totales = calcularTotales();
    const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
    return totales.total - totalPagado;
  };

  // Funciones para gestión de pagos
  const handleAgregarPago = () => {
    setEditingPago(undefined);
    setShowPagoForm(true);
  };

  const handleGuardarPago = (data: Omit<PagoTemporal, 'id'>) => {
    if (editingPago) {
      // Editar pago existente
      setPagos(prev => prev.map(p =>
        p.id === editingPago.id
          ? { ...data, id: editingPago.id }
          : p
      ));
      showSuccess('Pago actualizado correctamente');
    } else {
      // Agregar nuevo pago
      const nuevoPago: PagoTemporal = {
        ...data,
        id: crypto.randomUUID(),
      };
      setPagos(prev => [...prev, nuevoPago]);
      showSuccess('Pago registrado correctamente');
    }
    setShowPagoForm(false);
    setEditingPago(undefined);
  };

  const handleEditarPago = (pago: PagoTemporal) => {
    setEditingPago(pago);
    setShowPagoForm(true);
  };

  const handleEliminarPago = (id: string) => {
    setPagos(prev => prev.filter(p => p.id !== id));
    showSuccess('Pago eliminado correctamente');
  };

  const validarFormulario = (): boolean => {
    const errores: Record<string, string> = {};

    if (!clienteId) {
      errores.cliente = 'Debe seleccionar un cliente';
    }

    if (items.length === 0 && ordenesCopiadoAsociadas.length === 0) {
      errores.items = 'Debe agregar al menos un item o una orden de copiado a la orden';
    }

    if (!fechaEntrega) {
      errores.fechaEntrega = 'La fecha de entrega es obligatoria';
    } else {
      // Comparar fechas como strings en formato YYYY-MM-DD
      // Esto evita problemas de zona horaria y es lexicográficamente correcto
      const hoy = new Date();
      const hoyStr = hoy.toISOString().split('T')[0];

      // En edición permitimos fechas anteriores si la orden ya existe
      if (!isEditing && fechaEntrega < hoyStr) {
        errores.fechaEntrega = 'La fecha de entrega no puede ser anterior a hoy';
      }
    }

    setFormErrors(errores);
    return Object.keys(errores).length === 0;
  };

  const handleCrearOrden = async () => {
    if (!validarFormulario()) {
      alert('Por favor, complete todos los campos requeridos');
      return;
    }

    if (!profile?.company_id) {
      showError('Error: No se pudo obtener la información del usuario. Por favor, recarga la página.');
      console.error('[CreateOrderPage] profile no disponible:', { profile });
      return;
    }

    // Marcar que estamos creando orden para prevenir cleanup
    isCreatingOrderRef.current = true;
    console.log('[CreateOrderPage] Iniciando proceso (cleanup deshabilitado)');

    const totales = calcularTotales();

    const ordenData = {
      cliente_id: clienteId,
      canal_venta: canalVenta,
      fecha_estimada_entrega: fechaEntrega,
      notas_internas: notasInternas || undefined,
      // Totales calculados
      subtotal: totales.subtotal,
      total_descuentos: totales.descuentoAplicado,
      total: totales.total,
      // Facturación
      requiere_factura: requiereFactura,
      subtotal_iva: totales.iva,
    };

    // Separar items físicos de servicios adicionales
    const itemsFisicos = items.filter(i => !i.es_servicio_cobro);
    const serviciosAdicionales = items.filter(i => i.es_servicio_cobro);

    // Preparar el payload unificado
    const payload = {
      ordenData,
      items: itemsFisicos.map(item => ({
        id: item.id, // Importante para updates
        tipo_item: item.tipo_item || 'catalogo',
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        producto_categoria: item.producto_categoria || item.categoria || 'Sin categoría',
        descripcion: item.descripcion || null,
        tiempo_produccion_dias: item.tiempo_produccion_dias || null,
        cantidad: item.cantidad,
        configuracion: item.configuracion,
        precio_base: item.precio_base,
        precio_servicios: item.precio_servicios,
        precio_acabados: item.precio_acabados,
        precio_unitario_final: item.precio_unitario_final,
        precio_total: item.precio_total,
        rutas_generadas: (item as any).rutas_generadas || [], // Incluir rutas pregeneradas
      })),
      servicios: serviciosAdicionales.map(s => ({
        descripcion: s.producto_nombre,
        cantidad: s.cantidad,
        precio_unitario: s.precio_unitario_final,
        subtotal: s.precio_total,
        servicio_id: null // No tenemos el ID del servicio original mapeado en este nivel por ahora
      })),
      estadoInicial: 'pendiente' as any,
    };

    let result;

    if (isEditing && id) {
      // MODO EDICIÓN
      result = await updateOrdenCompleta(id, payload);

      if (result) {
        showSuccess('Orden actualizada exitosamente');
        // Navegar
        setTimeout(() => {
          navigate('/app/orders/ordenes');
        }, 500);
      } else {
        showError(`Error al actualizar la orden: ${error}`);
        isCreatingOrderRef.current = false;
      }
    } else {
      // MODO CREACIÓN
      result = await createOrdenConItems(payload);

      if (result) {
        console.log('[CreateOrderPage] Orden creada exitosamente:', result.id);

        try {
          console.log('[CreateOrderPage] Orden creada, ahora se pueden agregar links desde el detalle de la orden');

          // Insertar pagos si existen
          if (pagos.length > 0) {
            console.log('[CreateOrderPage] Insertando pagos:', pagos.length);

            const pagosInserts = pagos.map(pago => ({
              orden_id: result.id,
              fecha_pago: pago.fecha_pago,
              monto: pago.monto,
              medio_cobro_id: pago.medio_cobro_id,
              referencia_pago: pago.referencia_pago || null,
              notas: pago.notas || null,
              created_by: profile.id,
            }));

            const { error: pagosError } = await supabase
              .from('ordenes_trabajo_pagos')
              .insert(pagosInserts);

            if (pagosError) {
              console.error('[CreateOrderPage] Error insertando pagos:', pagosError);
              showError('Orden creada pero hubo un error al registrar los pagos');
            } else {
              console.log('[CreateOrderPage] Pagos insertados exitosamente');
            }
          }

          // Crear órdenes de copiado asociadas logic... (Mismo código anterior)
          if (ordenesCopiadoAsociadas.length > 0) {
            // ... (Lógica de OCs existente)
            // Por brevedad mantengo la lógica pero simplificada en este bloque
            // En un refactor real debería extraerse a una función separada
            for (const oc of ordenesCopiadoAsociadas) {
              try {
                const nuevaOrdenCopiado = await createOrdenCopiado({
                  cliente_id: clienteId,
                  orden_trabajo_id: result.id,
                  fecha_entrega_estimada: oc.fecha_entrega_estimada ? `${oc.fecha_entrega_estimada}T00:00:00` : undefined,
                  observaciones: oc.observaciones || undefined,
                });

                if (nuevaOrdenCopiado) {
                  await supabase.from('centro_copiado_ordenes').update({ total: oc.total }).eq('id', nuevaOrdenCopiado.id);

                  for (const item of oc.items) {
                    await supabase.from('centro_copiado_ordenes_items').insert({
                      orden_copiado_id: nuevaOrdenCopiado.id,
                      // ... mapeo de campos ...
                      tipo_item: 'impresion',
                      tamanio_papel_id: item.config.tamanio_papel_id,
                      papel_id: item.config.papel_id,
                      tipo_tinta: item.config.tipo_tinta,
                      cara_impresa: item.config.cara_impresa,
                      cantidad_hojas: item.config.cantidad_hojas,
                      cantidad_unidades: item.config.cantidad_copias,
                      precio_unitario: item.precio || 0,
                      subtotal: item.precio || 0,
                      descripcion: item.descripcion || null
                    });
                  }
                }
              } catch (err) { console.error(err); }
            }
            // Recalculo final
            await supabase.rpc('fn_recalcular_total_orden_trabajo', { p_orden_trabajo_id: result.id });
          }

          // Limpiar sessionStorage
          sessionStorage.removeItem('ordenTemporalCreacion');

          // Marcar orden como creada ANTES de navegar
          setOrdenCreada(true);
          isCreatingOrderRef.current = false;
          console.log('[CreateOrderPage] Orden creada exitosamente, cleanup permanentemente deshabilitado');

          // Mostrar mensaje de éxito
          const saldoPendiente = calcularSaldoPendiente();
          let mensajeExito = 'Orden creada exitosamente';

          if (pagos.length > 0) {
            mensajeExito += ` con ${pagos.length} pago(s) registrado(s)`;
            if (saldoPendiente > 0) {
              mensajeExito += ` (Saldo pendiente: $${saldoPendiente.toFixed(2)})`;
            }
          }

          showSuccess(mensajeExito);

          // Enviar notificación de WhatsApp vía Edge Function (no bloqueante)
          if (profile?.company_id && result.id) {
            supabase.functions.invoke('enviar-notificacion-orden', {
              body: {
                orden_id: result.id,
                company_id: profile.company_id,
                tipo: 'nueva_orden_trabajo',
                orden_tipo: 'trabajo',
                frontend_origin: window.location.origin
              }
            }).catch((err) => {
              console.error('[CreateOrderPage] Error al invocar Edge Function:', err);
            });
          }

          // Navegar
          setTimeout(() => {
            navigate('/app/orders/ordenes');
          }, 500);
        } catch (err: any) {
          console.error('[CreateOrderPage] Error post-creación:', err);
          showError(`Orden creada pero con advertencias: ${err.message}`);
          isCreatingOrderRef.current = false;
        }
      } else {
        showError(`Error al crear la orden: ${error || 'Error desconocido'}`);
        isCreatingOrderRef.current = false;
      }
    }
  };

  const totalComentarios = countAllComments();

  // Calcular total de rutas de producción
  // Una ruta = un item (cada item tiene una ruta que incluye múltiples etapas/pasos)
  const totalRutas = items.filter(item =>
    Array.isArray(item.rutas_generadas) && item.rutas_generadas.length > 0
  ).length;

  const tabs = [
    {
      id: 'items',
      label: 'Items',
      count: items.length,
    },
    {
      id: 'rutas',
      label: 'Rutas de Producción',
      count: totalRutas,
      disabled: items.length === 0,
      badge: totalComentarios > 0 ? totalComentarios : undefined,
    },
    {
      id: 'adjuntos',
      label: 'Adjuntos',
      disabled: false,
    },
    {
      id: 'pagos',
      label: 'Pagos',
      count: pagos.length,
      disabled: false,
    },
    {
      id: 'historial',
      label: 'Historial',
      disabled: true,
    },
  ];

  const totales = calcularTotales();

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Cargando datos de la orden...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-32">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={handleVolver}>
            <ArrowLeft className="w-4 h-4" />
            Volver a órdenes
          </Button>

          <Button
            onClick={handleCrearOrden}
            disabled={loading || items.length === 0 || !clienteId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditing ? 'Guardando...' : 'Creando...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Guardar Cambios' : 'Crear Orden'}
              </>
            )}
          </Button>
        </div>

        <Card>
          <OrdenGeneralSection
            clienteId={clienteId}
            setClienteId={setClienteId}
            canalVenta={canalVenta}
            setCanalVenta={setCanalVenta}
            fechaEntrega={fechaEntrega}
            setFechaEntrega={setFechaEntrega}
            notasInternas={notasInternas}
            setNotasInternas={setNotasInternas}
            requiereFactura={requiereFactura}
            setRequiereFactura={setRequiereFactura}
            usuarioLogueado={profile?.full_name || 'Usuario'}
            errors={formErrors}
          />
        </Card>

        <Card>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="p-6">
            <div className={activeTab === 'items' ? 'block' : 'hidden'}>
              <OrdenItemsTab
                items={items}
                setItems={setItems}
                descuentoTotal={descuentoTotal}
                setDescuentoTotal={setDescuentoTotal}
                requiereFactura={requiereFactura}
                setRequiereFactura={setRequiereFactura}
                clienteNombre={clienteSeleccionado?.nombre_fantasia || ''}
                ordenesCopiadoAsociadas={ordenesCopiadoAsociadas}
                onOrdenesCopiadoAsociadasChange={setOrdenesCopiadoAsociadas}
              />
            </div>

            <div className={activeTab === 'pagos' ? 'block' : 'hidden'}>
              <OrdenPagosTab
                totales={totales}
                pagos={pagos}
                onAgregarPago={handleAgregarPago}
                onEditarPago={handleEditarPago}
                onEliminarPago={handleEliminarPago}
                readOnly={false}
              />
            </div>

            <div className={activeTab === 'rutas' ? 'block' : 'hidden'}>
              <OrdenRutasTab
                items={items}
                setItems={setItems}
                onUpdateStepComment={updateStepComment}
                readOnly={false}
              />
            </div>

            <div className={activeTab === 'adjuntos' ? 'block' : 'hidden'}>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <LinkIcon className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  {isEditing ? 'Links disponibles en detalle' : 'Links no disponibles en creación'}
                </h3>
                <p className="text-blue-700 text-sm">
                  {isEditing
                    ? 'Para gestionar links adjuntos, ve al detalle de la orden.'
                    : 'Los links externos se pueden agregar después de crear la orden.'}
                </p>
              </div>
            </div>

            <div className={activeTab === 'historial' ? 'block' : 'hidden'}>
              <OrdenHistorialTab eventos={[]} />
            </div>
          </div>
        </Card>

        <OrdenFooterTotales
          subtotal={totales.subtotal}
          descuentoAplicado={totales.descuentoAplicado}
          iva={totales.iva}
          total={totales.total}
          requiereFactura={requiereFactura}
          totalPagado={pagos.reduce((sum, p) => sum + p.monto, 0)}
          mostrarSaldo={pagos.length > 0}
          subtotalItems={items.reduce((sum, item) => sum + item.precio_total, 0)}
          subtotalOrdenesCopiado={ordenesCopiadoAsociadas.reduce((sum, oc) => sum + oc.total, 0)}
        />
      </div>

      <PagoFormModal
        isOpen={showPagoForm}
        onClose={() => {
          setShowPagoForm(false);
          setEditingPago(undefined);
        }}
        onSubmit={handleGuardarPago}
        saldoPendiente={calcularSaldoPendiente()}
        pago={editingPago}
      />

      <ConfirmDialog
        isOpen={isPromptOpen}
        onClose={closePrompt}
        onConfirm={confirmPrompt}
        title="Cambios sin guardar"
        message="¿Estás seguro de que deseas salir? Se perderán todos los cambios no guardados en esta orden de trabajo."
        confirmText="Salir sin guardar"
        cancelText="Continuar editando"
        variant="warning"
        icon={<AlertTriangle className="w-6 h-6" />}
      />
    </>
  );
}
