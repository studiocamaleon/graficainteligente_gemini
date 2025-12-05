import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
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

export default function CrearPresupuesto() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { createPresupuesto } = usePresupuestos();
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

  const handleAddItemSistema = (item: any) => {
    // Generar descripción automática desde configuración si no viene descripción
    const descripcionFinal = generarDescripcionCompleta(
      item.producto_nombre,
      item.configuracion,
      item.categoria,
      item.descripcion
    );

    const nuevoItem: PresupuestoItem = {
      id: `temp-${Date.now()}`,
      presupuesto_id: '',
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems([...items, nuevoItem]);
  };

  const handleAddItemPersonalizado = (item: {
    producto_nombre: string;
    descripcion: string;
    cantidad: number;
    precio_unitario_final?: number | null;
    tiempo_produccion_dias?: number;
  }) => {
    const precioUnitario = item.precio_unitario_final ?? null;
    const precioTotal = precioUnitario !== null ? item.cantidad * precioUnitario : null;

    const nuevoItem: PresupuestoItem = {
      id: `temp-${Date.now()}`,
      presupuesto_id: '',
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems([...items, nuevoItem]);
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleAsignarPrecio = async (itemId: string, precioUnitario: number): Promise<boolean> => {
    try {
      const itemIndex = items.findIndex(item => item.id === itemId);
      if (itemIndex === -1) return false;

      const item = items[itemIndex];
      const precioTotal = item.cantidad * precioUnitario;

      const updatedItems = [...items];
      updatedItems[itemIndex] = {
        ...item,
        precio_unitario_final: precioUnitario,
        precio_total: precioTotal,
      };

      setItems(updatedItems);
      return true;
    } catch (error) {
      console.error('Error asignando precio:', error);
      return false;
    }
  };

  const calcularTotales = (): TotalesPresupuesto => {
    const itemsCompletos = items.filter(
      (item) => item.precio_unitario_final !== null && item.precio_total !== null
    );
    const itemsPendientes = items.filter(
      (item) => item.precio_unitario_final === null || item.precio_total === null
    );

    const subtotal = itemsCompletos.reduce(
      (sum, item) => sum + Number(item.precio_total),
      0
    );

    return {
      subtotal,
      totalItems: items.length,
      totalUnidades: items.reduce((sum, item) => sum + Number(item.cantidad), 0),
      itemsCompletos: itemsCompletos.length,
      itemsPendientes: itemsPendientes.length,
      tienePendientes: itemsPendientes.length > 0,
    };
  };

  const totales = calcularTotales();
  const validation = usePresupuestoValidation(totales);

  const handleGuardar = async (enviar: boolean = false) => {
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
      const totales = calcularTotales();
      const presupuesto = await createPresupuesto({
        cliente_id: formData.clienteId,
        vendedor_id: formData.vendedorId,
        canal_venta: formData.canalVenta as CanalVenta,
        fecha_entrega_estimada: formData.fechaEntregaEstimada,
        fecha_validez: formData.fechaValidez,
        condiciones_comerciales: formData.condicionesComerciales,
        notas_internas: formData.notasInternas,
        estado: enviar ? 'enviado' : 'borrador',
      });

      if (!presupuesto) {
        throw new Error('Error al crear presupuesto');
      }

      // Agregar todos los items al presupuesto
      for (const item of items) {
        const itemData: CreatePresupuestoItemData = {
          presupuesto_id: presupuesto.id,
          tipo_item: item.tipo_item,
          producto_id: item.producto_id,
          producto_nombre: item.producto_nombre,
          producto_categoria: item.producto_categoria,
          configuracion: item.configuracion,
          cantidad: item.cantidad,
          precio_base: item.precio_base,
          precio_servicios: item.precio_servicios,
          precio_acabados: item.precio_acabados,
          precio_unitario_final: item.precio_unitario_final,
          precio_total: item.precio_total,
          descripcion: item.descripcion,
          tiempo_produccion_dias: item.tiempo_produccion_dias,
        };

        const { error: itemError } = await supabase
          .from('presupuestos_items')
          .insert(itemData);

        if (itemError) {
          console.error('Error al agregar item:', itemError);
          throw new Error(`Error al agregar item: ${itemError.message}`);
        }
      }

      // Actualizar totales del presupuesto
      await supabase
        .from('presupuestos')
        .update({
          subtotal: totales.subtotal,
          total: totales.total,
        })
        .eq('id', presupuesto.id);

      setSuccessMessage(
        enviar
          ? 'Presupuesto creado y enviado correctamente'
          : 'Presupuesto guardado como borrador'
      );

      // Nota: La notificación de WhatsApp se envía automáticamente
      // mediante el trigger on_presupuesto_creado_enviado cuando
      // el estado es 'enviado'

      setTimeout(() => {
        navigate(`/app/presupuestos/${presupuesto.id}`);
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error al guardar presupuesto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clienteNombre =
    (clients || []).find((c) => c.id === formData.clienteId)?.razon_social || '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo Presupuesto"
        description="Crea un presupuesto para enviar a tus clientes"
        backButton={{
          label: 'Volver',
          onClick: () => navigate('/app/presupuestos/lista'),
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
        <Button variant="secondary" onClick={() => navigate('/app/presupuestos/lista')}>
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
            Guardar Borrador
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
