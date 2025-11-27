import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
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
import { useOrdenArchivos } from '../../../hooks/useOrdenArchivos';
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
  const { profile } = useAuth();
  const { createOrdenConItems, loading, error } = useOrdenTrabajo();
  const { showSuccess, showError } = useToast();
  const { createOrden: createOrdenCopiado } = useCentroCopiadoOrdenes({});

  usePageHeader('Crear nueva orden de trabajo');

  const [ordenTemporalId] = useState(() => {
    // Intentar recuperar UUID existente para mantener adjuntos al cambiar de tab
    const existingId = sessionStorage.getItem('ordenTemporalCreacion');

    if (existingId) {
      return existingId;
    }

    // Si no existe, generar nuevo UUID
    const newId = crypto.randomUUID();
    sessionStorage.setItem('ordenTemporalCreacion', newId);
    return newId;
  });

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

  // Hooks para adjuntos temporales
  const archivosTemp = useOrdenArchivos({ ordenTemporalId });
  const linksTemp = useOrdenLinks({ ordenTemporalId });

  // Hook para obtener clientes
  const { clients } = useClients({ page: 1, itemsPerPage: 1000 });
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

  useEffect(() => {
    resetFormulario();
  }, []);

  // Cleanup al cerrar pestaña o refrescar página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Si hay cambios sin guardar y orden no creada
      if (!ordenCreada && formularioTieneDatos()) {
        // Mostrar prompt nativo del navegador
        e.preventDefault();
        e.returnValue = '';

        // Intentar cleanup asíncrono en background
        Promise.all([
          archivosTemp.limpiarTemporales(),
          linksTemp.limpiarTemporales()
        ]).then(() => {
          sessionStorage.removeItem('ordenTemporalCreacion');
        }).catch(err => {
          console.error('[Cleanup] Error limpiando al cerrar:', err);
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [ordenCreada, archivosTemp, linksTemp]);

  // Cleanup al desmontar componente (navegación)
  // IMPORTANTE: Usar useRef para rastrear si estamos creando orden
  const isCreatingOrderRef = useRef(false);

  useEffect(() => {
    return () => {
      // Solo limpiar si:
      // 1. La orden NO fue creada exitosamente
      // 2. NO estamos en proceso de crear la orden
      if (!ordenCreada && !isCreatingOrderRef.current) {
        Promise.all([
          archivosTemp.limpiarTemporales(),
          linksTemp.limpiarTemporales()
        ]).then(() => {
          sessionStorage.removeItem('ordenTemporalCreacion');
        }).catch(err => {
          console.error('[Cleanup] Error limpiando al desmontar:', err);
        });
      }
    };
  }, []);

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
        // Limpiar adjuntos temporales
        try {
          await Promise.all([
            archivosTemp.limpiarTemporales(),
            linksTemp.limpiarTemporales()
          ]);
          sessionStorage.removeItem('ordenTemporalCreacion');
        } catch (err) {
          console.error('Error limpiando temporales:', err);
        }
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

    if (fechaEntrega) {
      const fecha = new Date(fechaEntrega);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      if (fecha < hoy) {
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
    console.log('[CreateOrderPage] Iniciando creación de orden (cleanup deshabilitado)');

    console.log('[CreateOrderPage] Creando orden con datos:', {
      clienteId,
      itemsCount: items.length,
      ordenTemporalId,
      profileId: profile.id,
      companyId: profile.company_id
    });

    const totales = calcularTotales();

    const ordenData = {
      cliente_id: clienteId,
      canal_venta: canalVenta,
      fecha_estimada_entrega: fechaEntrega || undefined,
      notas_internas: notasInternas || undefined,
    };

    const result = await createOrdenConItems({
      ordenData,
      items: items.map(item => ({
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        producto_categoria: item.producto_categoria || item.categoria || 'Sin categoría',
        cantidad: item.cantidad,
        configuracion: item.configuracion,
        precio_base: item.precio_base,
        precio_servicios: item.precio_servicios,
        precio_acabados: item.precio_acabados,
        precio_unitario_final: item.precio_unitario_final,
        precio_total: item.precio_total,
        rutas_generadas: (item as any).rutas_generadas || [], // Incluir rutas pregeneradas
      })),
      estadoInicial: 'pendiente',
    });

    if (result) {
      console.log('[CreateOrderPage] Orden creada exitosamente:', result.id);

      try {
        console.log('[CreateOrderPage] Iniciando asociación de adjuntos con función SQL...');

        // La función SQL maneja todo: archivos + links + archivos producción
        // Solo necesitamos llamarla una vez desde cualquier hook
        const resultAsociacion = await archivosTemp.asociarConOrden(
          result.id,
          ordenTemporalId,
          profile.company_id
        );

        console.log('[CreateOrderPage] Adjuntos asociados exitosamente:', {
          archivos: resultAsociacion.count,
          archivosProduccion: resultAsociacion.countProduccion,
          links: resultAsociacion.countLinks
        });

        const totalAdjuntos = (resultAsociacion.count || 0) +
                              (resultAsociacion.countProduccion || 0) +
                              (resultAsociacion.countLinks || 0);

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

        // Crear órdenes de copiado asociadas
        if (ordenesCopiadoAsociadas.length > 0) {
          console.log('[CreateOrderPage] Creando órdenes de copiado asociadas:', ordenesCopiadoAsociadas.length);

          for (const oc of ordenesCopiadoAsociadas) {
            try {
              // Crear orden de copiado usando el hook (genera numero_orden automáticamente)
              const nuevaOrdenCopiado = await createOrdenCopiado({
                cliente_id: clienteId,
                orden_trabajo_id: result.id,
                fecha_entrega_estimada: oc.fecha_entrega_estimada
                  ? `${oc.fecha_entrega_estimada}T00:00:00`
                  : undefined,
                observaciones: oc.observaciones || undefined,
              });

              if (!nuevaOrdenCopiado) {
                console.error('[CreateOrderPage] Error creando orden de copiado');
                showError('Error al crear orden de copiado');
                continue;
              }

              // Actualizar el total de la orden de copiado
              const { error: errorUpdateTotal } = await supabase
                .from('centro_copiado_ordenes')
                .update({ total: oc.total })
                .eq('id', nuevaOrdenCopiado.id);

              if (errorUpdateTotal) {
                console.error('[CreateOrderPage] Error actualizando total de orden de copiado:', errorUpdateTotal);
              }

              // Crear items de la orden de copiado
              for (const item of oc.items) {
                const itemData = {
                  orden_copiado_id: nuevaOrdenCopiado.id,
                  tipo_item: 'impresion',
                  tamanio_papel_id: item.config.tamanio_papel_id,
                  papel_id: item.config.papel_id,
                  tipo_tinta: item.config.tipo_tinta,
                  cara_impresa: item.config.cara_impresa,
                  cantidad_hojas: item.config.cantidad_hojas,
                  cantidad_unidades: item.config.cantidad_copias,
                  tipo_anillado: item.config.anillado?.tipo || null,
                  tipo_plastificado: item.config.plastificado?.tipo || null,
                  cantidad_plastificado: item.config.plastificado?.todas_hojas
                    ? item.config.cantidad_hojas
                    : (item.config.plastificado?.cantidad_especifica || null),
                  precio_unitario: item.precio || 0,
                  subtotal: item.precio || 0,
                  descripcion: item.descripcion || null,
                };

                const { error: errorItem } = await supabase
                  .from('centro_copiado_ordenes_items')
                  .insert(itemData);

                if (errorItem) {
                  console.error('[CreateOrderPage] Error creando item de orden de copiado:', errorItem);
                }
              }

              console.log('[CreateOrderPage] Orden de copiado creada exitosamente:', nuevaOrdenCopiado.numero_orden);
            } catch (err) {
              console.error('[CreateOrderPage] Error procesando orden de copiado:', err);
            }
          }
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

        if (totalAdjuntos > 0) {
          mensajeExito += ` y ${totalAdjuntos} adjunto(s)`;
        }

        showSuccess(mensajeExito);

        // Navegar
        setTimeout(() => {
          navigate('/app/orders/ordenes');
        }, 500);
      } catch (err: any) {
        console.error('[CreateOrderPage] Error al asociar adjuntos:', err);
        showError(`Error al asociar adjuntos: ${err.message}`);
        // Permitir cleanup en caso de error
        isCreatingOrderRef.current = false;
      }
    } else {
      showError(`Error al crear la orden: ${error || 'Error desconocido'}`);
      // Permitir cleanup en caso de error
      isCreatingOrderRef.current = false;
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
                Creando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Crear Orden
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
              onUpdateStepComment={updateStepComment}
              readOnly={false}
            />
          </div>

          <div className={activeTab === 'adjuntos' ? 'block' : 'hidden'}>
            <OrdenAdjuntosTab
              ordenTemporalId={ordenTemporalId}
              estado="pendiente"
              modoCreacion={true}
            />
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
