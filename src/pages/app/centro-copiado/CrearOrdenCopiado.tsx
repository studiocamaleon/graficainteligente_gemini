import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ArrowLeft, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { CentroCopiadoItemForm, ItemCopiadoConfig } from '../../../components/centro-copiado/CentroCopiadoItemForm';
import { CentroCopiadoResumenOrden } from '../../../components/centro-copiado/CentroCopiadoResumenOrden';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useClients } from '../../../hooks/useClients';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import { useCentroCopiadoOrdenItems } from '../../../hooks/useCentroCopiadoOrdenItems';
import { useInfoDialog } from '../../../hooks/useInfoDialog';
import { InfoDialog } from '../../../components/ui/InfoDialog';

interface ItemWithId {
  id: string;
  config: Partial<ItemCopiadoConfig>;
  precio?: number;
  isCollapsed?: boolean;
}

export function CrearOrdenCopiado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteIdParam = searchParams.get('cliente_id');
  const ordenTrabajoIdParam = searchParams.get('orden_trabajo_id');

  const [clienteId, setClienteId] = useState<string>(clienteIdParam || '');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [horaEntrega, setHoraEntrega] = useState('09:00');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemWithId[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [infoGeneralCollapsed, setInfoGeneralCollapsed] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { clients, loading: loadingClients } = useClients({ page: 1, itemsPerPage: 100 });
  const { createOrden } = useCentroCopiadoOrdenes();
  const { createItemImpresion } = useCentroCopiadoOrdenItems();
  const { dialogState, openDialog, closeDialog } = useInfoDialog();

  usePageHeader('Crea una nueva orden de copiado con items personalizados');

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
      setHoraEntrega('09:00');
      setObservaciones('');
      setDescuento(0);
      agregarItem();
      setInitialized(true);
    }
  }, [initialized, agregarItem, clienteIdParam]);

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
      const fechaEntregaCompleta = fechaEntrega && horaEntrega
        ? `${fechaEntrega}T${horaEntrega}:00`
        : undefined;

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
          orden_copiado_id: nuevaOrden.id,
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
          precio_unitario: item.precio || 0,
          subtotal: item.precio || 0,
        };

        await createItemImpresion(datosItem);
      }

      openDialog(
        'Orden Creada',
        `La orden ${nuevaOrden.numero_orden} ha sido creada exitosamente. Estado: Pendiente.`,
        () => {
          navigate(`/app/centro-copiado/ordenes/${nuevaOrden.id}`);
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

  const cancelar = () => {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
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
                    {fechaEntrega && horaEntrega && ` a las ${horaEntrega}`}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha Entrega Estimada
                      </label>
                      <Input
                        type="date"
                        value={fechaEntrega}
                        onChange={(e) => setFechaEntrega(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hora Entrega
                      </label>
                      <Input
                        type="time"
                        value={horaEntrega}
                        onChange={(e) => setHoraEntrega(e.target.value)}
                      />
                    </div>
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

          <div className="flex items-center justify-between">
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

        <div className="lg:col-span-1">
          <CentroCopiadoResumenOrden
            items={items}
            descuento={descuento}
            onDescuentoChange={setDescuento}
            onGuardar={guardarOrden}
            onCancelar={cancelar}
            guardando={guardando}
          />
        </div>
      </div>

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
