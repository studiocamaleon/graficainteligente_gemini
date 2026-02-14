import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Plus, ArrowLeft, ChevronDown, ChevronUp, MessageSquare, Globe, Store, Smartphone } from 'lucide-react';
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
import type { CanalVenta } from '../../../types/database';

interface ItemWithId {
  id: string;
  config: Partial<ItemCopiadoConfig>;
  precio?: number;
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

export function CrearOrdenCopiado() {
  const navigate = useNavigate();
  const { profile } = useAuth();
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
  const [origen, setOrigen] = useState<CanalVenta>('Mostrador');
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemWithId[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [pagos, setPagos] = useState<PagoTemporal[]>([]);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [editingPago, setEditingPago] = useState<PagoTemporal | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [infoGeneralCollapsed, setInfoGeneralCollapsed] = useState(false);
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
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setAddedItemId(null);
        }
      }, 100);
    }
  }, [items, addedItemId]);

  const handleArchivoGenerado = useCallback((archivoId: string, nombreArchivo: string) => {
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
        setOrigen((ordenEditar.canal_venta as CanalVenta) || 'Mostrador');
        if (ordenEditar.fecha_entrega_estimada) {
          setFechaEntrega(ordenEditar.fecha_entrega_estimada.split('T')[0]);
        }
        setObservaciones(ordenEditar.observaciones || '');
        setRequiereFactura(ordenEditar.requiere_factura || false);

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
        setFechaEntrega('');
        setObservaciones('');
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

  const eliminarItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
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
    const descuentoMonto = (subtotal * descuento) / 100;
    const subtotalConDescuento = subtotal - descuentoMonto;
    const iva = requiereFactura ? subtotalConDescuento * 0.21 : 0;
    const total = subtotalConDescuento + iva;
    const totalPagos = pagos.reduce((sum, pago) => sum + pago.monto, 0);
    const saldoPendiente = total - totalPagos;

    return {
      subtotal,
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

  const validarFormulario = (): boolean => {
    if (!clienteId) {
      openDialog('Error', 'Debes seleccionar un cliente');
      return false;
    }

    if (!fechaEntrega) {
      openDialog('Error', 'La fecha de entrega es obligatoria');
      return false;
    }

    // Validar que la fecha no sea anterior a hoy
    const hoy = new Date().toISOString().split('T')[0];
    if (fechaEntrega < hoy) {
      openDialog('Error', 'La fecha de entrega no puede ser anterior a hoy');
      return false;
    }

    const itemsCompletos = items.filter(
      (item) =>
        (item) => {
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
        }
    );

    if (itemsCompletos.length === 0) {
      openDialog('Error', 'Debes configurar al menos un item completo');
      return false;
    }

    return true;
  };

  const guardarOrden = async () => {
    if (!validarFormulario()) {
      return;
    }

    setGuardando(true);

    try {
      // Use T12:00:00 to avoid timezone issues shifting the date to previous day
      const fechaEntregaCompleta = `${fechaEntrega}T12:00:00`;

      // 1. Crear orden real
      const datosOrden = {
        cliente_id: clienteId,
        origen,
        orden_trabajo_id: ordenTrabajoIdParam || undefined,
        fecha_entrega_estimada: fechaEntregaCompleta,
        observaciones: observaciones || undefined,
        requiere_factura: requiereFactura,
        total: totales.total,
        subtotal: totales.subtotalConDescuento, // Guardamos el subtotal neto
        total_descuentos: totales.descuentoAplicado,
      };

      if (isEditing && id) {
        // UPDATE MODE
        const success = await updateOrdenCompleta(id, datosOrden, items);

        if (!success) {
          throw new Error('Error al actualizar la orden');
        }

        openDialog(
          'Orden Actualizada',
          `La orden ha sido actualizada exitosamente.`,
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
      if (profile?.company_id && clienteId && !ordenTrabajoIdParam) {
        sendWatiMessage({
          companyId: profile.company_id,
          phone: clienteSeleccionado?.whatsapp || '', // Should check this before calling
          template_name: 'nueva_orden_v4',
          parameters: [
            { name: 'nombre_cliente', value: clienteSeleccionado?.nombre_fantasia || clienteSeleccionado?.razon_social || 'Cliente' },
            { name: 'numero_orden', value: ordenFinal?.numero_orden || '' },
            { name: 'fecha_entrega', value: fechaEntrega ? new Date(fechaEntrega).toLocaleDateString('es-AR') : 'A confirmar' },
            { name: 'subtotal', value: totales.subtotal.toLocaleString('es-AR') },
            { name: 'total_iva', value: totales.total.toLocaleString('es-AR') },
            { name: 'url_tracking', value: buildTrackingUrl((ordenFinal as any)?.tracking_token || '') },
            { name: 'nombre_empresa', value: 'Gráfica Inteligente' },
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
        `La orden ${ordenFinal?.numero_orden || ''} ha sido creada exitosamente. Estado: Pendiente.`,
        () => {
          navigate(`/app/centro-copiado/ordenes/${ordenIdFinal}`);
        }
      );
    } catch (error) {
      console.error('Error al guardar orden:', error);
      openDialog(
        'Error',
        error instanceof Error ? error.message : 'Ocurrió un error al guardar la orden'
      );
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

  const infoGeneralCompleta = clienteId && fechaEntrega;

  useEffect(() => {
    if (infoGeneralCompleta) {
      setInfoGeneralCollapsed(true);
    }
  }, [infoGeneralCompleta]);

  const clienteSeleccionado = clients.find(c => c.id === clienteId);

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
          <Card>
            <button
              onClick={() => setInfoGeneralCollapsed(!infoGeneralCollapsed)}
              className="w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-t-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">Información General</h2>
                {infoGeneralCollapsed && clienteSeleccionado && (
                  <span className="text-sm text-gray-600">
                    {clienteSeleccionado.nombre_fantasia}
                    {fechaEntrega && ` • ${new Date(fechaEntrega).toLocaleDateString()} `}
                  </span>
                )}
              </div>
              {infoGeneralCollapsed ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {!infoGeneralCollapsed && (
              <div className="p-4 pt-0">
                <div className="space-y-4">
                  <div>
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

                  <div>
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
                                flex items - center justify - center p - 4 rounded - lg border - 2 transition - all
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }
    `}
                            >
                              <Icon className="w-6 h-6" />
                            </button>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Switch
                      checked={requiereFactura}
                      onChange={setRequiereFactura}
                      label="Requiere Factura (+21% IVA)"
                    />
                  </div>

                  <div>
                    <DatePicker
                      label="Fecha Entrega Estimada"
                      value={fechaEntrega}
                      onChange={(date) => setFechaEntrega(date || '')}
                      minDate={new Date()}
                      placeholder="Seleccionar fecha"
                      required
                      workloadData={workloadData}
                      workloadThresholds={{ low: 3, medium: 7 }}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notas adicionales sobre la orden..."
                  />
                </div>
              </div>
            )}
          </Card>

          <div className="bg-white p-4 rounded-b-lg border-x border-b border-gray-200">
            <CentroCopiadoArchivosSection
              ordenId={isEditing ? id : undefined}
              ordenTemporalId={!isEditing ? ordenTemporalId : undefined}
              onArchivoGenerado={handleArchivoGenerado}
            />
          </div>

          <Tabs
            tabs={[
              { id: 'items', label: 'Items' },
              { id: 'pagos', label: 'Pagos' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          <div className={activeTab === 'items' ? 'block' : 'hidden'}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Items de la Orden</h2>
              <Button variant="primary" onClick={agregarItem}>
                <Plus className="w-4 h-4" />
                Agregar Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} id={`item - ${item.id} `}>
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
                    isCollapsed={item.isCollapsed}
                    onToggleCollapse={() => toggleItemCollapse(item.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={activeTab === 'pagos' ? 'block' : 'hidden'}>
            <OrdenPagosTab
              totales={totales}
              pagos={pagos}
              onAgregarPago={handleAgregarPago}
              onEditarPago={(pago) => handleEditarPago(pago as PagoTemporal)}
              onEliminarPago={handleEliminarPago}
              readOnly={false}
            />
          </div>
        </div>

        <div ref={resumenContainerRef} className="lg:col-span-1 lg:min-h-[600px]">
          <CentroCopiadoResumenOrden
            items={items.map(item => ({
              id: item.id,
              precio: item.precio || 0,
              config: item.config
            }))}
            descuento={descuento}
            onDescuentoChange={setDescuento}
            guardando={guardando}
            onGuardar={guardarOrden}
            onCancelar={cancelar}
            containerRef={resumenContainerRef}
            requiereFactura={requiereFactura}
            buttonText={isEditing ? 'Guardar Cambios' : 'Crear Orden'}
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
