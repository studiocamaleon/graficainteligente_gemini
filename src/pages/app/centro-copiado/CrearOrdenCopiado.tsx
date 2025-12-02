import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ArrowLeft, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Tabs } from '../../../components/ui/Tabs';
import { CentroCopiadoItemForm, ItemCopiadoConfig } from '../../../components/centro-copiado/CentroCopiadoItemForm';
import { CentroCopiadoResumenOrden } from '../../../components/centro-copiado/CentroCopiadoResumenOrden';
import { CentroCopiadoArchivosSection } from '../../../components/centro-copiado/CentroCopiadoArchivosSection';
import { OrdenPagosTab } from '../../../components/orders/OrdenPagosTab';
import { PagoFormModal } from '../../../components/orders/PagoFormModal';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useClients } from '../../../hooks/useClients';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import { useCentroCopiadoOrdenItems } from '../../../hooks/useCentroCopiadoOrdenItems';
import { useCentroCopiadoArchivos } from '../../../hooks/useCentroCopiadoArchivos';
import { useCentroCopiadoOrdenPagos } from '../../../hooks/useCentroCopiadoOrdenPagos';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

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
  const clienteIdParam = searchParams.get('cliente_id');
  const ordenTrabajoIdParam = searchParams.get('orden_trabajo_id');

  // Generar ID temporal único para archivos
  const [ordenTemporalId] = useState(() =>
    `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`
  );

  const [activeTab, setActiveTab] = useState('items');
  const [clienteId, setClienteId] = useState<string>(clienteIdParam || '');
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

  const { clients, loading: loadingClients } = useClients({ page: 1, itemsPerPage: 100 });
  const { createOrden } = useCentroCopiadoOrdenes();
  const { createItemImpresion } = useCentroCopiadoOrdenItems();
  const { asociarConOrden, limpiarTemporales, updateArchivo } = useCentroCopiadoArchivos({ ordenTemporalId });
  const { createPago } = useCentroCopiadoOrdenPagos();
  const { dialogState, openDialog, closeDialog } = useInfoDialog();

  usePageHeader('Crea una nueva orden de copiado con items personalizados');

  const handleArchivoGenerado = useCallback((archivoId: string, nombreArchivo: string) => {
    // Colapsar todos los items existentes
    setItems((prev) =>
      prev.map(item => ({ ...item, isCollapsed: true }))
    );

    // Crear nuevo item en blanco para que el usuario configure manualmente
    const nuevoItem: ItemWithId = {
      id: `item-${Date.now()}-${Math.random()}`,
      config: {
        cantidad_copias: 1,
      },
      isCollapsed: false,
      archivoId,
      nombreArchivo,
    };
    setItems((prev) => [...prev, nuevoItem]);
  }, []);

  const agregarItem = useCallback(() => {
    setItems((prev) =>
      prev.map(item => ({ ...item, isCollapsed: true }))
    );

    const nuevoItem: ItemWithId = {
      id: `item-${Date.now()}-${Math.random()}`,
      config: {
        cantidad_copias: 1,
      },
      isCollapsed: false,
    };
    setItems((prev) => [...prev, nuevoItem]);
  }, []);

  useEffect(() => {
    if (!initialized) {
      setItems([]);
      setClienteId(clienteIdParam || '');
      setFechaEntrega('');
      setObservaciones('');
      setDescuento(0);
      // No agregar item inicial - se crean al subir archivos
      setInitialized(true);
    }
  }, [initialized, clienteIdParam]);

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
    const iva = 0; // Centro de copiado no tiene IVA
    const total = subtotalConDescuento;
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

    const itemsCompletos = items.filter(
      (item) =>
        item.config.tamanio_papel_id &&
        item.config.papel_id &&
        item.config.tipo_tinta &&
        item.config.cara_impresa &&
        item.config.cantidad_hojas &&
        item.config.cantidad_copias
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
      const fechaEntregaCompleta = fechaEntrega
        ? `${fechaEntrega}T00:00:00`
        : undefined;

      // 1. Crear orden real
      const datosOrden = {
        cliente_id: clienteId,
        orden_trabajo_id: ordenTrabajoIdParam || undefined,
        fecha_entrega_estimada: fechaEntregaCompleta,
        observaciones: observaciones || undefined,
      };

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

        const datosItem = {
          orden_copiado_id: ordenIdFinal,
          tamanio_papel_id: config.tamanio_papel_id,
          papel_id: config.papel_id,
          tipo_tinta: config.tipo_tinta,
          cara_impresa: config.cara_impresa,
          cantidad_hojas: config.cantidad_hojas,
          cantidad_unidades: config.cantidad_copias,
          tipo_anillado: config.anillado?.tipo,
          tipo_plastificado: config.plastificado?.tipo,
          cantidad_plastificado: config.plastificado?.todas_hojas
            ? config.cantidad_hojas
            : config.plastificado?.cantidad_especifica,
          precio_unitario: (item.precio || 0) / (config.cantidad_copias || 1),
          subtotal: item.precio || 0,
          descripcion: item.descripcion || undefined,
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
        .select('numero_orden')
        .eq('id', ordenIdFinal)
        .single();

      // Enviar notificación solo si es orden independiente (no asociada a orden de trabajo)
      if (profile?.company_id && clienteId && !ordenTrabajoIdParam) {
        supabase.functions.invoke('enviar-notificacion-orden', {
          body: {
            orden_id: ordenIdFinal,
            company_id: profile.company_id,
            tipo: 'nueva_orden_copiado',
            orden_tipo: 'copiado'
          }
        }).then(({ data, error }) => {
          if (error) {
            console.error('[CrearOrdenCopiado] Error al enviar notificación:', error);
          } else if (data?.success) {
            console.log('[CrearOrdenCopiado] Notificación enviada exitosamente');
          }
        }).catch((err) => {
          console.error('[CrearOrdenCopiado] Error al invocar Edge Function:', err);
        });
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
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async () => {
    // Limpiar archivos temporales si existen
    try {
      await limpiarTemporales(ordenTemporalId);
    } catch (err) {
      console.error('Error limpiando archivos temporales:', err);
    }
    navigate('/app/centro-copiado/ordenes');
  };

  const clientesOptions = clients.map((client) => ({
    value: client.id,
    label: `${client.nombre_fantasia} (${client.numero_documento})`,
  }));

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
                    {fechaEntrega && ` • ${new Date(fechaEntrega).toLocaleDateString()}`}
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
                      Cliente *
                    </label>
                    <SearchableSelect
                      options={clientesOptions}
                      value={clienteId}
                      onChange={setClienteId}
                      placeholder="Buscar cliente..."
                      disabled={!!clienteIdParam || loadingClients}
                    />
                    {clienteIdParam && (
                      <p className="mt-1 text-xs text-gray-500">
                        Cliente heredado de la orden de trabajo
                      </p>
                    )}
                  </div>

                  <div>
                    <DatePicker
                      label="Fecha Entrega Estimada"
                      value={fechaEntrega}
                      onChange={(date) => setFechaEntrega(date || '')}
                      minDate={new Date()}
                      placeholder="Seleccionar fecha"
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

          <CentroCopiadoArchivosSection
            ordenTemporalId={ordenTemporalId}
            onArchivoGenerado={handleArchivoGenerado}
            disabled={false}
          />

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
                <CentroCopiadoItemForm
                  key={item.id}
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
              ))}
            </div>
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
        </div>

        <div ref={resumenContainerRef} className="lg:col-span-1 lg:min-h-[600px]">
          <CentroCopiadoResumenOrden
            items={items}
            descuento={descuento}
            onDescuentoChange={setDescuento}
            onGuardar={guardarOrden}
            onCancelar={cancelar}
            guardando={guardando}
            containerRef={resumenContainerRef}
          />
        </div>
      </div>

      <PagoFormModal
        isOpen={showPagoForm}
        onClose={() => {
          setShowPagoForm(false);
          setEditingPago(undefined);
        }}
        onSubmit={handleGuardarPago}
        saldoPendiente={totales.saldoPendiente}
        pago={editingPago}
      />

      <InfoDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        variant={dialogState.variant}
        buttonText={dialogState.buttonText}
        onClose={closeDialog}
      />
    </div>
  );
}
