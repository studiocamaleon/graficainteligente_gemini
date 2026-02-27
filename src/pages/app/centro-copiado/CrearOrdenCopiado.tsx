import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, MessageSquare, Globe, Store, Smartphone, Home, Truck } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/card';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Tabs } from '../../../components/ui/Tabs';
import { Tooltip } from '../../../components/ui/Tooltip';
import { CentroCopiadoItemForm, ItemCopiadoConfig } from '../../../components/centro-copiado/CentroCopiadoItemForm';
import { Switch } from '../../../components/ui/Switch';
import { CentroCopiadoResumenOrden } from '../../../components/centro-copiado/CentroCopiadoResumenOrden';
import { CentroCopiadoArchivosSection } from '../../../components/centro-copiado/CentroCopiadoArchivosSection';
import { OrdenPagosTab } from '../../../components/orders/OrdenPagosTab';
import { PagoFormModal, PagoFormData } from '../../../components/orders/PagoFormModal';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useClients } from '../../../hooks/useClients';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import { useCentroCopiadoOrdenItems } from '../../../hooks/useCentroCopiadoOrdenItems';
import { useCentroCopiadoArchivos } from '../../../hooks/useCentroCopiadoArchivos';
import { useCentroCopiadoOrdenPagos } from '../../../hooks/useCentroCopiadoOrdenPagos';
import { useCentroCopiadoOrden } from '../../../hooks/useCentroCopiadoOrden';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { useWorkload } from '../../../hooks/useWorkload';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { QuickClientModal } from '../../../components/clients/QuickClientModal';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { sendWatiMessage } from '../../../lib/wati';
import { buildTrackingUrl } from '../../../lib/trackingUrl';
import { canRegisterPaymentsRole } from '../../../utils/roles';
import type { CanalVenta, EstadoOrdenCopiado } from '../../../types/database';

interface ItemWithId {
  id: string;
  config: Partial<ItemCopiadoConfig>;
  precio?: number;
  ahorroCantidad?: number;
  valorHojaImpresion?: number | null;
  rangoHojaImpresion?: string | null;
  isCollapsed?: boolean;
  archivoId?: string;
  nombreArchivo?: string;
  descripcion?: string;
}

interface PagoTemporal {
  id: string;
  fecha_pago: string;
  monto: number;
  medio_cobro_id: string;
  referencia_pago?: string;
  notas?: string;
}

function buildImpresionGroupKey(config: Partial<ItemCopiadoConfig>): string | null {
  if (config.modo_item === 'ploteo_cad') return null;

  if (!config.tamanio_papel_id || !config.papel_id || !config.tipo_tinta || !config.cara_impresa) {
    return null;
  }

  return `${config.tamanio_papel_id}|${config.papel_id}|${config.tipo_tinta}|${config.cara_impresa}`;
}

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

