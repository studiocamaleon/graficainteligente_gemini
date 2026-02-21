import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';
import {
  ArrowLeft, Save, Loader2
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/card';
import { Tabs } from '../../../components/ui/Tabs';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
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
import { OrdenAdjuntosSection } from '../../../components/orders/OrdenAdjuntosSection';
import { OrdenFooterTotales } from '../../../components/orders/OrdenFooterTotales';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import { sendWatiMessage } from '../../../lib/wati';
import { buildTrackingUrl } from '../../../lib/trackingUrl';
import { clampZeroMoney, roundMoney, toMoney } from '../../../utils/money';

import type { CanalVenta } from '../../../types/database';
import { usePresupuestos } from '../../../hooks/usePresupuestos';
import { generarDescripcionCopiado } from '../../../utils/ordenesHelpers';
import { useLocation } from 'react-router-dom';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { canManagePaymentsRole, canRegisterPaymentsRole } from '../../../utils/roles';

// Tipos

interface PagoTemporal {
  id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago?: string;
  notas?: string;
}

type LinkType = 'download' | 'internal';

function formatDateForWhatsappTemplate(dateValue: string | null | undefined): string {
  if (!dateValue) return 'A confirmar';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split('-');
    return `${Number(day)}/${Number(month)}/${year}`;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'A confirmar';
  return date.toLocaleDateString('es-AR');
}

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const { profile, company } = useAuth();
  const canRegisterPayments = canRegisterPaymentsRole(profile?.role);
  const canManagePersistedPayments = canManagePaymentsRole(profile?.role);
  const {
    createOrdenConItems,
    updateOrdenCompleta,
    getOrdenById,
    addPago: addPagoDb,
    updatePago: updatePagoDb,
    deletePago: deletePagoDb,
    error: ordenError,
  } = useOrdenTrabajo();

  const isBudget = location.pathname.includes('/presupuestos/');
  const pageTitle = isEditing
    ? (isBudget ? 'Editar Presupuesto' : 'Editar Orden')
    : (isBudget ? 'Nuevo Presupuesto' : 'Nueva Orden');

  usePageHeader(pageTitle);
  const { showSuccess, showError } = useToast();
  const { createPresupuesto, updatePresupuesto, enviarPresupuesto } = usePresupuestos();



  const [activeTab, setActiveTab] = useState('items');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // ID temporal para adjuntos durante la creación
  const ordenTemporalId = useMemo(() => crypto.randomUUID(), []);

  // Estados para Adjuntos (Links)
  const [links, setLinks] = useState<{ titulo: string; url: string; descripcion: string }[]>([]);

  // Estados del Formulario
  const [clienteId, setClienteId] = useState('');
  const [canalVenta, setCanalVenta] = useState<CanalVenta | ''>('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [requiereFactura, setRequiereFactura] = useState(true);
  const [requiereDespacho, setRequiereDespacho] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [descuentoTotal, setDescuentoTotal] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Estados post-creación
  const [ordenCreada, setOrdenCreada] = useState(false);
  const [ordenCreadaId, setOrdenCreadaId] = useState<string | null>(null);
  const isCreatingOrderRef = useRef(false);

  // Estados Pagos
  const [pagos, setPagos] = useState<PagoTemporal[]>([]);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false); // Modal post-creación
  const [editingPago, setEditingPago] = useState<PagoTemporal | undefined>();

  // Estados OCs asociadas
  const [ordenesCopiadoAsociadas, setOrdenesCopiadoAsociadas] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const isInitialLoad = useRef(true);

  // Estados Presupuesto
  const [mode, setMode] = useState<'orden' | 'presupuesto'>('orden');
  const [presupuestoValidez, setPresupuestoValidez] = useState('');
  const [presupuestoCondiciones, setPresupuestoCondiciones] = useState('');

  // Inicialización de modo presupuesto si viene por URL
  useEffect(() => {
    if (searchParams.get('mode') === 'presupuesto' || location.pathname.includes('/presupuestos/')) {
      setMode('presupuesto');
      // Set default validez (7 días)
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 7);
      if (!isEditing) { // Only set default if creating
        setPresupuestoValidez(fecha.toISOString().split('T')[0]);
      }
      setRequiereFactura(false); // Forzar false en presupuesto
    }
  }, [location.pathname]);

  // Efecto para manejar cambios de modo
  const handleModeChange = (newMode: 'orden' | 'presupuesto') => {
    setMode(newMode);
    if (newMode === 'presupuesto') {
      setRequiereFactura(false);
      if (activeTab === 'pagos') {
        setActiveTab('items');
      }
      // Init dates if empty
      if (!presupuestoValidez) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + 7);
        setPresupuestoValidez(fecha.toISOString().split('T')[0]);
      }
    } else {
      // Restore default behavior for Order if needed, or leave as is
      setRequiereFactura(true);
    }
  };

  // Tracking de cambios para avisar al salir
  useEffect(() => {
    if (isLoadingData || isInitialLoad.current) return;
    setHasChanges(true);
  }, [clienteId, items, canalVenta, fechaEntrega, notasInternas, requiereFactura, requiereDespacho, descuentoTotal, pagos, ordenesCopiadoAsociadas, presupuestoValidez, presupuestoCondiciones]);

  // Estabilización tras carga
  useEffect(() => {
    if (!isLoadingData) {
      // Pequeño delay para permitir que todos los estados se asienten antes de habilitar el tracking
      const timer = setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
      return () => clearTimeout(timer);
    } else {
      isInitialLoad.current = true;
    }
  }, [isLoadingData]);

  const { updateStepComment, countAllComments } = useItemRoutesComments({
    items,
    setItems,
  });

  const { clients } = useClients({ page: 1, itemsPerPage: 1000 });
  const clienteSeleccionado = clients.find((c) => c.id === clienteId);


  // --- Reset & Load ---


  useEffect(() => {
    if (isEditing && id) {
      if (location.pathname.includes('/presupuestos/')) {
        loadPresupuestoData(id);
      } else {
        loadOrderData(id);
      }
    } else {
      // Initial reset if create mode
      // resetFormulario(); // Comentado para no pisar el effect de inicializacion de modo
    }
  }, [id, isEditing]);

  const loadPresupuestoData = async (presupuestoId: string) => {
    setIsLoadingData(true);
    try {
      const { data: presupuesto, error } = await (supabase as any)
        .from('presupuestos')
        .select(`
          *,
          items:presupuestos_items(*),
          servicios:presupuestos_servicios(*)
        `)
        .eq('id', presupuestoId)
        .single();

      if (error || !presupuesto) {
        showError('No se encontró el presupuesto');
        navigate('/app/presupuestos/lista');
        return;
      }

      setMode('presupuesto');
      setClienteId(presupuesto.cliente_id);
      setCanalVenta(presupuesto.canal_venta || '');
      setPresupuestoValidez(presupuesto.fecha_validez ? presupuesto.fecha_validez.split('T')[0] : '');
      setPresupuestoCondiciones(presupuesto.condiciones_comerciales || '');
      setNotasInternas(presupuesto.notas_internas || '');
      setRequiereFactura(false);

      const mappedItems = (presupuesto.items || []).map((item: any) => ({
        id: item.id,
        es_servicio_cobro: false,
        tipo_item: (item.configuracion?.cantidad_copias && item.configuracion?.cantidad_hojas) ? 'centro_copiado' :
          (item.tipo_item === 'item_personalizado' ? 'personalizado' :
            (item.tipo_item === 'producto_sistema' && !item.producto_id ? 'personalizado' : (item.tipo_item === 'producto_sistema' ? 'catalogo' : item.tipo_item))),
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        producto_categoria: item.producto_categoria,
        cantidad: Number(item.cantidad),
        configuracion: item.configuracion || {},
        precio_base: Number(item.precio_base || 0),
        precio_servicios: Number(item.precio_servicios || 0),
        precio_acabados: Number(item.precio_acabados || 0),
        precio_unitario_final: item.precio_unitario_final !== null ? Number(item.precio_unitario_final) : null,
        precio_total: item.precio_total !== null ? Number(item.precio_total) : null,
        descripcion: item.descripcion,
        tiempo_produccion_dias: item.tiempo_produccion_dias,
        rutas_generadas: item.configuracion?._rutas_snapshot || []
      }));

      const mappedServicios = (presupuesto.servicios || []).map((s: any) => ({
        id: s.id, // ID real de presupuestos_servicios (distinto de item)
        es_servicio_cobro: true,
        tipo_item: 'item_personalizado',
        producto_nombre: s.descripcion,
        producto_categoria: 'Servicio Adicional',
        cantidad: Number(s.cantidad),
        precio_unitario_final: Number(s.precio_unitario),
        precio_total: Number(s.subtotal),
        descripcion: s.descripcion,
        metadata: s.metadata,
        configuracion: {}
      }));

      setItems([...mappedItems, ...mappedServicios]);

    } catch (err) {
      console.error('Error loading presupuesto:', err);
      showError('Error al cargar presupuesto');
    } finally {
      setIsLoadingData(false);
      isInitialLoad.current = true;
      setHasChanges(false);
    }
  };

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
      setCanalVenta(orden.canal_venta || '');
      setFechaEntrega(orden.fecha_estimada_entrega ? orden.fecha_estimada_entrega.split('T')[0] : '');
      setNotasInternas(orden.notas_internas || '');
      setRequiereFactura(orden.requiere_factura || false);
      setRequiereDespacho(orden.requiere_despacho || false);

      // If editing an order, force mode to order
      setMode('orden');

      const totalSinDescuento = (orden.subtotal || 0);
      const descuentoPorcentaje = totalSinDescuento > 0 ? ((orden.total_descuentos || 0) / totalSinDescuento) * 100 : 0;
      setDescuentoTotal(Math.round(descuentoPorcentaje * 100) / 100);

      const mappedItems = (orden.items || []).map(item => ({
        ...item,
        categoria_id: item.categoria_id || item.configuracion?.categoria_id || null,
        configuracion: item.configuracion || {},
        rutas_generadas: (item as any).rutas || []
      }));

      const mappedServices = (orden.servicios || []).map(servicio => ({
        id: servicio.id,
        es_servicio_cobro: true,
        tipo_item: 'personalizado',
        producto_nombre: servicio.descripcion,
        cantidad: servicio.cantidad,
        precio_unitario_final: servicio.precio_unitario,
        precio_total: servicio.subtotal,
        precio_base: servicio.precio_unitario,
        precio_servicios: 0,
        precio_acabados: 0,
        servicio_id: servicio.servicio_id
      }));

      setItems([...mappedItems, ...mappedServices]);

      if (orden.pagos) {
        setPagos(orden.pagos.map(p => ({
          id: p.id,
          fecha_pago: p.fecha_pago,
          monto: p.monto,
          medio_cobro_id: (p as any).medio_cobro_id || '',
          referencia_pago: p.referencia_pago || '',
          notas: p.notas || ''
        })));
      }

      if (orden.ordenCopiado) {
        setOrdenesCopiadoAsociadas([orden.ordenCopiado]);
      }

    } catch (err) {
      console.error('Error loading order:', err);
      showError('Error al cargar la orden');
    } finally {
      setIsLoadingData(false);
      isInitialLoad.current = true;
      setHasChanges(false);
    }
  };

  // --- Prompt Changes ---
  const formularioTieneCambios = () => {
    if (ordenCreada) return false;
    if (isEditing) return hasChanges;
    return clienteId !== '' || items.length > 0 || notasInternas !== '' || fechaEntrega !== '' || ordenesCopiadoAsociadas.length > 0;
  };

  const { isPromptOpen, closePrompt, confirmPrompt } = usePrompt(
    '¿Estás seguro de que deseas salir? Se perderán los cambios no guardados.',
    formularioTieneCambios()
  );

  const handleVolver = () => {
    const target = mode === 'presupuesto' ? '/app/presupuestos/lista' : '/app/orders/ordenes';
    navigate(target);
  };

  // --- Cálculos ---
  const calcularTotales = () => {
    const subtotalItems = items.reduce((sum, item) => sum + item.precio_total, 0);
    const subtotalOrdenesCopiad = ordenesCopiadoAsociadas.reduce((sum, oc) => sum + oc.total, 0);
    const subtotal = subtotalItems + subtotalOrdenesCopiad;
    const descuentoAplicado = subtotal * (descuentoTotal / 100);
    const subtotalConDescuento = subtotal - descuentoAplicado;
    // Si es presupuesto, forzamos requiereFactura false para visualización interna,
    // pero el total NO lleva IVA agregado extra.
    const iva = (requiereFactura && mode === 'orden') ? subtotalConDescuento * 0.21 : 0;
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
    const totalPagado = pagos.reduce((sum, p) => sum + toMoney(p.monto), 0);
    return clampZeroMoney(roundMoney(totales.total) - roundMoney(totalPagado));
  };

  // --- Pagos ---
  const handleAgregarPago = () => {
    if (!canRegisterPayments) {
      showError('El rol Operador de taller no puede registrar pagos.');
      return;
    }
    setEditingPago(undefined);
    setShowPagoForm(true);
  };

  const handleGuardarPago = async (data: Omit<PagoTemporal, 'id'>): Promise<boolean> => {
    // Edit flow: persist immediately so payments are not lost.
    if (isEditing && id) {
      const pagoData = {
        fecha_pago: data.fecha_pago,
        monto: roundMoney(data.monto),
        medio_cobro_id: data.medio_cobro_id,
        referencia_pago: data.referencia_pago || null,
        notas: data.notas || null,
      };

      const ok = editingPago
        ? await updatePagoDb(editingPago.id, id, pagoData as any)
        : await addPagoDb(id, pagoData as any);

      if (ok) {
        showSuccess(editingPago ? 'Pago actualizado correctamente' : 'Pago registrado correctamente');
        await loadOrden();
      } else {
        showError(editingPago ? 'Error al actualizar el pago' : 'Error al registrar el pago');
      }

      return ok;
    }

    // Create flow: keep payments locally until order exists.
    if (editingPago) {
      setPagos(prev => prev.map(p => p.id === editingPago.id ? { ...data, id: editingPago.id } : p));
      showSuccess('Pago actualizado correctamente');
    } else {
      const nuevoPago: PagoTemporal = { ...data, id: crypto.randomUUID() };
      setPagos(prev => [...prev, nuevoPago]);
      showSuccess('Pago registrado correctamente');
    }
    return true;
  };

  const handleEditarPago = (pago: PagoTemporal) => {
    if (isEditing && !canManagePersistedPayments) {
      showError('Solo superadmin puede editar pagos registrados.');
      return;
    }
    setEditingPago(pago);
    setShowPagoForm(true);
  };

  const handleEliminarPago = async (pagoId: string) => {
    if (isEditing && !canManagePersistedPayments) {
      showError('Solo superadmin puede eliminar pagos registrados.');
      return;
    }
    if (isEditing && id) {
      const ok = await deletePagoDb(pagoId, id);
      if (ok) {
        showSuccess('Pago eliminado correctamente');
        await loadOrden();
      } else {
        showError('Error al eliminar el pago');
      }
      return;
    }

    setPagos(prev => prev.filter(p => p.id !== pagoId));
    showSuccess('Pago eliminado correctamente');
  };

  // --- Gestión Principal (Crear Orden) ---
  const addPago = async (ordenId: string, pagoData: any) => {
    try {
      // Reusar el flujo centralizado del hook:
      // - inserta el pago
      // - genera recibo PDF
      // - dispara plantilla Wati de recibo
      return await addPagoDb(ordenId, {
        fecha_pago: pagoData.fecha_pago,
        monto: pagoData.monto,
        medio_cobro_id: pagoData.medio_cobro_id,
        referencia_pago: pagoData.referencia_pago,
        notas: pagoData.notas,
      });
    } catch (err: any) {
      console.error("Error adding payment:", err);
      // Fallback para errores comunes, si es necesario
      return false;
    }
  };

  const validarFormulario = (): boolean => {
    const errores: Record<string, string> = {};
    if (!clienteId) errores.cliente = 'Debe seleccionar un cliente';
    if (!canalVenta) errores.canalVenta = 'Debe seleccionar un canal de venta';
    if (items.length === 0 && ordenesCopiadoAsociadas.length === 0) {
      errores.items = 'Debe agregar al menos un item o una orden de copiado';
    }

    if (mode === 'orden') {
      if (!fechaEntrega) {
        errores.fechaEntrega = 'La fecha de entrega es obligatoria';
      } else {
        const hoy = dayjs().tz(ARGENTINA_TIMEZONE).format('YYYY-MM-DD');
        if (!isEditing && fechaEntrega < hoy) {
          errores.fechaEntrega = 'La fecha de entrega no puede ser anterior a hoy';
        }
      }
    } else {
      // Validaciones Presupuesto
      if (!presupuestoValidez) {
        errores.fechaEntrega = 'Indique la validez del presupuesto'; // Reusamos el key para mostrar error visual si es necesario
      }
    }

    setFormErrors(errores);
    return Object.keys(errores).length === 0;
  };



  const handleGuardarPresupuestoInterno = async () => {
    setIsLoading(true);
    try {
      let presupuestoId = ordenCreadaId;

      // Determinar si todos los items tienen precio para marcar como enviado
      const todosConPrecio = items.every(item => item.precio_unitario_final !== null && item.precio_unitario_final !== undefined);
      const estadoFinal = todosConPrecio ? 'enviado' : 'borrador';

      if (isEditing && id) {
        presupuestoId = id;
        // UPDATE MODE
        const updated = await updatePresupuesto(presupuestoId, {
          cliente_id: clienteId,
          vendedor_id: profile?.id || '',
          canal_venta: canalVenta as CanalVenta,
          fecha_validez: presupuestoValidez,
          condiciones_comerciales: presupuestoCondiciones,
          notas_internas: notasInternas,
          // No cambiamos el estado aquí para evitar que el trigger salte antes de actualizar los items
        });
        if (!updated) throw new Error('Error actualizando presupuesto');

        // Limpiar items anteriores para re-insertar (Estrategia Full Replace)
        await (supabase as any).from('presupuestos_items').delete().eq('presupuesto_id', presupuestoId);
        // Limpiar servicios anteriores
        await (supabase as any).from('presupuestos_servicios').delete().eq('presupuesto_id', presupuestoId);

      } else {
        // CREATE MODE
        const nuevo = await createPresupuesto({
          cliente_id: clienteId,
          vendedor_id: profile?.id || '',
          canal_venta: canalVenta as CanalVenta,
          fecha_validez: presupuestoValidez,
          condiciones_comerciales: presupuestoCondiciones,
          notas_internas: notasInternas,
          estado: 'borrador' // Siempre empezamos en borrador para insertar items tranquilo
        });
        if (!nuevo) throw new Error('Error creando header de presupuesto');
        presupuestoId = nuevo.id;
      }

      if (!presupuestoId) throw new Error('No se pudo determinar ID del presupuesto');

      // Items
      const itemsFisicos = items.filter(i => !i.es_servicio_cobro);

      for (const item of itemsFisicos) {
        // Guardamos rutas snapshot en config por compatibilidad, pero agregamos tabla relacional
        const configRutas = { ...item.configuracion, _rutas_snapshot: (item as any).rutas_generadas || [] };

        let tipoItemDb = 'producto_sistema';
        let productoIdDb = item.producto_id;

        if (item.tipo_item === 'centro_copiado') {
          tipoItemDb = 'centro_copiado';
          productoIdDb = item.producto_id;
        } else if (item.tipo_item === 'personalizado' || item.tipo_item === 'item_personalizado' || !item.producto_id) {
          tipoItemDb = 'item_personalizado';
          productoIdDb = null;
        }
        // Si tiene ID y no cayó en el if anterior, se mantiene como producto_sistema (incluye catalogo y centro_copiado)

        const { data: itemInserted, error: itemError } = await (supabase as any).from('presupuestos_items').insert({
          presupuesto_id: presupuestoId,
          tipo_item: tipoItemDb,
          producto_id: productoIdDb,
          producto_nombre: item.producto_nombre,
          producto_categoria: item.producto_categoria,
          configuracion: configRutas,
          cantidad: item.cantidad,
          precio_base: item.precio_base || 0,
          precio_servicios: item.precio_servicios || 0,
          precio_acabados: item.precio_acabados || 0,
          precio_unitario_final: item.precio_unitario_final,
          precio_total: item.precio_total,
          descripcion: item.descripcion || ((item.tipo_item === 'centro_copiado' || item.categoria_id === 'centro_copiado' || item.tipo_item === 'producto_sistema') ? generarDescripcionCopiado(item.configuracion) : null),
          tiempo_produccion_dias: item.tiempo_produccion_dias
        }).select().single();

        if (itemError) throw itemError;

        // Insertar Rutas Relacionales
        const rutas = (item as any).rutas_generadas || [];
        if (rutas.length > 0 && itemInserted) {
          const rutasToInsert = rutas.map((r: any, idx: number) => ({
            company_id: profile?.company_id,
            presupuesto_item_id: itemInserted.id,
            tipo_etapa: r.etapa || r.tipo_etapa || 'principal',
            paso_id: r.paso_id,
            paso_nombre: r.paso_nombre,
            orden: idx,
            es_modificado: r.es_modificado || false,
            origen_plantilla_id: r.origen_plantilla_id,
            comentario_vendedor: r.comentario_vendedor,
            source_service_id: r.source_service_id,
            global_task_id: r.global_task_id
          }));

          const { error: rutasError } = await (supabase as any).from('presupuestos_items_rutas').insert(rutasToInsert);
          if (rutasError) console.error('Error insertando rutas de presupuesto:', rutasError);
        }
      }
      // Servicios extra (Guardar en tabla separada)
      const servicios = items.filter(i => i.es_servicio_cobro);
      for (const s of servicios) {
        await (supabase as any).from('presupuestos_servicios').insert({
          presupuesto_id: presupuestoId,
          descripcion: s.producto_nombre,
          cantidad: s.cantidad,
          precio_unitario: s.precio_unitario_final,
          subtotal: s.precio_total,
          servicio_id: null, // Si tuviéramos ID real de servicio lo pondríamos aquí
          created_by: profile?.id,
          metadata: (s as any).metadata || {}
        });
      }

      // Update totales
      const totales = calcularTotales();
      await (supabase as any).from('presupuestos').update({
        subtotal: totales.subtotal,
        total: totales.total,
        // Si ya estan todos con precio, ahorasí actualizamos el estado
        estado: estadoFinal,
        fecha_enviado: estadoFinal === 'enviado' ? new Date().toISOString() : undefined
      }).eq('id', presupuestoId);

      // Si el estado es enviado, disparar el proceso de envío (notificaciones, etc)
      if (estadoFinal === 'enviado') {
        console.log('[CreateOrderPage] Automatizando envío de presupuesto:', presupuestoId);
        await enviarPresupuesto(presupuestoId);
      }

      showSuccess(isEditing ? 'Presupuesto actualizado OK' : 'Presupuesto creado OK');
      setOrdenCreada(true);
      setTimeout(() => navigate(`/app/presupuestos/${presupuestoId}`), 500);

    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCrearOrden = async () => {
    if (!validarFormulario()) return;
    if (!profile?.company_id) {
      showError('Error de perfil. Recarga la página.');
      return;
    }

    // DESVIAR LOGICA A PRESUPUESTO SI EL MODO ES PRESUPUESTO
    if (mode === 'presupuesto') {
      await handleGuardarPresupuestoInterno();
      return;
    }

    isCreatingOrderRef.current = true;
    setIsLoading(true);

    const totales = calcularTotales();
    const ordenData = {
      cliente_id: clienteId,
      canal_venta: canalVenta as CanalVenta,
      fecha_estimada_entrega: fechaEntrega ? `${fechaEntrega}T12:00:00-03:00` : undefined,
      notas_internas: notasInternas || undefined,
      subtotal: totales.subtotal,
      total_descuentos: totales.descuentoAplicado,
      total: totales.total,
      requiere_factura: requiereFactura,
      subtotal_iva: totales.iva,
      requiere_despacho: requiereDespacho,
    };

    const itemsFisicos = items.filter(i => !i.es_servicio_cobro);
    const serviciosAdicionales = items.filter(i => i.es_servicio_cobro);

    const payload = {
      ordenData,
      items: itemsFisicos.map(item => ({
        id: item.id,
        tipo_item: item.tipo_item || 'catalogo',
        producto_id: item.producto_id,
        categoria_id: item.categoria_id || item.configuracion?.categoria_id,
        producto_nombre: item.producto_nombre,
        producto_categoria: item.producto_categoria || item.categoria || 'Personalizado',
        descripcion: item.descripcion || (item.tipo_item === 'centro_copiado' || item.categoria_id === 'centro_copiado' ? generarDescripcionCopiado(item.configuracion) : null),
        tiempo_produccion_dias: item.tiempo_produccion_dias || null,
        cantidad: item.cantidad,
        configuracion: item.configuracion,
        precio_base: item.precio_base,
        precio_servicios: item.precio_servicios,
        precio_acabados: item.precio_acabados,
        precio_unitario_final: item.precio_unitario_final,
        precio_total: item.precio_total,
        rutas_generadas: (item as any).rutas_generadas || [],
      })),
      servicios: serviciosAdicionales.map(s => ({
        descripcion: s.producto_nombre,
        cantidad: s.cantidad,
        precio_unitario: s.precio_unitario_final,
        subtotal: s.precio_total,
        servicio_id: null,
        metadata: (s as any).metadata
      })),
      estadoInicial: 'pendiente' as const,
    };

    try {
      let result: any;
      if (isEditing && id) {
        result = await updateOrdenCompleta(id, payload);
        if (result) {
          showSuccess('Orden actualizada exitosamente');
          setOrdenCreada(true);
          setTimeout(() => navigate('/app/orders/ordenes'), 500);
        } else {
          throw new Error(ordenError || 'Error actualizando');
        }
      } else {
        // CREACION
        result = await createOrdenConItems(payload);
        if (result && result.id) {
          // Insertar pagos
          if (pagos.length > 0) {
            await Promise.all(pagos.map(p => addPago(result.id, {
              fecha_pago: p.fecha_pago,
              monto: p.monto,
              medio_cobro_id: p.medio_cobro_id,
              referencia_pago: p.referencia_pago,
              notas: p.notas
            })));
          }
          // Insertar links
          if (links.length > 0) {
            await (supabase.from('ordenes_trabajo_links') as any).insert(links.map(l => ({
              orden_id: result.id,
              company_id: profile.company_id,
              titulo: l.titulo,
              url: l.url,
              descripcion: l.descripcion,
              created_by: profile.id
            })));
          }

          // Vincular adjuntos temporales a la nueva orden
          await (supabase
            .from('ordenes_trabajo_archivos') as any)
            .update({ orden_id: result.id, orden_temporal_id: null })
            .eq('orden_temporal_id', ordenTemporalId);

          setOrdenCreada(true);
          setOrdenCreadaId(result.id);
          showSuccess('Orden creada exitosamente');

          // Notificacion WhatsApp (Wati Template)
          if (profile?.company_id && clienteSeleccionado?.whatsapp) {
            // Need to ensure we have result data passed correctly.
            // result is OrdenTrabajoFull. 
            sendWatiMessage({
              companyId: profile.company_id,
              phone: clienteSeleccionado.whatsapp,
              template_name: 'nueva_orden_v4',
              parameters: [
                { name: 'nombre_cliente', value: clienteSeleccionado.nombre_fantasia || clienteSeleccionado.razon_social },
                { name: 'numero_orden', value: result.numero_orden },
                { name: 'fecha_entrega', value: formatDateForWhatsappTemplate(fechaEntrega) },
                { name: 'subtotal', value: totales.subtotal.toLocaleString('es-AR') },
                { name: 'total_iva', value: totales.total.toLocaleString('es-AR') }, // User requested naming this Total FINAL
                { name: 'url_tracking', value: buildTrackingUrl((result as any).tracking_token) },
                { name: 'nombre_empresa', value: company?.name || 'Tu empresa' },
                { name: '1', value: (result as any).tracking_token }
              ],
              metadata: {
                tipo: 'nueva_orden_trabajo',
                orden_trabajo_id: result.id
              }
            }).catch(err => console.error('Error sending Wati New Order:', err));
          }

          setTimeout(() => navigate('/app/orders/ordenes'), 500);
        } else {
          throw new Error(ordenError || 'Error creando orden');
        }
      }
    } catch (err: any) {
      console.error(err);
      showError(err.message);
    } finally {
      setIsLoading(false);
      isCreatingOrderRef.current = false;
    }
  };

  const handlePagoSubmit = async (data: any): Promise<boolean> => {
    if (!ordenCreadaId) return;
    setIsLoading(true);
    const success = await addPago(ordenCreadaId, data);
    if (success) {
      showSuccess('Pago registrado');
      setTimeout(() => navigate('/app/orders/ordenes'), 500);
    } else {
      showError('Error al registrar pago');
    }
    setIsLoading(false);
    return success;
  };

  // --- Render ---
  const totales = calcularTotales();
  const totalRutas = items.filter(item =>
    !item.es_servicio_cobro &&
    (
      (Array.isArray((item as any).rutas_generadas) && (item as any).rutas_generadas.length > 0) ||
      (item.configuracion?.ruta_produccion_id) ||
      (item.tipo_item === 'centro_copiado' || item.categoria_id === 'centro_copiado')
    )
  ).length;
  const totalComentarios = countAllComments();

  const tabsDefinition = [
    { id: 'items', label: 'Items', count: items.length },
    { id: 'rutas', label: 'Rutas de Producción', count: totalRutas, disabled: items.length === 0, badge: totalComentarios > 0 ? totalComentarios : undefined },
    { id: 'adjuntos', label: 'Adjuntos', disabled: false },
    ...(mode !== 'presupuesto' ? [{ id: 'pagos', label: 'Pagos', count: pagos.length, disabled: false }] : []),
    { id: 'historial', label: 'Historial', disabled: true },
  ];

  if (isLoadingData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Cargando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 pb-32 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={handleVolver}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a órdenes
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleCrearOrden}
              disabled={isLoading || items.length === 0 || !clienteId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isEditing ? 'Guardando...' : 'Procesando...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Guardar Cambios' : (mode === 'presupuesto' ? 'Crear Presupuesto' : 'Crear Orden')}
                </>
              )}
            </Button>
          </div>
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
            // New props
            mode={mode}
            onModeChange={handleModeChange}
            presupuestoValidez={presupuestoValidez}
            setPresupuestoValidez={setPresupuestoValidez}
            presupuestoCondiciones={presupuestoCondiciones}
            setPresupuestoCondiciones={setPresupuestoCondiciones}
            isEditing={isEditing}
          />
        </Card>

        <Card>
          <Tabs tabs={tabsDefinition} activeTab={activeTab} onChange={setActiveTab} />

          <div className="p-6">
            <div className={activeTab === 'items' ? 'block' : 'hidden'}>
              <OrdenItemsTab
                items={items}
                setItems={setItems}
                descuentoTotal={descuentoTotal}
                setDescuentoTotal={setDescuentoTotal}
                requiereFactura={requiereFactura}
                setRequiereFactura={mode === 'presupuesto' ? undefined : setRequiereFactura}
                clienteNombre={clienteSeleccionado?.nombre_fantasia || ''}
                ordenesCopiadoAsociadas={ordenesCopiadoAsociadas}
                onOrdenesCopiadoAsociadasChange={setOrdenesCopiadoAsociadas}
                mode={mode}
              />
            </div>

            <div className={activeTab === 'pagos' ? 'block' : 'hidden'}>
              <OrdenPagosTab
                totales={totales}
                pagos={pagos}
                onAgregarPago={handleAgregarPago}
                onEditarPago={isEditing && !canManagePersistedPayments ? undefined : handleEditarPago}
                onEliminarPago={isEditing && !canManagePersistedPayments ? undefined : handleEliminarPago}
                readOnly={!canRegisterPayments}
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
              <OrdenAdjuntosSection
                ordenId={id}
                ordenTemporalId={ordenTemporalId}
                onLinksChange={setLinks}
                initialLinks={links}
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
          totalPagado={pagos.reduce((sum, p) => sum + toMoney(p.monto), 0)}
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
            navigate('/app/orders/ordenes');
          }}
          onSubmit={handlePagoSubmit}
          saldoPendiente={calcularTotales().total}
          clientName={clienteSeleccionado?.nombre_fantasia || ''}
        />
      )}

      {/* Modal para pagos antes de crear la orden */}
      <PagoFormModal
        isOpen={showPagoForm}
        onClose={() => {
          setShowPagoForm(false);
          setEditingPago(undefined);
        }}
        onSubmit={handleGuardarPago}
        pago={editingPago as any}
        saldoPendiente={calcularSaldoPendiente()}
        clientName={clienteSeleccionado?.nombre_fantasia || ''}
      />

      <ConfirmDialog
        isOpen={isPromptOpen}
        onClose={closePrompt}
        onConfirm={confirmPrompt}
        title="Cambios sin guardar"
        message="¿Estás seguro de que deseas salir?"
        confirmText="Salir sin guardar"
        cancelText="Continuar editando"
        variant="warning"
      />

    </>
  );
}
