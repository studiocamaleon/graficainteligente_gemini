import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { generarDescripcionCopiado } from '../utils/ordenesHelpers';
import { useOrdenTrabajo } from './useOrdenTrabajo';
import type { Presupuesto } from '../types/presupuestos';

interface ConversionResult {
    success: boolean;
    ordenId?: string;
    error?: string;
}

export function usePresupuestoConversion() {
    const [isConverting, setIsConverting] = useState(false);
    const { showSuccess, showError } = useToast();
    const { createOrdenConItems } = useOrdenTrabajo();

    const convertirAOrden = async (presupuestoId: string): Promise<ConversionResult> => {
        setIsConverting(true);
        try {
            // 1. Obtener datos completos del presupuesto incluyendo rutas
            const { data: presupuestoData, error: presError } = await supabase
                .from('presupuestos')
                .select(`
                  *,
                  items:presupuestos_items (
                    *,
                    rutas:presupuestos_items_rutas (*)
                  )
                `)
                .eq('id', presupuestoId)
                .single();

            if (presError) throw presError;
            if (!presupuestoData) throw new Error('Presupuesto no encontrado');

            const presupuesto = presupuestoData as unknown as Presupuesto & { items: any[] };

            // 2. Mapear items de presupuesto a estructura de items de orden
            const itemsOrden = presupuesto.items
                .filter((item: any) => item.tipo_item !== 'item_personalizado' || item.producto_categoria !== 'Servicio Adicional')
                .map((item: any) => {
                    // Priorizar rutas relacionales, fallback a snapshot
                    const rutasGeneradas = item.rutas && item.rutas.length > 0
                        ? item.rutas.map((r: any) => ({
                            ...r,
                            etapa: r.tipo_etapa // Mapping para compatibilidad con useOrdenTrabajo
                        }))
                        : (item.configuracion?._rutas_snapshot || []);

                    let descripcion = item.descripcion;
                    if (!descripcion && (item.tipo_item === 'centro_copiado' || item.configuracion?.tipo_trabajo)) {
                        descripcion = generarDescripcionCopiado(item.configuracion);
                    }

                    return {
                        tipo_item: item.tipo_item || 'producto_sistema',
                        producto_id: item.producto_id,
                        producto_nombre: item.producto_nombre,
                        producto_categoria: item.producto_categoria,
                        descripcion: descripcion,
                        tiempo_produccion_dias: item.tiempo_produccion_dias,
                        cantidad: item.cantidad,
                        configuracion: item.configuracion,
                        precio_base: item.precio_base,
                        precio_servicios: item.precio_servicios,
                        precio_acabados: item.precio_acabados,
                        precio_unitario_final: item.precio_unitario_final,
                        precio_total: item.precio_total,
                        rutas_generadas: rutasGeneradas
                    };
                });

            // 3. Mapear items de servicio (si los hay modelados así en presupuesto)
            const serviciosOrden = presupuesto.items
                .filter((item: any) => item.tipo_item === 'item_personalizado' && item.producto_categoria === 'Servicio Adicional')
                .map((item: any) => ({
                    descripcion: item.descripcion || item.producto_nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario_final,
                    subtotal: item.precio_total
                }));

            // 4. Construir Payload
            const ordenPayload: any = {
                ordenData: {
                    cliente_id: presupuesto.cliente_id,
                    vendedor_id: presupuesto.vendedor_id,
                    canal_venta: presupuesto.canal_venta,
                    fecha_estimada_entrega: null,
                    notas_internas: presupuesto.notas_internas,
                    subtotal: presupuesto.subtotal,
                    total_descuentos: presupuesto.total_descuentos || 0,
                    total: presupuesto.total,
                    requiere_factura: false,
                    subtotal_iva: 0,
                    requiere_despacho: false,
                },
                items: itemsOrden,
                servicios: serviciosOrden,
                estadoInicial: 'pendiente'
            };

            // 5. Crear la orden usando el hook existente
            const nuevaOrden = await createOrdenConItems(ordenPayload);

            if (!nuevaOrden) throw new Error('No se pudo crear la orden (retorno nulo)');

            // 6. Actualizar estado del presupuesto y vincular
            const { error: updateError } = await supabase
                .from('presupuestos')
                .update({
                    estado: 'aprobado',
                    orden_trabajo_id: nuevaOrden.id
                })
                .eq('id', presupuestoId);

            if (updateError) console.error('Error actualizando estado presupuesto:', updateError);

            showSuccess('Presupuesto convertido a orden exitosamente');
            return { success: true, ordenId: nuevaOrden.id };

        } catch (err: any) {
            console.error('Error en conversión:', err);
            showError('Error al convertir presupuesto: ' + err.message);
            return { success: false, error: err.message };
        } finally {
            setIsConverting(false);
        }
    };

    return {
        convertirAOrden,
        isConverting
    };
}
