import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertTriangle, Link as LinkIcon,
  Settings,
  Share2,
  Copy,
  Check,
  Download,
  Server,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
} from 'lucide-react';
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
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { useClientes } from '../../../hooks/useClientes';
import { useProfile } from '../../../hooks/useProfile';
import { usePresupuestos } from '../../../hooks/usePresupuestos';
import { OrdenProductionRouteTab } from '../../../components/orders/OrdenProductionRouteTab';
import { ClientesSelector } from '../../../components/orders/ClientesSelector';
import { OrdenCopiadoAsociadaCard } from '../../../components/orders/OrdenCopiadoAsociadaCard';
import { calcularTotalesConsolidados } from '../../../utils/ordenesConsolidadas';
import { generarDescripcionCopiado } from '../../../utils/ordenesHelpers';

// Tipos
import type {
  Departamento,
  Prioridad,
  EstadoOrdenTrabajo,
  ItemOrdenTrabajo,
  OrdenTrabajoPago,
} from '../../../types/database';
import { crearOrdenCopiado } from '../../../utils/ordenesCopiado';

interface PagoTemporal {
  id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago?: string;
  notas?: string;
}

interface CreateOrderPageProps {
  initialData?: any; // Para modo edición
}

type LinkType = 'download' | 'internal';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // ID de orden para editar
  const isEditing = Boolean(id);

  const { profile } = useAuth();
  const { createOrdenConItems, updateOrdenCompleta, getOrdenById, error: ordenError } = useOrdenTrabajo();
  const { showSuccess, showError } = useToast();
  const { createOrden: createOrdenCopiado } = useCentroCopiadoOrdenes({});
  const { getPresupuestoById } = usePresupuestos();

  usePageHeader(isEditing ? 'Editar Orden de Trabajo' : 'Crear nueva orden de trabajo');


  const [activeTab, setActiveTab] = useState('items');
  const [isLoading, setIsLoading] = useState(false);


  // Estados para Links
  const [links, setLinks] = useState<{ titulo: string; url: string; descripcion: string }[]>([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [newLink, setNewLink] = useState({ titulo: '', url: '', descripcion: '' });
  const [linkType, setLinkType] = useState<LinkType>('download');
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);

  const formatUrl = (url: string, type: LinkType): string => {
    const trimmedUrl = url.trim();
    if (type === 'download') {
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        return `https://${trimmedUrl}`;
      }
    }
    return trimmedUrl;
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('Link copiado al portapapeles');
    } catch (err) {
      console.error('Error copying link:', err);
      showError('No se pudo copiar el link');
    }
  };

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const [clienteId, setClienteId] = useState('');
  const [canalVenta, setCanalVenta] = useState<CanalVenta>('Mostrador');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [requiereFactura, setRequiereFactura] = useState(true);
  const [requiereDespacho, setRequiereDespacho] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [descuentoTotal, setDescuentoTotal] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [ordenCreada, setOrdenCreada] = useState(false);
  const [ordenCreadaId, setOrdenCreadaId] = useState<string | null>(null); // State for ID
  const [showPagoModal, setShowPagoModal] = useState(false); // Helper for post-creation payment
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
    setRequiereFactura(true);
    setRequiereDespacho(false);
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
      setRequiereDespacho(orden.requiere_despacho || false);

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

      // Cargar órdenes de copiado asociadas si aplica
      if (orden.ordenCopiado) {
        setOrdenesCopiadoAsociadas([orden.ordenCopiado]);
      }

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

  const handlePagoSubmit = async (data: any) => {
    if (!ordenCreadaId) return;

    const success = await addPago(ordenCreadaId, data);
    if (success) {
      showSuccess('Pago registrado correctamente');
      navigate('/app/orders/ordenes');
    } else {
      showError('Error al registrar el pago');
    }
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
    setIsLoading(true);
    console.log('[CreateOrderPage] Iniciando proceso (cleanup deshabilitado)');

    const totales = calcularTotales();

    const ordenData = {
      cliente_id: clienteId,
      canal_venta: canalVenta,
      fecha_estimada_entrega: fechaEntrega ? `${fechaEntrega}T12:00:00` : null,
      notas_internas: notasInternas || undefined,
      // Totales calculados
      subtotal: totales.subtotal,
      total_descuentos: totales.descuentoAplicado,
      total: totales.total,
      // Facturación
      requiere_factura: requiereFactura,
      subtotal_iva: totales.iva,
      requiere_despacho: requiereDespacho,
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
        descripcion: item.descripcion || (item.tipo_item === 'centro_copiado' || item.categoria_id === 'centro_copiado' ? generarDescripcionCopiado(item.configuracion) : null),
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
        setOrdenCreada(true); // Evitar prompt de cambios sin guardar
        // Navegar
        setTimeout(() => {
          navigate('/app/orders/ordenes');
        }, 500);
      } else {
        showError(`Error al actualizar la orden: ${error}`);
        isCreatingOrderRef.current = false;
        setIsLoading(false);
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
            }
          }

          // Insertar links si existen
          if (links.length > 0) {
            console.log('[CreateOrderPage] Insertando links:', links.length);
            const linksInserts = links.map(link => ({
              orden_id: result.id,
              company_id: profile.company_id,
              titulo: link.titulo,
              url: link.url,
              descripcion: link.descripcion || null,
              created_by: profile.id
            }));

            const { error: linksError } = await supabase
              .from('ordenes_trabajo_links')
              .insert(linksInserts);

            if (linksError) {
              console.error('[CreateOrderPage] Error insertando links:', linksError);
              showError('Error al guardar algunos links');
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
                  origen: canalVenta, // Heredar canal de venta de la OT
                  orden_trabajo_id: result.id,
                  fecha_entrega_estimada: oc.fecha_entrega_estimada ? `${oc.fecha_entrega_estimada}T12:00:00` : undefined,
                  observaciones: oc.observaciones || undefined,
                  requiere_factura: requiereFactura, // Propagar estado de facturación de la OT
                });

                if (nuevaOrdenCopiado) {
                  // Calcular total con IVA si aplica
                  const totalItems = oc.total || 0; // Este es el neto sumado de items
                  const totalConIva = requiereFactura ? totalItems * 1.21 : totalItems;

                  await supabase.from('centro_copiado_ordenes').update({ total: totalConIva }).eq('id', nuevaOrdenCopiado.id);

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
          if (result) {
            setOrdenCreada(true);
            setOrdenCreadaId(result.id); // Save ID
            // setShowPagoModal(true); // Removed to prevent flash before redirect
          }
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
          setIsLoading(false);
        }
      } else {
        showError(`Error al crear la orden: ${ordenError || 'Error desconocido'}`);
        isCreatingOrderRef.current = false;
        setIsLoading(false);
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
      label: 'Links',
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
            disabled={isLoading || items.length === 0 || !clienteId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
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
            selectedClient={clienteSeleccionado}
            canalVenta={canalVenta}
            setCanalVenta={setCanalVenta}
            fechaEntrega={fechaEntrega}
            setFechaEntrega={setFechaEntrega}
            requiereDespacho={requiereDespacho}
            setRequiereDespacho={setRequiereDespacho}
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
              <div className="space-y-6">
                {/* Acciones */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 font-medium">
                    Links externos y rutas de archivos
                  </span>

                  <Button onClick={() => {
                    setLinkType('download');
                    setEditingLinkIndex(null);
                    setNewLink({ titulo: '', url: '', descripcion: '' });
                    setLinkModalOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Link
                  </Button>
                </div>

                {/* Lista de links locales */}
                {links.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <LinkIcon className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      No hay links agregados. Agrega archivos de WeTransfer, Drive o rutas de red interna.
                    </p>
                  </div>
                ) : (
                  <Card>
                    <div className="divide-y divide-gray-200">
                      {links.map((link, index) => {
                        const isInternal = !/^https?:\/\//i.test(link.url);
                        return (
                          <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isInternal ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                {isInternal ? (
                                  <Server className="w-6 h-6 text-amber-600" />
                                ) : (
                                  <Download className="w-6 h-6 text-blue-600" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {link.titulo}
                                  </h4>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${isInternal ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {isInternal ? 'Interno / Red' : 'Descarga'}
                                  </span>
                                </div>

                                {/* URL Display */}
                                <div className="flex items-center gap-2 mb-1">
                                  {isInternal ? (
                                    <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded truncate select-all">
                                      {link.url}
                                    </span>
                                  ) : (
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline truncate"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {link.url}
                                    </a>
                                  )}
                                </div>

                                {link.descripcion && (
                                  <p className="text-xs text-gray-600 mt-1 italic truncate">
                                    {link.descripcion}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {!isInternal && (
                                  <Button size="sm" variant="outline" onClick={() => openLink(link.url)} title="Abrir Link">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => handleCopyLink(link.url)} title="Copiar Link">
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                  setEditingLinkIndex(index);
                                  setNewLink(link);
                                  setLinkType(isInternal ? 'internal' : 'download');
                                  setLinkModalOpen(true);
                                }} title="Editar Link">
                                  <Pencil className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const newLinks = [...links];
                                    newLinks.splice(index, 1);
                                    setLinks(newLinks);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Eliminar Link"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>

              {/* Modal Agregar Link Local */}
              <Modal
                isOpen={linkModalOpen}
                onClose={() => {
                  setLinkModalOpen(false);
                  setNewLink({ titulo: '', url: '', descripcion: '' });
                }}
                title={editingLinkIndex !== null ? "Editar Link" : "Agregar Link"}
              >
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Link</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="linkType"
                          checked={linkType === 'download'}
                          onChange={() => setLinkType('download')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Download className="w-4 h-4" />
                          <span>Link de descarga (Web)</span>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="linkType"
                          checked={linkType === 'internal'}
                          onChange={() => setLinkType('internal')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Server className="w-4 h-4" />
                          <span>Link interno (Red Local)</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <Input
                    label="Título"
                    value={newLink.titulo}
                    onChange={(e) => setNewLink({ ...newLink, titulo: e.target.value })}
                    placeholder={linkType === 'download' ? "Ej: Archivos en WeTransfer" : "Ej: Carpeta de Producción"}
                    required
                  />
                  <Input
                    label={linkType === 'download' ? "URL de Descarga" : "Ruta de Carpeta/Archivo"}
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    placeholder={linkType === 'download' ? "ejemplo.com" : "\\\\servidor\\carpeta"}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción (opcional)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={newLink.descripcion}
                      onChange={(e) => setNewLink({ ...newLink, descripcion: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={() => {
                      setLinkModalOpen(false);
                      setEditingLinkIndex(null);
                      setNewLink({ titulo: '', url: '', descripcion: '' });
                    }}>Cancelar</Button>
                    <Button onClick={() => {
                      if (!newLink.titulo.trim() || !newLink.url.trim()) return;

                      const formattedUrl = formatUrl(newLink.url, linkType);
                      const linkData = { ...newLink, url: formattedUrl };

                      if (editingLinkIndex !== null) {
                        const updatedLinks = [...links];
                        updatedLinks[editingLinkIndex] = linkData;
                        setLinks(updatedLinks);
                      } else {
                        setLinks([...links, linkData]);
                      }

                      setLinkModalOpen(false);
                      setEditingLinkIndex(null);
                      setNewLink({ titulo: '', url: '', descripcion: '' });
                    }}>
                      {editingLinkIndex !== null ? 'Guardar Cambios' : 'Agregar'}
                    </Button>
                  </div>
                </div>
              </Modal>
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

      {ordenCreadaId && (
        <PagoFormModal
          isOpen={showPagoModal}
          onClose={() => {
            setShowPagoModal(false);
            // Si cierra el modal, redirigimos igual
            navigate('/app/orders/ordenes');
          }}
          onSubmit={handlePagoSubmit}
          saldoPendiente={calcularTotales().total} // Total inicial
          clientName={(() => {
            const c = clients.find(cl => cl.id === clienteId);
            return c?.nombre_fantasia || c?.razon_social || '';
          })()}
        />
      )}
      <PagoFormModal
        isOpen={showPagoForm}
        onClose={() => {
          setShowPagoForm(false);
          setEditingPago(undefined);
        }}
        onSubmit={handleGuardarPago}
        saldoPendiente={calcularSaldoPendiente()}
        pago={editingPago ? {
          ...editingPago,
          referencia_pago: editingPago.referencia_pago || '',
          notas: editingPago.notas || ''
        } : undefined}
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