export function CrearOrdenCopiado() {
  const navigate = useNavigate();
  const { profile, company } = useAuth();
  const canRegisterPayments = canRegisterPaymentsRole(profile?.role);
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const isEditing = !!id;
  const clienteIdParam = searchParams.get('cliente_id');
  const ordenTrabajoIdParam = searchParams.get('orden_trabajo_id');

  // Generar ID temporal único para archivos
  const [ordenTemporalId] = useState(() =>
    `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`
  );

  // Hooks for Edit Mode
  const { orden: ordenEditar, loading: loadingOrden } = useCentroCopiadoOrden(id);
  const { archivos: archivosOrden, refetch: refetchArchivos } = useCentroCopiadoArchivos({ ordenId: id });

  const [activeTab, setActiveTab] = useState('items');
  const [clienteId, setClienteId] = useState<string>(clienteIdParam || '');
  const [origen, setOrigen] = useState<CanalVenta | ''>('');
  const [requiereDespacho, setRequiereDespacho] = useState(false);
  const [requiereFactura, setRequiereFactura] = useState(true);
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemWithId[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [pagos, setPagos] = useState<PagoTemporal[]>([]);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [editingPago, setEditingPago] = useState<PagoTemporal | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const resumenContainerRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const { dialogState, openDialog, closeDialog } = useInfoDialog();
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const { clients, loading: loadingClients, refetch: refetchClients } = useClients({
    page: 1,
    itemsPerPage: 1000,
    searchTerm
  });
  const clienteSeleccionado = clients.find(c => c.id === clienteId);

  const { workloadData } = useWorkload({ type: 'centro_copiado' });

  const { createOrden, updateOrdenCompleta } = useCentroCopiadoOrdenes({ enabled: false });
  const { createItemImpresion } = useCentroCopiadoOrdenItems();
  const { asociarConOrden, limpiarTemporales, updateArchivo } = useCentroCopiadoArchivos({ ordenTemporalId });
  const { createPago } = useCentroCopiadoOrdenPagos();

  const handleClientCreated = (newClient: any) => {
    // Manually push to clients if needed, or trigger refetch
    refetchClients();
    setClienteId(newClient.id);
  };

  usePageHeader(isEditing ? 'Editar orden de copiado' : 'Crea una nueva orden de copiado con items personalizados');

  const canalesVenta: { value: CanalVenta; label: string; icon: any }[] = [
    { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'Web', label: 'Web', icon: Globe },
    { value: 'Mostrador', label: 'Mostrador', icon: Store },
    { value: 'App Mobile', label: 'App Mobile', icon: Smartphone },
  ];

  const [addedItemId, setAddedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (addedItemId) {
      setTimeout(() => {
        const element = document.getElementById(`item-${addedItemId}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const targetTop = window.scrollY + rect.top - 96;
          window.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth',
          });
        }
        setAddedItemId(null);
      }, 100);
    }
  }, [items, addedItemId]);

  const handleArchivoGenerado = useCallback((archivoId: string, nombreArchivo: string, paginasDetectadas?: number | null) => {
    // Colapsar todos los items existentes
    setItems((prev) =>
      prev.map(item => ({ ...item, isCollapsed: true }))
    );

    const newItemId = `item-${Date.now()}-${Math.random()}`;

    // Crear nuevo item en blanco para que el usuario configure manualmente
    const nuevoItem: ItemWithId = {
      id: newItemId,
      config: {
        cantidad_copias: 1,
        cantidad_hojas: paginasDetectadas && paginasDetectadas > 0 ? paginasDetectadas : 1,
      },
      isCollapsed: false,
      archivoId,
      nombreArchivo,
    };
    setItems((prev) => [...prev, nuevoItem]);
    setAddedItemId(newItemId);
  }, []);

  const agregarItem = useCallback(() => {
    setItems((prev) =>
      prev.map(item => ({ ...item, isCollapsed: true }))
    );

    const newItemId = `item-${Date.now()}-${Math.random()}`;

    const nuevoItem: ItemWithId = {
      id: newItemId,
      config: {
        cantidad_copias: 1,
      },
      isCollapsed: false,
    };
    setItems((prev) => [...prev, nuevoItem]);
    setAddedItemId(newItemId);
  }, []);

  useEffect(() => {
    if (!initialized) {
      if (isEditing && ordenEditar && archivosOrden) {
        // Hydrate from existing order
        setClienteId(ordenEditar.cliente_id || '');
        setOrigen((ordenEditar.canal_venta as CanalVenta) || '');
        setRequiereDespacho(Boolean(ordenEditar.requiere_despacho));
        if (ordenEditar.fecha_entrega_estimada) {
          setFechaEntrega(ordenEditar.fecha_entrega_estimada.split('T')[0]);
        }
        setObservaciones(ordenEditar.observaciones || '');
        setRequiereFactura(!!ordenEditar.requiere_factura);

        // Hydrate Items
        const hydratedItems: ItemWithId[] = ordenEditar.items.map(dbItem => {
          // Find linked file
          const linkedFile = archivosOrden.find(a => a.item_generado_id === dbItem.id);

          const config: Partial<ItemCopiadoConfig> = {
            tamanio_papel_id: dbItem.tamanio_papel_id || undefined,
            papel_id: dbItem.papel_id || undefined,
            tipo_tinta: dbItem.tipo_tinta || undefined,
            cara_impresa: dbItem.cara_impresa || undefined,
            cantidad_hojas: dbItem.cantidad_hojas || 0,
            cantidad_copias: dbItem.cantidad_unidades || 1,
            anillado: dbItem.tipo_anillado ? { tipo: dbItem.tipo_anillado } : undefined,
            plastificado: dbItem.tipo_plastificado ? {
              tipo: dbItem.tipo_plastificado,
              todas_hojas: true, // Default to true as we're not tracking partials yet
            } : undefined,
            guillotinado: dbItem.con_guillotinado ? { cantidad_hojas: dbItem.cantidad_hojas || 0 } : undefined,
            // Ploteo CAD Fields
            modo_item: dbItem.es_ploteo_cad ? 'ploteo_cad' : 'hojas',
            ploteo_cad_tipo_papel: dbItem.ploteo_cad_tipo_papel || undefined,
            ploteo_cad_ancho_rollo: (dbItem.ploteo_cad_ancho_rollo as 60 | 90) || undefined,
            ploteo_cad_metros_lineales: dbItem.ploteo_cad_metros_lineales || undefined,
          };

          return {
            id: dbItem.id,
            config,
            precio: dbItem.subtotal,
            isCollapsed: true,
            archivoId: linkedFile?.id,
            nombreArchivo: linkedFile?.nombre_archivo,
            descripcion: dbItem.descripcion || undefined
          };
        });

        setItems(hydratedItems);

        // Calculate and set Discount Percentage
        // Note: ordenEditar.subtotal is stored as Net Amount (Gross - Discount) in the DB
        if (ordenEditar.subtotal > 0 && ordenEditar.total_descuentos > 0) {
          const subtotalBruto = ordenEditar.subtotal + ordenEditar.total_descuentos;
          const discountPercentage = (ordenEditar.total_descuentos / subtotalBruto) * 100;
          setDescuento(Number(discountPercentage.toFixed(2)));
        } else {
          setDescuento(0);
        }

        // We could hydrate payments here if we fetched them

        setInitialized(true);
      } else if (!isEditing) {
        setItems([]);
        setClienteId(clienteIdParam || '');
        setOrigen('');
        setRequiereDespacho(false);
        setFechaEntrega('');
        setObservaciones('');
        setRequiereFactura(true);
        setDescuento(0);
        setInitialized(true);
      }
    }
  }, [initialized, clienteIdParam, isEditing, ordenEditar, archivosOrden]);

  const actualizarItem = useCallback((id: string, config: Partial<ItemCopiadoConfig>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, config }
          : item
      )
    );
  }, []);

  const actualizarPrecioItem = useCallback((id: string, precio: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, precio }
          : item
      )
    );
  }, []);

  const priceCalculatedCallbacks = useMemo(() => {
    const callbacks: Record<string, (precio: number) => void> = {};
    items.forEach((item) => {
      callbacks[item.id] = (precio: number) => {
        actualizarPrecioItem(item.id, precio);
      };
    });
    return callbacks;
  }, [items.map(i => i.id).join(','), actualizarPrecioItem]);

  const actualizarAhorroCantidadItem = useCallback((id: string, ahorro: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ahorroCantidad: Math.max(0, ahorro || 0) }
          : item
      )
    );
  }, []);

  const ahorroCantidadCallbacks = useMemo(() => {
    const callbacks: Record<string, (ahorro: number) => void> = {};
    items.forEach((item) => {
      callbacks[item.id] = (ahorro: number) => {
        actualizarAhorroCantidadItem(item.id, ahorro);
      };
    });
    return callbacks;
  }, [items.map(i => i.id).join(','), actualizarAhorroCantidadItem]);

  const actualizarImpresionPricingItem = useCallback(
    (id: string, info: { valorHoja: number | null; rango: string | null }) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, valorHojaImpresion: info.valorHoja, rangoHojaImpresion: info.rango }
            : item
        )
      );
    },
    []
  );

  const impresionPricingCallbacks = useMemo(() => {
    const callbacks: Record<string, (info: { valorHoja: number | null; rango: string | null }) => void> = {};
    items.forEach((item) => {
      callbacks[item.id] = (info) => {
        actualizarImpresionPricingItem(item.id, info);
      };
    });
    return callbacks;
  }, [items.map(i => i.id).join(','), actualizarImpresionPricingItem]);

  const hojasPorGrupoImpresion = useMemo(() => {
    const totals = new Map<string, number>();

    for (const item of items) {
      const key = buildImpresionGroupKey(item.config);
      if (!key) continue;

      const hojas = Number(item.config.cantidad_hojas || 0);
      const copias = Number(item.config.cantidad_copias || 0);
      if (hojas <= 0 || copias <= 0) continue;

      const hojasTotalesItem = hojas * copias;
      totals.set(key, (totals.get(key) || 0) + hojasTotalesItem);
    }

    return totals;
  }, [items]);

  const hayAgrupacionImpresion = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of items) {
      const key = buildImpresionGroupKey(item.config);
      if (!key) continue;

      const hojas = Number(item.config.cantidad_hojas || 0);
      const copias = Number(item.config.cantidad_copias || 0);
      if (hojas <= 0 || copias <= 0) continue;

      counts.set(key, (counts.get(key) || 0) + 1);
    }

    for (const count of counts.values()) {
      if (count > 1) return true;
    }
    return false;
  }, [items]);

  const eliminarItem = (id: string) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      if (filtered.length > 0) return filtered;
      return [{
        id: `item-${Date.now()}-${Math.random()}`,
        config: { cantidad_copias: 1 },
        isCollapsed: false,
      }];
    });
  };

  const toggleItemCollapse = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isCollapsed: !item.isCollapsed }
          : item
      )
    );
  };

  // Cálculo de totales
  const totales = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.precio || 0), 0);
    const ahorroPorCantidad = items.reduce((sum, item) => sum + (item.ahorroCantidad || 0), 0);
    const descuentoMonto = (subtotal * descuento) / 100;
    const subtotalConDescuento = subtotal - descuentoMonto;
    const iva = requiereFactura ? subtotalConDescuento * 0.21 : 0;
    const total = subtotalConDescuento + iva;
    const totalPagos = pagos.reduce((sum, pago) => sum + pago.monto, 0);
    const saldoPendiente = total - totalPagos;

    return {
      subtotal,
      ahorroPorCantidad,
      descuentoAplicado: descuentoMonto,
      subtotalConDescuento,
      iva,
      total,
      totalPagos,
      saldoPendiente,
    };
  }, [items, descuento, pagos]);

  // Manejo de pagos
  const handleAgregarPago = () => {
    if (!canRegisterPayments) {
      openDialog({
        title: 'Acción no permitida',
        message: 'El rol Operador de taller no puede registrar pagos.',
        variant: 'warning'
      });
      return;
    }
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
    } else {
      // Agregar nuevo pago
      const nuevoPago: PagoTemporal = {
        ...data,
        id: crypto.randomUUID(),
      };
      setPagos(prev => [...prev, nuevoPago]);
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
  };

  const validarFormulario = (estadoInicial: EstadoOrdenCopiado = 'pendiente'): boolean => {
    if (estadoInicial === 'borrador') {
      return true;
    }

    if (!clienteId) {
      openDialog('Error', 'Debes seleccionar un cliente');
      return false;
    }

    if (!origen) {
      openDialog('Error', 'Debes seleccionar un canal de venta');
      return false;
    }

    // Validar que la fecha no sea anterior a hoy (si fue informada)
    const hoy = new Date().toISOString().split('T')[0];
    if (fechaEntrega && fechaEntrega < hoy) {
      openDialog('Error', 'La fecha de entrega no puede ser anterior a hoy');
      return false;
    }

    const itemsCompletos = items.filter((item) => {
      if (item.config.modo_item === 'ploteo_cad') {
        return (
          item.config.ploteo_cad_tipo_papel &&
          item.config.ploteo_cad_ancho_rollo &&
          item.config.ploteo_cad_metros_lineales &&
          item.config.cantidad_copias
        );
      }
      return (
        item.config.tamanio_papel_id &&
        item.config.papel_id &&
        item.config.tipo_tinta &&
        item.config.cara_impresa &&
        item.config.cantidad_hojas &&
        item.config.cantidad_copias
      );
    });

    if (itemsCompletos.length === 0) {
      openDialog('Error', 'Debes configurar al menos un item completo');
      return false;
    }

    return true;
  };

  const guardarOrden = async (estadoInicial: EstadoOrdenCopiado = 'pendiente') => {
    if (!validarFormulario(estadoInicial)) {
      return;
    }

    if (estadoInicial === 'entregada') {
      const saldoPendiente = Math.max(0, Number(totales.saldoPendiente) || 0);
      if (saldoPendiente > 0.01) {
        openDialog(
          'Pago incompleto',
          'Para crear y marcar como entregada, la orden debe estar paga al 100%.'
        );
        return;
      }
    }

    setGuardando(true);

    try {
      // Use T12:00:00 to avoid timezone issues shifting the date to previous day
      const fechaEntregaCompleta = fechaEntrega ? `${fechaEntrega}T12:00:00` : undefined;

      // 1. Crear orden real
      const datosOrden = {
        cliente_id: clienteId || null,
        origen: (origen as CanalVenta) || null,
        orden_trabajo_id: ordenTrabajoIdParam || undefined,
        requiere_despacho: requiereDespacho,
        fecha_entrega_estimada: fechaEntregaCompleta,
        observaciones: observaciones || undefined,
        requiere_factura: requiereFactura,
        total: totales.total,
        subtotal: totales.subtotalConDescuento, // Guardamos el subtotal neto
        total_descuentos: totales.descuentoAplicado,
        estado: estadoInicial,
      };

      if (isEditing && id) {
        // UPDATE MODE
        const success = await updateOrdenCompleta(id, datosOrden, items);

        if (!success) {
          throw new Error('Error al actualizar la orden');
        }

        openDialog(
          'Orden Actualizada',
          estadoInicial === 'borrador'
            ? 'El borrador se guardó correctamente.'
            : 'La orden ha sido actualizada exitosamente.',
          () => {
            navigate(`/app/centro-copiado/ordenes/${id}`);
          }
        );
        return; // Exit early
      }

      // CREATE MODE
      const nuevaOrden = await createOrden(datosOrden);

      if (!nuevaOrden) {
        throw new Error('No se pudo crear la orden');
      }

      const ordenIdFinal = nuevaOrden.id;

      // 2. Asociar archivos temporales con orden real
      try {
        await asociarConOrden(ordenIdFinal, ordenTemporalId);
      } catch (err) {
        console.error('Error asociando archivos:', err);
        // Continuar aunque falle la asociación de archivos
      }

      // 3. Crear items
      for (const item of items) {
        const config = item.config;
        const esPloteoCad = config.modo_item === 'ploteo_cad';

        // Validation based on item type
        if (esPloteoCad) {
          if (
            !config.ploteo_cad_tipo_papel ||
            !config.ploteo_cad_ancho_rollo ||
            !config.ploteo_cad_metros_lineales ||
            !config.cantidad_copias
          ) {
            continue;
          }
        } else {
          // Standard validation
          if (
            !config.tamanio_papel_id ||
            !config.papel_id ||
            !config.tipo_tinta ||
            !config.cara_impresa ||
            !config.cantidad_hojas ||
            !config.cantidad_copias
          ) {
            continue;
          }
        }

        const datosItem = {
          orden_copiado_id: ordenIdFinal,
          // Common
          cantidad_unidades: config.cantidad_copias,
          precio_unitario: (item.precio || 0) / (config.cantidad_copias || 1),
          subtotal: item.precio || 0,
          descripcion: item.descripcion || undefined,

          // Imprimir / Standard Fields (Null if CAD)
          // Imprimir / Standard Fields (Null if CAD)
          tamanio_papel_id: !esPloteoCad ? config.tamanio_papel_id : undefined,
          papel_id: !esPloteoCad ? config.papel_id : undefined,
          tipo_tinta: !esPloteoCad ? config.tipo_tinta : undefined,
          cara_impresa: !esPloteoCad ? config.cara_impresa : undefined,
          cantidad_hojas: !esPloteoCad ? config.cantidad_hojas : undefined,
          tipo_anillado: !esPloteoCad ? config.anillado?.tipo : undefined,
          tipo_plastificado: !esPloteoCad ? config.plastificado?.tipo : undefined,
          con_guillotinado: !esPloteoCad ? !!config.guillotinado : false,

          // Ploteo CAD fields
          es_ploteo_cad: esPloteoCad,
          ploteo_cad_tipo_papel: esPloteoCad ? config.ploteo_cad_tipo_papel : undefined,
          ploteo_cad_ancho_rollo: esPloteoCad ? config.ploteo_cad_ancho_rollo : undefined,
          ploteo_cad_metros_lineales: esPloteoCad ? config.ploteo_cad_metros_lineales : undefined,
        };

        const itemCreado = await createItemImpresion(datosItem);

        // Si el item tiene archivo asociado, actualizar la referencia
        if (itemCreado && item.archivoId) {
          await updateArchivo(item.archivoId, {
            item_generado_id: itemCreado.id,
          });
        }
      }

      // 4. Crear pagos
      for (const pago of pagos) {
        await createPago({
          orden_copiado_id: ordenIdFinal,
          fecha_pago: pago.fecha_pago,
          monto: pago.monto,
          medio_cobro_id: pago.medio_cobro_id,
          referencia_pago: pago.referencia_pago,
          notas: pago.notas,
        });
      }

      // 5. Obtener información de la orden para mostrar en el diálogo
      const { data: ordenFinal } = await supabase
        .from('centro_copiado_ordenes')
        .select('numero_orden, tracking_token')
        .eq('id', ordenIdFinal)
        .single() as { data: any, error: any };

      // Enviar notificación solo si es orden independiente (no asociada a orden de trabajo)
      if (estadoInicial !== 'borrador' && profile?.company_id && clienteId && !ordenTrabajoIdParam) {
        sendWatiMessage({
          companyId: profile.company_id,
          phone: clienteSeleccionado?.whatsapp || '', // Should check this before calling
          template_name: 'nueva_orden_v4',
          parameters: [
            { name: 'nombre_cliente', value: clienteSeleccionado?.nombre_fantasia || clienteSeleccionado?.razon_social || 'Cliente' },
            { name: 'numero_orden', value: ordenFinal?.numero_orden || '' },
            { name: 'fecha_entrega', value: formatDateForWhatsappTemplate(fechaEntrega) },
            { name: 'subtotal', value: totales.subtotal.toLocaleString('es-AR') },
            { name: 'total_iva', value: totales.total.toLocaleString('es-AR') },
            { name: 'url_tracking', value: buildTrackingUrl((ordenFinal as any)?.tracking_token || '') },
            { name: 'nombre_empresa', value: company?.name || 'Tu empresa' },
            { name: '1', value: (ordenFinal as any)?.tracking_token || '' }
          ],
          metadata: {
            tipo: 'nueva_orden_copiado',
            orden_copiado_id: ordenIdFinal
          }
        }).catch(err => console.error('Error sending Wati Copy Order:', err));
      }

      openDialog(
        'Orden Creada',
        `La orden ${ordenFinal?.numero_orden || ''} ha sido creada exitosamente. Estado: ${
          estadoInicial === 'entregada' ? 'Entregada' : estadoInicial === 'borrador' ? 'Borrador' : 'Pendiente'
        }.`,
        () => {
          navigate(
            estadoInicial === 'borrador'
              ? `/app/centro-copiado/ordenes/editar/${ordenIdFinal}`
              : `/app/centro-copiado/ordenes/${ordenIdFinal}`
          );
        }
      );
    } catch (error) {
      console.error('Error al guardar orden:', error);
      openDialog(
        'Error',
        error instanceof Error ? error.message : 'Ocurrió un error al guardar la orden'
      );
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async () => {
    // Limpiar archivos temporales si existen

    try {
      if (!isEditing) {
        await limpiarTemporales(ordenTemporalId);
      }
    } catch (err) {
      console.error('Error limpiando archivos temporales:', err);
    }
    navigate('/app/centro-copiado/ordenes');
  };
  const canSaveDraft = !isEditing || ordenEditar?.estado === 'borrador';
  const primaryButtonText = isEditing
    ? (ordenEditar?.estado === 'borrador' ? 'Confirmar Orden' : 'Guardar Cambios')
    : 'Crear Orden';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => navigate('/app/centro-copiado/ordenes')}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        <div className="lg:col-span-2 space-y-4 lg:pr-6">
          <Card className="overflow-hidden border-slate-200 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-4 text-white">
              <h2 className="text-lg font-semibold tracking-tight">Información General</h2>
              <p className="mt-1 text-xs text-slate-200">Datos base para cotización, facturación y entrega</p>
            </div>
            <div className="space-y-4 bg-gradient-to-b from-slate-50/80 to-white p-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cliente <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          placeholder="Buscar cliente..."
                          onSearch={setSearchTerm}
                          options={clients.map(c => ({
                            value: c.id,
                            label: c.nombre_fantasia || c.razon_social,
                            subtitle: c.nombre_fantasia ? c.razon_social : undefined,
                          }))}
                          value={clienteId}
                          onChange={setClienteId}
                          disabled={!!clienteIdParam || loadingClients}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3"
                        onClick={() => setShowQuickClientModal(true)}
                        title="Crear nuevo cliente rápido"
                        disabled={!!clienteIdParam}
                      >
                        <Plus className="w-5 h-5 text-blue-600" />
                      </Button>
                    </div>
                    {clienteIdParam && (
                      <p className="mt-1 text-xs text-gray-500">
                        Cliente heredado de la orden de trabajo
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Canal de Venta <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      {canalesVenta.map(canal => {
                        const Icon = canal.icon;
                        const isSelected = origen === canal.value;

                        return (
                          <Tooltip key={canal.value} content={canal.label} position="top">
                            <button
                              type="button"
                              onClick={() => setOrigen(canal.value)}
                              className={`
                                flex items-center justify-center p-3 md:p-3.5 rounded-lg border-2 transition-all
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }
    `}
                            >
                              <Icon className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                    {!origen && (
                      <p className="mt-1 text-xs text-amber-700">Seleccioná un canal antes de guardar.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <DatePicker
                      label="Fecha Entrega Estimada"
                      value={fechaEntrega}
                      onChange={(date) => setFechaEntrega(date || '')}
                      minDate={new Date()}
                      placeholder="Seleccionar fecha"
                      workloadData={workloadData}
                      workloadThresholds={{ low: 3, medium: 7 }}
                    />
                    <p className="mt-1 text-xs text-gray-500">Opcional</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Tipo de entrega
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setRequiereDespacho(false)}
                        className={`
                          flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all
                          ${!requiereDespacho
                            ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        <Home className="h-4 w-4" />
                        Retira por local
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequiereDespacho(true)}
                        className={`
                          flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all
                          ${requiereDespacho
                            ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        <Truck className="h-4 w-4" />
                        Requiere envío
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex items-center justify-center">
                    <Switch
                      checked={requiereFactura}
                      onChange={setRequiereFactura}
                      label="Requiere Factura (+21% IVA)"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Notas adicionales sobre la orden..."
                  />
                </div>
              </div>
            </div>
          </Card>

          <Tabs
            tabs={[
              { id: 'items', label: 'Items' },
              { id: 'pagos', label: 'Pagos' },
              { id: 'archivos', label: 'Archivos' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          <div className={activeTab === 'items' ? 'block' : 'hidden'}>
            <Card className="overflow-hidden border-slate-200 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Items de la Orden</h2>
                    <p className="mt-1 text-xs text-slate-200">Configurá impresión, terminaciones y cantidad por ítem</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={agregarItem}
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Item
                  </Button>
                </div>
              </div>

              <div className="space-y-3 bg-gradient-to-b from-slate-50/80 to-white p-4">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
                    No hay ítems todavía. Usá <span className="font-semibold">Agregar Item</span> para comenzar.
                  </div>
                ) : (
                  items.map((item, index) => {
                    const impresionGroupKey = buildImpresionGroupKey(item.config);
                    const hojasParaRangoGrupo = impresionGroupKey
                      ? hojasPorGrupoImpresion.get(impresionGroupKey)
                      : undefined;

                    return (
                      <div key={item.id} id={`item-${item.id}`}>
                        <CentroCopiadoItemForm
                          itemNumber={index + 1}
                          nombreArchivo={item.nombreArchivo}
                          descripcion={item.descripcion}
                          onDescripcionChange={(desc) => {
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, descripcion: desc } : i));
                          }}
                          value={item.config}
                          onChange={(config) => actualizarItem(item.id, config)}
                          onRemove={() => eliminarItem(item.id)}
                          onPriceCalculated={priceCalculatedCallbacks[item.id]}
                          onAhorroCantidadCalculated={ahorroCantidadCallbacks[item.id]}
                          onImpresionPricingCalculated={impresionPricingCallbacks[item.id]}
                          hojasParaRangoGrupo={hojasParaRangoGrupo}
                          isCollapsed={item.isCollapsed}
                          onToggleCollapse={() => toggleItemCollapse(item.id)}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <div className={activeTab === 'pagos' ? 'block' : 'hidden'}>
            <OrdenPagosTab
              totales={totales}
              pagos={pagos}
              onAgregarPago={handleAgregarPago}
              onEditarPago={(pago) => handleEditarPago(pago as PagoTemporal)}
              onEliminarPago={handleEliminarPago}
              readOnly={!canRegisterPayments}
            />
          </div>

          <div className={activeTab === 'archivos' ? 'block' : 'hidden'}>
            <CentroCopiadoArchivosSection
              ordenId={isEditing ? id : undefined}
              ordenTemporalId={!isEditing ? ordenTemporalId : undefined}
              onArchivoGenerado={handleArchivoGenerado}
            />
          </div>
        </div>

        <div ref={resumenContainerRef} className="lg:col-span-1 lg:min-h-[600px]">
          <CentroCopiadoResumenOrden
            items={items.map(item => ({
              id: item.id,
              precio: item.precio || 0,
              config: item.config,
              valorHojaImpresion: item.valorHojaImpresion ?? null,
              rangoHojaImpresion: item.rangoHojaImpresion ?? null,
            }))}
            descuento={descuento}
            onDescuentoChange={setDescuento}
            guardando={guardando}
            onGuardar={guardarOrden}
            onGuardarBorrador={canSaveDraft ? () => guardarOrden('borrador') : undefined}
            onGuardarEntregada={!isEditing ? () => guardarOrden('entregada') : undefined}
            onCancelar={cancelar}
            containerRef={resumenContainerRef}
            requiereFactura={requiereFactura}
            ahorroPorCantidad={totales.ahorroPorCantidad}
            mostrarAhorroPorCantidad={hayAgrupacionImpresion}
            saldoPendiente={totales.saldoPendiente}
            buttonText={primaryButtonText}
            buttonDraftText="Guardar borrador"
            buttonSecondaryText="Crear y entregar"
          />
        </div>
      </div >

      <PagoFormModal
        isOpen={showPagoForm}
        onClose={() => {
          setShowPagoForm(false);
          setEditingPago(undefined);
        }}
        onSubmit={handleGuardarPago}
        saldoPendiente={totales.saldoPendiente}
        pago={editingPago as unknown as (PagoFormData & { id: string; }) | undefined}
      />

      <InfoDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        variant={dialogState.variant}
        buttonText={dialogState.buttonText}
        onClose={closeDialog}
      />

      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        onClientCreated={handleClientCreated}
        initialName={searchTerm}
      />
    </div >
  );
}
