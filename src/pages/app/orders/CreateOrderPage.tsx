import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
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
import { OrdenGeneralSection } from '../../../components/orders/OrdenGeneralSection';
import { OrdenItemsTab } from '../../../components/orders/OrdenItemsTab';
import { OrdenPagosTab } from '../../../components/orders/OrdenPagosTab';
import { OrdenRutasTab } from '../../../components/orders/OrdenRutasTab';
import { OrdenHistorialTab } from '../../../components/orders/OrdenHistorialTab';
import { OrdenAdjuntosTab } from '../../../components/orders/OrdenAdjuntosTab';
import { OrdenFooterTotales } from '../../../components/orders/OrdenFooterTotales';
import { useOrdenArchivos } from '../../../hooks/useOrdenArchivos';
import { useOrdenLinks } from '../../../hooks/useOrdenLinks';
import type { CanalVenta } from '../../../types/database';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { createOrdenConItems, loading, error } = useOrdenTrabajo();
  const { showSuccess, showError } = useToast();

  usePageHeader('Crear nueva orden de trabajo');

  const [ordenTemporalId] = useState(() => {
    // Intentar recuperar UUID existente para mantener adjuntos al cambiar de tab
    const existingId = sessionStorage.getItem('ordenTemporalCreacion');

    if (existingId) {
      console.log('[CreateOrderPage] Recuperando sesión temporal:', existingId);
      return existingId;
    }

    // Si no existe, generar nuevo UUID
    const newId = crypto.randomUUID();
    console.log('[CreateOrderPage] Nueva sesión temporal:', newId);
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

  const { updateStepComment, countAllComments } = useItemRoutesComments({
    items,
    setItems,
  });

  // Hooks para adjuntos temporales
  const archivosTemp = useOrdenArchivos({ ordenTemporalId });
  const linksTemp = useOrdenLinks({ ordenTemporalId });

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
  useEffect(() => {
    return () => {
      // Solo limpiar si orden no fue creada exitosamente
      if (!ordenCreada) {
        Promise.all([
          archivosTemp.limpiarTemporales(),
          linksTemp.limpiarTemporales()
        ]).then(() => {
          sessionStorage.removeItem('ordenTemporalCreacion');
          console.log('[Cleanup] Archivos temporales limpiados al desmontar');
        }).catch(err => {
          console.error('[Cleanup] Error limpiando al desmontar:', err);
        });
      }
    };
  }, [ordenCreada, archivosTemp, linksTemp]);

  const formularioTieneDatos = () => {
    return clienteId !== '' || items.length > 0 || notasInternas !== '' || fechaEntrega !== '';
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
    const subtotal = items.reduce((sum, item) => sum + item.precio_total, 0);
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

  const validarFormulario = (): boolean => {
    const errores: Record<string, string> = {};

    if (!clienteId) {
      errores.cliente = 'Debe seleccionar un cliente';
    }

    if (items.length === 0) {
      errores.items = 'Debe agregar al menos un item a la orden';
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

        // Limpiar sessionStorage
        sessionStorage.removeItem('ordenTemporalCreacion');

        // Marcar orden como creada ANTES de navegar
        setOrdenCreada(true);

        // Mostrar mensaje de éxito
        if (totalAdjuntos > 0) {
          showSuccess(`Orden creada exitosamente con ${totalAdjuntos} adjunto(s)`);
        } else {
          showSuccess('Orden creada exitosamente');
        }

        // Navegar
        setTimeout(() => {
          navigate('/app/orders/ordenes');
        }, 500);
      } catch (err: any) {
        console.error('[CreateOrderPage] Error al asociar adjuntos:', err);
        showError(`Error al asociar adjuntos: ${err.message}`);
      }
    } else {
      showError(`Error al crear la orden: ${error || 'Error desconocido'}`);
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
      disabled: true,
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
            />
          </div>

          <div className={activeTab === 'pagos' ? 'block' : 'hidden'}>
            <OrdenPagosTab
              totales={totales}
              pagos={[]}
              onAgregarPago={() => {}}
              readOnly={true}
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
        />
      </div>

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
