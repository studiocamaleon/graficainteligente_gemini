import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { usePresupuesto } from '../../../hooks/usePresupuesto';
import { usePresupuestos } from '../../../hooks/usePresupuestos';
import { usePresupuestoItems } from '../../../hooks/usePresupuestoItems';
import { useClients } from '../../../hooks/useClients';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { PresupuestoGeneralSection } from '../../../components/presupuestos/PresupuestoGeneralSection';
import { PresupuestoItemsSection } from '../../../components/presupuestos/PresupuestoItemsSection';
import { ItemsPendientesCotizacion } from '../../../components/presupuestos/ItemsPendientesCotizacion';
import { PresupuestoCondicionesSection } from '../../../components/presupuestos/PresupuestoCondicionesSection';
import { PresupuestoResumenSection } from '../../../components/presupuestos/PresupuestoResumenSection';
import { usePresupuestoValidation } from '../../../hooks/usePresupuestoValidation';
import type { CanalVenta, PresupuestoItem, CreatePresupuestoItemData, TotalesPresupuesto } from '../../../types/presupuestos';
import { generarDescripcionCompleta } from '../../../utils/formatPresupuestoConfig';

type TabId = 'general' | 'items' | 'condiciones' | 'resumen';

export default function EditarPresupuesto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { presupuesto, loading: loadingPresupuesto } = usePresupuesto(id || '');
  const { items: existingItems, loading: loadingItems, updateItem, addItem, deleteItem: deleteItemDB } = usePresupuestoItems(id || '');
  const { updatePresupuesto, enviarPresupuesto } = usePresupuestos();
  const { clients } = useClients();

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    clienteId: '',
    vendedorId: user?.id || '',
    canalVenta: '' as CanalVenta | '',
    fechaEntregaEstimada: '',
    fechaValidez: '',
    notasInternas: '',
    condicionesComerciales: '',
  });

  const [items, setItems] = useState<PresupuestoItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar datos del presupuesto cuando esté disponible
  useEffect(() => {
    if (presupuesto) {
      // Verificar que solo se puede editar si está en estado borrador
      if (presupuesto.estado !== 'borrador') {
        setErrorMessage('Solo se pueden editar presupuestos en estado borrador');
        setTimeout(() => {
          navigate(`/app/presupuestos/${presupuesto.id}`);
        }, 2000);
        return;
      }

      setFormData({
        clienteId: presupuesto.cliente_id || '',
        vendedorId: presupuesto.vendedor_id || '',
        canalVenta: presupuesto.canal_venta || '',
        fechaEntregaEstimada: presupuesto.fecha_entrega_estimada?.split('T')[0] || '',
        fechaValidez: presupuesto.fecha_validez?.split('T')[0] || '',
        notasInternas: presupuesto.notas_internas || '',
        condicionesComerciales: presupuesto.condiciones_comerciales || '',
      });
    }
  }, [presupuesto, navigate]);

  // Cargar items existentes
  useEffect(() => {
    if (existingItems) {
      setItems(existingItems);
    }
  }, [existingItems]);

  const tabs = [
    { id: 'general' as TabId, label: '1. General', icon: null },
    { id: 'items' as TabId, label: '2. Items', icon: null },
    { id: 'condiciones' as TabId, label: '3. Condiciones', icon: null },
    { id: 'resumen' as TabId, label: '4. Resumen', icon: null },
  ];

  const validateGeneral = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.clienteId) newErrors.clienteId = 'Selecciona un cliente';
    if (!formData.vendedorId) newErrors.vendedorId = 'Selecciona un vendedor';
    if (!formData.canalVenta) newErrors.canalVenta = 'Selecciona un canal';
    if (!formData.fechaEntregaEstimada) {
      newErrors.fechaEntregaEstimada = 'La fecha de entrega es obligatoria';
    } else {
      const hoy = new Date().toISOString().split('T')[0];
      if (formData.fechaEntregaEstimada < hoy) {
        newErrors.fechaEntregaEstimada = 'La fecha de entrega no puede ser anterior a hoy';
      }
    }
    if (!formData.fechaValidez) newErrors.fechaValidez = 'Selecciona una fecha';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateItems = (): boolean => {
    if (items.length === 0) {
      setErrorMessage('Debes agregar al menos un item');
      return false;
    }
    return true;
  };

  const handleAddItemSistema = async (item: any) => {
    if (!presupuesto) return;

    // Generar descripción automática desde configuración si no viene descripción
    const descripcionFinal = generarDescripcionCompleta(
      item.producto_nombre,
      item.configuracion,
      item.categoria,
      item.descripcion
    );

    const itemData: CreatePresupuestoItemData = {
      presupuesto_id: presupuesto.id,
      tipo_item: 'producto_sistema',
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre,
      producto_categoria: item.categoria,
      configuracion: item.configuracion || {},
      cantidad: item.cantidad,
      precio_base: item.precio_base || 0,
      precio_servicios: item.precio_servicios || 0,
      precio_acabados: item.precio_acabados || 0,
      precio_unitario_final: item.precio_unitario_final,
      precio_total: item.precio_total,
      descripcion: descripcionFinal,
      tiempo_produccion_dias: item.tiempo_produccion_dias,
    };

    const result = await addItem(itemData);
    if (result) {
      setItems([...items, result]);
    }
  };

  const handleAddItemPersonalizado = async (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final?: number | null;
    tiempo_produccion_dias?: number;
  }) => {
    if (!presupuesto) return;

    const precioUnitario = item.precio_unitario_final ?? null;
    const precioTotal = precioUnitario !== null ? item.cantidad * precioUnitario : null;

    const itemData: CreatePresupuestoItemData = {
      presupuesto_id: presupuesto.id,
      tipo_item: 'item_personalizado',
      producto_nombre: item.producto_nombre,
      configuracion: {},
      cantidad: item.cantidad,
      precio_base: 0,
      precio_servicios: 0,
      precio_acabados: 0,
      precio_unitario_final: precioUnitario,
      precio_total: precioTotal,
      descripcion: item.descripcion,
      tiempo_produccion_dias: item.tiempo_produccion_dias,
    };

    const result = await addItem(itemData);
    if (result) {
      setItems([...items, result]);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const success = await deleteItemDB(itemId);
    if (success) {
      setItems(items.filter((item) => item.id !== itemId));
    }
  };

  const handleAsignarPrecio = async (itemId: string, precioUnitario: number): Promise<boolean> => {
    try {
      const itemIndex = items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) return false;

      const item = items[itemIndex];
      const precioTotal = item.cantidad * precioUnitario;

      // Actualizar en BD
      const success = await updateItem(itemId, {
        precio_unitario_final: precioUnitario,
        precio_total: precioTotal,
      });

      if (success) {
        // Actualizar en estado local
        const updatedItems = [...items];
        updatedItems[itemIndex] = {
          ...item,
          precio_unitario_final: precioUnitario,
          precio_total: precioTotal,
        };
        setItems(updatedItems);

        // Actualizar totales del presupuesto
        await actualizarTotales(updatedItems);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error asignando precio:', error);
      return false;
    }
  };

  const actualizarTotales = async (itemsActualizados: PresupuestoItem[]) => {
    if (!presupuesto) return;

    const totales = calcularTotales(itemsActualizados);

    await supabase
      .from('presupuestos')
      .update({
        subtotal: totales.subtotal,
        total: totales.subtotal,
      })
      .eq('id', presupuesto.id);
  };

  const calcularTotales = (itemsList: PresupuestoItem[] = items): TotalesPresupuesto => {
    const itemsCompletos = itemsList.filter(
      (item) => item.precio_unitario_final !== null && item.precio_total !== null
    );
    const itemsPendientes = itemsList.filter(
      (item) => item.precio_unitario_final === null || item.precio_total === null
    );

    const subtotal = itemsCompletos.reduce(
      (sum, item) => sum + Number(item.precio_total),
      0
    );

    return {
      subtotal,
      totalItems: itemsList.length,
      totalUnidades: itemsList.reduce((sum, item) => sum + Number(item.cantidad), 0),
      itemsCompletos: itemsCompletos.length,
      itemsPendientes: itemsPendientes.length,
      tienePendientes: itemsPendientes.length > 0,
    };
  };

  const totales = calcularTotales();
  const validation = usePresupuestoValidation(totales);

  const handleGuardar = async (enviar: boolean = false) => {
    if (!presupuesto) return;

    setErrorMessage(null);

    if (!validateGeneral()) {
      setActiveTab('general');
      return;
    }

    if (!validateItems()) {
      setActiveTab('items');
      return;
    }

    setIsSubmitting(true);

    try {
      // Actualizar datos generales del presupuesto
      const success = await updatePresupuesto(presupuesto.id, {
        cliente_id: formData.clienteId,
        vendedor_id: formData.vendedorId,
        canal_venta: formData.canalVenta as CanalVenta,
        fecha_entrega_estimada: formData.fechaEntregaEstimada,
        fecha_validez: formData.fechaValidez,
        condiciones_comerciales: formData.condicionesComerciales,
        notas_internas: formData.notasInternas,
      });

      if (!success) {
        throw new Error('Error al actualizar presupuesto');
      }

      // Si se debe enviar, cambiar estado
      if (enviar) {
        const enviado = await enviarPresupuesto(presupuesto.id);
        if (!enviado) {
          throw new Error('Error al enviar presupuesto');
        }
      }

      // Actualizar totales finales
      await actualizarTotales(items);

      setSuccessMessage(
        enviar
          ? 'Presupuesto actualizado y enviado correctamente'
          : 'Presupuesto actualizado correctamente'
      );

      setTimeout(() => {
        navigate(`/app/presupuestos/${presupuesto.id}`);
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error al guardar presupuesto');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingPresupuesto || loadingItems) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!presupuesto) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/presupuestos/lista')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">
            Presupuesto no encontrado
          </p>
        </div>
      </div>
    );
  }

  const clienteNombre =
    (clients || []).find((c) => c.id === formData.clienteId)?.razon_social || '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar Presupuesto ${presupuesto.numero_presupuesto}`}
        description="Modifica los datos del presupuesto y asigna precios a los items pendientes"
        backButton={{
          label: 'Volver',
          onClick: () => navigate(`/app/presupuestos/${presupuesto.id}`),
        }}
      />

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />

        <div className="p-6">
          {activeTab === 'general' && (
            <PresupuestoGeneralSection
              clienteId={formData.clienteId}
              vendedorId={formData.vendedorId}
              canalVenta={formData.canalVenta}
              fechaEntregaEstimada={formData.fechaEntregaEstimada}
              fechaValidez={formData.fechaValidez}
              notasInternas={formData.notasInternas}
              onClienteChange={(id) => setFormData({ ...formData, clienteId: id })}
              onVendedorChange={(id) => setFormData({ ...formData, vendedorId: id })}
              onCanalVentaChange={(canal) => setFormData({ ...formData, canalVenta: canal })}
              onFechaEntregaEstimadaChange={(fecha) => setFormData({ ...formData, fechaEntregaEstimada: fecha })}
              onFechaValidezChange={(fecha) => setFormData({ ...formData, fechaValidez: fecha })}
              onNotasInternasChange={(notas) => setFormData({ ...formData, notasInternas: notas })}
              errors={errors}
            />
          )}

          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Banner de items pendientes */}
              {totales.tienePendientes && (
                <ItemsPendientesCotizacion
                  items={items.filter(
                    (item) => item.precio_unitario_final === null || item.precio_total === null
                  ).map(item => ({
                    id: item.id,
                    producto_nombre: item.producto_nombre,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    configuracion: item.configuracion,
                  }))}
                  porcentajeCompletitud={validation.porcentajeCompletitud}
                  onAsignarPrecio={handleAsignarPrecio}
                />
              )}

              {/* Lista de items */}
              <PresupuestoItemsSection
                items={items}
                onAddItemSistema={handleAddItemSistema}
                onAddItemPersonalizado={handleAddItemPersonalizado}
                onEditItem={() => {}}
                onDeleteItem={handleDeleteItem}
                onAsignarPrecio={handleAsignarPrecio}
              />
            </div>
          )}

          {activeTab === 'condiciones' && (
            <PresupuestoCondicionesSection
              condicionesText={formData.condicionesComerciales}
              onCondicionesChange={(text) =>
                setFormData({ ...formData, condicionesComerciales: text })
              }
            />
          )}

          {activeTab === 'resumen' && (
            <PresupuestoResumenSection
              items={items}
              clienteNombre={clienteNombre}
              fechaValidez={formData.fechaValidez}
              condicionesText={formData.condicionesComerciales}
            />
          )}
        </div>
      </div>

      <div className="flex justify-between items-center bg-white rounded-lg shadow-sm p-6">
        <Button variant="secondary" onClick={() => navigate(`/app/presupuestos/${presupuesto.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cancelar
        </Button>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => handleGuardar(false)}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
          <div className="relative">
            <Button
              onClick={() => handleGuardar(true)}
              isLoading={isSubmitting}
              disabled={isSubmitting || !validation.puedeEnviar}
              title={validation.mensajeValidacion || undefined}
            >
              <Send className="w-4 h-4 mr-2" />
              Guardar y Enviar
            </Button>
            {validation.mensajeValidacion && !isSubmitting && (
              <div className="absolute -top-12 right-0 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800 whitespace-nowrap shadow-lg">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                {validation.mensajeValidacion}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
